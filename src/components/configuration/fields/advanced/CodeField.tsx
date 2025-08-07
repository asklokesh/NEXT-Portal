'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { 
  Copy, 
  Download, 
  Upload, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  Check,
  AlertTriangle,
  FileText,
  Braces
} from 'lucide-react';

import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface CodeFieldProps {
  name: string;
  schema: ConfigurationSchema;
  config: FormConfiguration;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

interface ValidationError {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Language detection and configuration
const LANGUAGE_MAP: Record<string, string> = {
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  python: 'python',
  py: 'python',
  shell: 'shell',
  sh: 'shell',
  bash: 'shell',
  dockerfile: 'dockerfile',
  sql: 'sql',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  markdown: 'markdown',
  md: 'markdown',
};

function detectLanguage(value: string, fieldName?: string): string {
  // Try to detect from field name
  if (fieldName) {
    const extension = fieldName.split('.').pop()?.toLowerCase();
    if (extension && LANGUAGE_MAP[extension]) {
      return LANGUAGE_MAP[extension];
    }
  }

  // Try to detect from content
  const trimmed = value.trim();
  
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  
  if (trimmed.includes('apiVersion:') || trimmed.includes('kind:')) {
    return 'yaml';
  }
  
  if (trimmed.includes('FROM ') || trimmed.includes('RUN ')) {
    return 'dockerfile';
  }
  
  if (trimmed.includes('function ') || trimmed.includes('const ') || trimmed.includes('=>')) {
    return 'javascript';
  }
  
  return 'plaintext';
}

// Validate code content
function validateCode(value: string, language: string): ValidationError[] {
  const errors: ValidationError[] = [];
  
  try {
    switch (language) {
      case 'json':
        if (value.trim()) {
          JSON.parse(value);
        }
        break;
      case 'yaml':
        // Basic YAML validation - in production, use a proper YAML parser
        if (value.includes('\t')) {
          errors.push({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: 'YAML should use spaces for indentation, not tabs',
            severity: 'warning',
          });
        }
        break;
    }
  } catch (parseError) {
    errors.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: value.length,
      message: parseError instanceof Error ? parseError.message : 'Parse error',
      severity: 'error',
    });
  }
  
  return errors;
}

const CodeField: React.FC<CodeFieldProps> = ({
  name,
  schema,
  config,
  required,
  disabled,
  error,
  value = '',
  onChange,
  onBlur
}) => {
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [language, setLanguage] = useState('plaintext');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [copiedRecently, setCopiedRecently] = useState(false);

  // Detect language
  useEffect(() => {
    const detectedLanguage = detectLanguage(value, name);
    setLanguage(detectedLanguage);
  }, [value, name]);

  // Validate code
  useEffect(() => {
    const errors = validateCode(value, language);
    setValidationErrors(errors);
  }, [value, language]);

  // Handle editor mounting
  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
      minimap: { enabled: value.split('\n').length > 20 },
      scrollBeyondLastLine: false,
      folding: true,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      wordWrap: 'on',
      automaticLayout: true,
    });

    // Set up validation markers
    const model = editor.getModel();
    if (model) {
      const markers = validationErrors.map(error => ({
        ...error,
        source: 'configuration-validation',
      }));
      monaco.editor.setModelMarkers(model, 'configuration-validation', markers);
    }
  }, [value, validationErrors]);

  // Handle value changes
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRecently(true);
      setTimeout(() => setCopiedRecently(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [value]);

  // Download as file
  const handleDownload = useCallback(() => {
    const extension = language === 'plaintext' ? 'txt' : language;
    const filename = `${name || 'code'}.${extension}`;
    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [value, language, name]);

  // Upload from file
  const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onChange(content);
      };
      reader.readAsText(file);
    }
  }, [onChange]);

  // Format code
  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  // Reset to default
  const handleReset = useCallback(() => {
    onChange(schema.default as string || '');
  }, [onChange, schema.default]);

  // Editor theme
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const editorComponent = (
    <div className="relative border border-border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {language === 'json' && <Braces className="w-3 h-3" />}
            {language === 'yaml' && <FileText className="w-3 h-3" />}
            <span className="font-mono uppercase">{language}</span>
          </div>
          
          {validationErrors.length > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-destructive" />
              <span className="text-xs text-destructive">
                {validationErrors.length} issue(s)
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Tooltip content={copiedRecently ? 'Copied!' : 'Copy to clipboard'}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!value || disabled}
              className="h-8 w-8 p-0"
            >
              {copiedRecently ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </Tooltip>
          
          <Tooltip content="Download as file">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!value || disabled}
              className="h-8 w-8 p-0"
            >
              <Download className="w-3 h-3" />
            </Button>
          </Tooltip>
          
          <Tooltip content="Upload from file">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || config.readonly}
              className="h-8 w-8 p-0"
              asChild
            >
              <label>
                <Upload className="w-3 h-3" />
                <input
                  type="file"
                  onChange={handleUpload}
                  accept=".txt,.json,.yaml,.yml,.js,.ts,.py,.sh,.md"
                  className="hidden"
                />
              </label>
            </Button>
          </Tooltip>
          
          {schema.default && (
            <Tooltip content="Reset to default">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={disabled || config.readonly}
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </Tooltip>
          )}
          
          {!isFullscreen && (
            <Tooltip content="Fullscreen">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(true)}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      
      {/* Editor */}
      <div className={cn(
        'relative',
        isFullscreen ? 'h-[80vh]' : 'h-64',
        error && 'border-destructive'
      )}>
        <Editor
          value={value}
          onChange={handleChange}
          onMount={handleEditorMount}
          language={language}
          theme={editorTheme}
          options={{
            readOnly: disabled || config.readonly,
            wordWrap: 'on',
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
            tabSize: language === 'yaml' ? 2 : 4,
            insertSpaces: true,
            detectIndentation: false,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {isFullscreen ? (
        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
            <DialogHeader className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <DialogTitle>Code Editor - {name}</DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(false)}
                  className="h-8 w-8 p-0"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="p-4">
              {editorComponent}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        editorComponent
      )}

      {/* Validation summary */}
      {validationErrors.length > 0 && (
        <div className="text-sm space-y-1">
          {validationErrors.map((error, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2',
                error.severity === 'error' && 'text-destructive',
                error.severity === 'warning' && 'text-yellow-600',
                error.severity === 'info' && 'text-blue-600'
              )}
            >
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                Line {error.startLineNumber}: {error.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CodeField;