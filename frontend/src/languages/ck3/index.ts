import type * as Monaco from 'monaco-editor';
import rawScopes from './scopes.json';

export const CK3_LANGUAGE_ID = 'ck3-script';

export interface CK3FieldDefinition {
  name: string;
  type: 'string' | 'integer' | 'array' | 'enum';
  required?: boolean;
  values?: string[];
}

export interface CK3ScopeDefinition {
  fields: CK3FieldDefinition[];
}

export interface CK3Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  code?: string;
}

export type FetchDiagnostics = (code: string) => Promise<CK3Diagnostic[]>;

const topLevelScopes: string[] = rawScopes.topLevel;
const scopeDefinitions: Record<string, CK3ScopeDefinition> = Object.fromEntries(
  Object.entries(rawScopes).filter(([key]) => key !== 'topLevel')
) as Record<string, CK3ScopeDefinition>;

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const logicalOperatorCanonicalForms: Record<string, string> = {
  always: 'always',
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  nor: 'NOR',
  nand: 'NAND',
  all_false: 'all_false',
  any_false: 'any_false',
  switch: 'switch',
  trigger_if: 'trigger_if',
  trigger_else_if: 'trigger_else_if',
  trigger_else: 'trigger_else'
};

export const booleanCanonicalForms: Record<string, string> = {
  yes: 'yes',
  no: 'no'
};

const keywordPattern = new RegExp(`\\b(${topLevelScopes.map(escapeForRegExp).join('|')})\\b`);
const logicalOperatorPattern = new RegExp(
  `\\b(${Object.keys(logicalOperatorCanonicalForms).map(escapeForRegExp).join('|')})\\b`,
  'i'
);
const booleanPattern = new RegExp(
  `\\b(${Object.keys(booleanCanonicalForms).map(escapeForRegExp).join('|')})\\b`,
  'i'
);
const comparisonOperatorPattern = /(<=|>=|!=|=|<|>)/;
let registered = false;

const fieldNames = Object.values(scopeDefinitions)
  .flatMap((scope: any) => (scope.fields ?? []).map((field: CK3FieldDefinition) => field.name))
  .filter((name, index, arr) => arr.indexOf(name) === index);

export const registerCK3Language = (monaco: typeof Monaco) => {
  if (registered) {
    return;
  }

  monaco.languages.register({ id: CK3_LANGUAGE_ID });

  monaco.languages.setLanguageConfiguration(CK3_LANGUAGE_ID, {
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '"', close: '"' }
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: '{', close: '}' }
    ],
    comments: {
      lineComment: '#'
    },
    brackets: [
      ['{', '}']
    ]
  });

  monaco.languages.setMonarchTokensProvider(CK3_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/\s+/, 'white'],
        [/#.*$/, 'comment'],
        [logicalOperatorPattern, 'keyword.logical'],
        [booleanPattern, 'constant.boolean'],
        [comparisonOperatorPattern, 'operator.comparison'],
        [/\b\d+\b/, 'number'],
        [keywordPattern, 'keyword'],
        [
          new RegExp(`\\b(${fieldNames.map(escapeForRegExp).join('|')})\\b`),
          'type.identifier'
        ],
        [/\{/, { token: 'delimiter.curly', bracket: '@open' }],
        [/\}/, { token: 'delimiter.curly', bracket: '@close' }],
        [/"([^\\"\n]|\\.)*"/, 'string']
      ]
    }
  });

  monaco.editor.defineTheme('ck3-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.logical', foreground: '7FDBFF' },
      { token: 'constant.boolean', foreground: '2ECC71' },
      { token: 'operator.comparison', foreground: 'FF6B6B' }
    ],
    colors: {}
  });

  const topLevelSuggestions = topLevelScopes.map((scopeName) => ({
    label: scopeName,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: `${scopeName} = {\n\t$0\n}`,
    documentation: `CK3 ${scopeName} scope`
  }));

  const scopeFieldSuggestions: Record<string, Omit<Monaco.languages.CompletionItem, 'range'>[]> = {};
  for (const scopeName of topLevelScopes) {
    const definition = scopeDefinitions[scopeName] as CK3ScopeDefinition | undefined;
    if (!definition) {
      continue;
    }

    scopeFieldSuggestions[scopeName] = definition.fields.map((field) => ({
      label: field.name,
      insertText: field.values
        ? `${field.name} = ${field.values[0] ?? '""'}`
        : `${field.name} = `,
      kind: monaco.languages.CompletionItemKind.Field,
      documentation: buildFieldDocumentation(scopeName, field)
    }));
  }

  monaco.languages.registerCompletionItemProvider(CK3_LANGUAGE_ID, {
    triggerCharacters: [' ', '=', '{', '\"'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      );

      const scope = resolveScopeAtPosition(model, position);
      if (!scope || !scopeFieldSuggestions[scope]) {
        return {
          suggestions: topLevelSuggestions.map((suggestion) => ({
            ...suggestion,
            range
          }))
        };
      }

      const suggestions = scopeFieldSuggestions[scope].map((suggestion) => ({
        ...suggestion,
        range
      }));

      return { suggestions };
    }
  });

  registered = true;
};

const buildFieldDocumentation = (scopeName: string, field: CK3FieldDefinition) => {
  const base = `${scopeName}.${field.name}: ${field.type}`;
  if (field.values && field.values.length) {
    return `${base}\nAllowed values: ${field.values.join(', ')}`;
  }
  return base;
};

const resolveScopeAtPosition = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): string | null => {
  for (let line = position.lineNumber; line >= 1; line -= 1) {
    const value = model.getLineContent(line);
    const scopeMatch = value.match(/^(\s*)([a-zA-Z_][\w-]*)\s*=\s*\{\s*$/);
    if (scopeMatch) {
      return scopeMatch[2];
    }
    const closingBraceIdx = value.indexOf('}');
    if (closingBraceIdx >= 0 && closingBraceIdx < position.column && line === position.lineNumber) {
      break;
    }
  }

  return null;
};

export const createCK3DiagnosticsAdapter = (
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  fetchDiagnostics: FetchDiagnostics,
  options?: { debounceMs?: number }
) => {
  const debounceMs = options?.debounceMs ?? 400;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const toMarkerData = (diagnostic: CK3Diagnostic): Monaco.editor.IMarkerData => ({
    message: diagnostic.message,
    severity: severityToMarker(monaco, diagnostic.severity),
    startLineNumber: diagnostic.startLine,
    startColumn: diagnostic.startColumn,
    endLineNumber: diagnostic.endLine,
    endColumn: diagnostic.endColumn,
    code: diagnostic.code
  });

  const runValidation = async () => {
    if (disposed) {
      return;
    }

    try {
      const diagnostics = await fetchDiagnostics(model.getValue());
      monaco.editor.setModelMarkers(model, CK3_LANGUAGE_ID, diagnostics.map(toMarkerData));
    } catch (error) {
      console.warn('[CK3] Failed to validate document', error);
    }
  };

  const scheduleValidation = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(runValidation, debounceMs);
  };

  const disposable = model.onDidChangeContent(scheduleValidation);
  scheduleValidation();

  return {
    dispose() {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
      disposable.dispose();
      monaco.editor.setModelMarkers(model, CK3_LANGUAGE_ID, []);
    }
  };
};

const severityToMarker = (
  monaco: typeof Monaco,
  severity: CK3Diagnostic['severity']
): Monaco.MarkerSeverity => {
  switch (severity) {
    case 'error':
      return monaco.MarkerSeverity.Error;
    case 'warning':
      return monaco.MarkerSeverity.Warning;
    default:
      return monaco.MarkerSeverity.Info;
  }
};
