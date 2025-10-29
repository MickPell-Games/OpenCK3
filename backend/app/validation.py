from __future__ import annotations

import re
from typing import Dict, List, Literal, Optional, Sequence

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix='/validation', tags=['validation'])

Severity = Literal['error', 'warning', 'info']


class Diagnostic(BaseModel):
    message: str
    severity: Severity
    startLine: int
    startColumn: int
    endLine: int
    endColumn: int
    code: Optional[str] = None


class ValidationRequest(BaseModel):
    content: str


class FieldDefinition(BaseModel):
    name: str
    type: Literal['string', 'integer', 'array', 'enum']
    required: bool = False
    values: Optional[Sequence[str]] = None


class ScopeDefinition(BaseModel):
    fields: Sequence[FieldDefinition]


TOP_LEVEL_SCOPES: Sequence[str] = ('character', 'title', 'province', 'modifier')

CK3_SCOPES: Dict[str, ScopeDefinition] = {
    'character': ScopeDefinition(
        fields=[
            FieldDefinition(name='id', type='string', required=True),
            FieldDefinition(name='culture', type='string'),
            FieldDefinition(name='faith', type='string'),
            FieldDefinition(name='traits', type='array'),
        ]
    ),
    'title': ScopeDefinition(
        fields=[
            FieldDefinition(name='id', type='string', required=True),
            FieldDefinition(name='holder', type='string'),
            FieldDefinition(name='rank', type='enum', values=['baron', 'count', 'duke', 'king', 'emperor']),
        ]
    ),
    'province': ScopeDefinition(
        fields=[
            FieldDefinition(name='id', type='string', required=True),
            FieldDefinition(
                name='terrain',
                type='enum',
                values=['plains', 'hills', 'mountains', 'desert', 'forest'],
            ),
            FieldDefinition(name='buildings', type='array'),
        ]
    ),
    'modifier': ScopeDefinition(
        fields=[
            FieldDefinition(name='id', type='string', required=True),
            FieldDefinition(name='duration', type='integer'),
            FieldDefinition(name='effects', type='array'),
        ]
    ),
}


@router.post('/lint', response_model=List[Diagnostic])
async def lint_ck3_content(request: ValidationRequest) -> List[Diagnostic]:
    try:
        return run_static_analysis(request.content)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def run_static_analysis(content: str) -> List[Diagnostic]:
    diagnostics: List[Diagnostic] = []
    scope_stack: List[_ScopeFrame] = []
    lines = content.splitlines()

    for line_number, raw_line in enumerate(lines, start=1):
        stripped = raw_line.strip()

        if not stripped or stripped.startswith('#'):
            continue

        if stripped.startswith('}'):  # scope closing
            if not scope_stack:
                diagnostics.append(
                    Diagnostic(
                        message='Unexpected closing brace',
                        severity='error',
                        startLine=line_number,
                        startColumn=_first_non_ws(raw_line),
                        endLine=line_number,
                        endColumn=_first_non_ws(raw_line) + 1,
                        code='ck3.unmatchedClose',
                    )
                )
                continue

            completed_scope = scope_stack.pop()
            diagnostics.extend(_validate_required_fields(completed_scope, line_number))
            continue

        assignment_match = re.match(r'^(?P<key>[A-Za-z_][\w-]*)\s*=\s*(?P<value>.+)$', stripped)
        if not assignment_match:
            diagnostics.append(
                Diagnostic(
                    message='Unable to parse statement',
                    severity='warning',
                    startLine=line_number,
                    startColumn=_first_non_ws(raw_line),
                    endLine=line_number,
                    endColumn=len(raw_line) + 1,
                    code='ck3.parse',
                )
            )
            continue

        key = assignment_match.group('key')
        value = assignment_match.group('value').split('#', 1)[0].strip()

        if value == '{':
            # entering a new scope
            if not scope_stack:
                if key not in TOP_LEVEL_SCOPES:
                    diagnostics.append(
                        Diagnostic(
                            message=f'Unknown top level scope "{key}"',
                            severity='error',
                            startLine=line_number,
                            startColumn=_column_for(raw_line, key),
                            endLine=line_number,
                            endColumn=_column_for(raw_line, key) + len(key),
                            code='ck3.scope.unknown',
                        )
                    )
                frame = _ScopeFrame(name=key, start_line=line_number)
                scope_stack.append(frame)
                continue

            parent_frame = scope_stack[-1]
            field_definition = _find_field(parent_frame.name, key)
            if field_definition is None:
                diagnostics.append(
                    Diagnostic(
                        message=f'Unknown field "{key}" in scope "{parent_frame.name}"',
                        severity='warning',
                        startLine=line_number,
                        startColumn=_column_for(raw_line, key),
                        endLine=line_number,
                        endColumn=_column_for(raw_line, key) + len(key),
                        code='ck3.field.unknown',
                    )
                )
            else:
                parent_frame.seen_fields.add(key)

            scope_stack.append(_ScopeFrame(name=key, start_line=line_number))
            continue

        if not scope_stack:
            diagnostics.append(
                Diagnostic(
                    message='Field assignment found outside of any scope',
                    severity='error',
                    startLine=line_number,
                    startColumn=_first_non_ws(raw_line),
                    endLine=line_number,
                    endColumn=len(raw_line) + 1,
                    code='ck3.scope.rootField',
                )
            )
            continue

        frame = scope_stack[-1]
        field_definition = _find_field(frame.name, key)

        if field_definition is None:
            diagnostics.append(
                Diagnostic(
                    message=f'Unknown field "{key}" in scope "{frame.name}"',
                    severity='warning',
                    startLine=line_number,
                    startColumn=_column_for(raw_line, key),
                    endLine=line_number,
                    endColumn=_column_for(raw_line, key) + len(key),
                    code='ck3.field.unknown',
                )
            )
            continue

        frame.seen_fields.add(key)

        type_diagnostic = _validate_value(field_definition, value, line_number, raw_line)
        if type_diagnostic:
            diagnostics.append(type_diagnostic)

    while scope_stack:
        frame = scope_stack.pop()
        diagnostics.append(
            Diagnostic(
                message=f'Scope "{frame.name}" was not closed',
                severity='error',
                startLine=frame.start_line,
                startColumn=1,
                endLine=frame.start_line,
                endColumn=1,
                code='ck3.scope.unclosed',
            )
        )
        diagnostics.extend(_validate_required_fields(frame, len(lines) or 1))

    return diagnostics


def _validate_required_fields(frame: '_ScopeFrame', line_number: int) -> List[Diagnostic]:
    definition = CK3_SCOPES.get(frame.name)
    if not definition:
        return []

    diagnostics: List[Diagnostic] = []
    for field in definition.fields:
        if field.required and field.name not in frame.seen_fields:
            diagnostics.append(
                Diagnostic(
                    message=f'Missing required field "{field.name}" in scope "{frame.name}"',
                    severity='error',
                    startLine=frame.start_line,
                    startColumn=1,
                    endLine=line_number,
                    endColumn=1,
                    code='ck3.field.required',
                )
            )
    return diagnostics


def _validate_value(
    field_definition: FieldDefinition, value: str, line_number: int, raw_line: str
) -> Optional[Diagnostic]:
    column = _column_for(raw_line, value) if value else 1

    if field_definition.type == 'integer' and not re.fullmatch(r'-?\d+', value):
        return Diagnostic(
            message=f'Expected integer value for "{field_definition.name}"',
            severity='error',
            startLine=line_number,
            startColumn=column,
            endLine=line_number,
            endColumn=column + len(value),
            code='ck3.type.integer',
        )

    if field_definition.type == 'enum' and field_definition.values:
        normalized = value.strip('"')
        if normalized not in field_definition.values:
            return Diagnostic(
                message=(
                    f'Invalid value "{value}" for "{field_definition.name}". '
                    f'Allowed: {", ".join(field_definition.values)}'
                ),
                severity='error',
                startLine=line_number,
                startColumn=column,
                endLine=line_number,
                endColumn=column + len(value),
                code='ck3.type.enum',
            )

    return None


def _find_field(scope_name: str, field_name: str) -> Optional[FieldDefinition]:
    definition = CK3_SCOPES.get(scope_name)
    if not definition:
        return None
    return next((field for field in definition.fields if field.name == field_name), None)


def _column_for(raw_line: str, fragment: str) -> int:
    index = raw_line.find(fragment)
    return index + 1 if index >= 0 else 1


def _first_non_ws(raw_line: str) -> int:
    match = re.match(r'\s*', raw_line)
    return (match.end() if match else 0) + 1


class _ScopeFrame:
    __slots__ = ('name', 'start_line', 'seen_fields')

    def __init__(self, name: str, start_line: int) -> None:
        self.name = name
        self.start_line = start_line
        self.seen_fields: set[str] = set()
