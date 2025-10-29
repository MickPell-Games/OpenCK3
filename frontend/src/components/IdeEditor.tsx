import { useCallback, useEffect, useMemo, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  CK3_LANGUAGE_ID,
  CK3Diagnostic,
  createCK3DiagnosticsAdapter,
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

  const handleEditorWillUnmount = useCallback(() => {
    adapterRef.current?.dispose();
    adapterRef.current = null;
    editorRef.current = null;
    monacoRef.current = null;
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

      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, CK3_LANGUAGE_ID);
      }

      initializeDiagnostics();
    },
    [initializeDiagnostics]
  );

  useEffect(() => {
    initializeDiagnostics();
  }, [initializeDiagnostics]);

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
