import { useCallback, useEffect, useMemo, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  CK3_LANGUAGE_ID,
  CK3Diagnostic,
  booleanCanonicalForms,
  createCK3DiagnosticsAdapter,
  logicalOperatorCanonicalForms,
  registerCK3Language
} from '../languages/ck3';

type MonacoEditor = Monaco.editor.IStandaloneCodeEditor;

type DiagnosticsAdapter = ReturnType<typeof createCK3DiagnosticsAdapter>;

export interface IdeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  diagnosticsEndpoint?: string;
  debounceMs?: number;
}

const DEFAULT_HEIGHT = '100%';
const DEFAULT_ENDPOINT = '/api/validation/lint';

const IdeEditor = ({
  value,
  onChange,
  readOnly = false,
  height = DEFAULT_HEIGHT,
  className,
  diagnosticsEndpoint = DEFAULT_ENDPOINT,
  debounceMs
}: IdeEditorProps) => {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const adapterRef = useRef<DiagnosticsAdapter | null>(null);
  const correctionDisposableRef = useRef<Monaco.IDisposable | null>(null);
  const applyingCorrectionsRef = useRef(false);

  const applyAutoCorrections = useCallback(() => {
    if (readOnly) {
      correctionDisposableRef.current?.dispose();
      correctionDisposableRef.current = null;
      return;
    }

    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    correctionDisposableRef.current?.dispose();

    const collectEditsForLines = (lines: number[]) => {
      const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
      const validLines = lines.filter((line) => line >= 1 && line <= model.getLineCount());

      for (const line of validLines) {
        const content = model.getLineContent(line);
        if (!content) {
          continue;
        }

        const wordPattern = /\b([A-Za-z_][\w]*)\b/g;
        let match: RegExpExecArray | null;

        while ((match = wordPattern.exec(content))) {
          const [word] = match;
          const lower = word.toLowerCase();

          let replacement: string | null = null;

          if (lower in logicalOperatorCanonicalForms) {
            replacement = logicalOperatorCanonicalForms[lower];
          } else if (lower in booleanCanonicalForms) {
            replacement = booleanCanonicalForms[lower];
          }

          if (!replacement || replacement === word) {
            continue;
          }

          const startColumn = match.index + 1;
          const endColumn = startColumn + word.length;

          edits.push({
            range: new monaco.Range(line, startColumn, line, endColumn),
            text: replacement,
            forceMoveMarkers: true
          });
        }
      }

      return edits;
    };

    const applyEdits = (edits: Monaco.editor.IIdentifiedSingleEditOperation[]) => {
      if (!edits.length) {
        return;
      }

      applyingCorrectionsRef.current = true;
      editor.executeEdits('ck3-auto-correct', edits);
      applyingCorrectionsRef.current = false;
    };

    correctionDisposableRef.current = editor.onDidChangeModelContent((event) => {
      if (applyingCorrectionsRef.current) {
        return;
      }

      const affectedLines = new Set<number>();

      for (const change of event.changes) {
        const lineDelta = change.text.split('\n').length - 1;
        const startLine = change.range.startLineNumber;
        const endLine = Math.min(
          model.getLineCount(),
          change.range.endLineNumber + lineDelta
        );

        for (let line = startLine; line <= endLine; line += 1) {
          affectedLines.add(line);
        }
      }

      const edits = collectEditsForLines(Array.from(affectedLines));
      applyEdits(edits);
    });

    const initialLines = Array.from({ length: model.getLineCount() }, (_, index) => index + 1);
    const initialEdits = collectEditsForLines(initialLines);
    applyEdits(initialEdits);
  }, [readOnly]);

  const handleEditorWillUnmount = useCallback(() => {
    adapterRef.current?.dispose();
    adapterRef.current = null;
    editorRef.current = null;
    monacoRef.current = null;
    correctionDisposableRef.current?.dispose();
    correctionDisposableRef.current = null;
    applyingCorrectionsRef.current = false;
  }, []);

  const fetchDiagnostics = useCallback(
    async (code: string): Promise<CK3Diagnostic[]> => {
      try {
        const response = await fetch(diagnosticsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: code })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to validate CK3 content');
        }

        const payload = (await response.json()) as CK3Diagnostic[];
        return payload;
      } catch (error) {
        console.warn('[CK3] Validation request failed', error);
        return [];
      }
    },
    [diagnosticsEndpoint]
  );

  const initializeDiagnostics = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    adapterRef.current?.dispose();

    if (readOnly) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) {
      return;
    }

    adapterRef.current = createCK3DiagnosticsAdapter(
      monacoRef.current,
      model,
      fetchDiagnostics,
      debounceMs ? { debounceMs } : undefined
    );
  }, [debounceMs, fetchDiagnostics, readOnly]);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      registerCK3Language(monaco);
      monaco.editor.setTheme('ck3-dark');

      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, CK3_LANGUAGE_ID);
      }

      applyAutoCorrections();

      initializeDiagnostics();
    },
    [applyAutoCorrections, initializeDiagnostics]
  );

  useEffect(() => {
    initializeDiagnostics();
  }, [initializeDiagnostics]);

  useEffect(() => {
    applyAutoCorrections();
  }, [applyAutoCorrections]);

  useEffect(() => () => handleEditorWillUnmount(), [handleEditorWillUnmount]);

  const editorHeight = useMemo(() => height ?? DEFAULT_HEIGHT, [height]);

  return (
    <Editor
      className={className}
      height={editorHeight}
      defaultLanguage={CK3_LANGUAGE_ID}
      theme="vs-dark"
      value={value}
      options={{
        automaticLayout: true,
        readOnly,
        minimap: { enabled: false },
        tabSize: 2,
        scrollBeyondLastLine: false
      }}
      onChange={(newValue) => {
        if (onChange) {
          onChange(newValue ?? '');
        }
      }}
      onMount={handleEditorDidMount}
    />
  );
};

export default IdeEditor;
