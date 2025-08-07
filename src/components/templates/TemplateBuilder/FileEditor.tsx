'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import, import/no-named-as-default, @typescript-eslint/no-redundant-type-constituents, no-useless-escape */

import Editor from '@monaco-editor/react';
import { 
 File, 
 Folder, 
 Plus, 
 Trash2, 
 Save, 
 Code,
 FileText,
 ChevronRight,
 ChevronDown,
 Search,
 X,
 Eye,
 Download,
 Upload,
 Copy,
 FileCode,
 FileJson,
 Hash,
 GitBranch
} from 'lucide-react';
import React, { useState, useCallback, useRef, useEffect } from 'react';

import { cn } from '@/lib/utils';

import type { EditorFile } from '../types';
import type { Monaco } from '@monaco-editor/react';

interface FileEditorProps {
 files: EditorFile[];
 onChange: (files: EditorFile[]) => void;
 onPreview?: (file: EditorFile) => void;
 className?: string;
}

interface FileTreeItem {
 name: string;
 path: string;
 type: 'file' | 'folder';
 children?: FileTreeItem[];
}

interface FileTreeProps {
 items: FileTreeItem[];
 selectedPath?: string;
 onSelect: (path: string) => void;
 onDelete: (path: string) => void;
 onNewFile: (parentPath: string) => void;
 onNewFolder: (parentPath: string) => void;
}

// File icon component
const FileIcon: React.FC<{ filename: string; className?: string }> = ({ filename, className }) => {
 const extension = filename.split('.').pop()?.toLowerCase();
 
 const iconMap: Record<string, React.FC<any>> = {
 ts: FileCode,
 tsx: FileCode,
 js: FileCode,
 jsx: FileCode,
 json: FileJson,
 md: FileText,
 yaml: FileText,
 yml: FileText,
 gitignore: GitBranch,
 dockerfile: FileCode,
 env: Hash,
 };

 const Icon = iconMap[extension || ''] || File;
 return <Icon className={cn('w-4 h-4', className)} />;
};

// File tree node component
const FileTreeNode: React.FC<{
 item: FileTreeItem;
 level: number;
 selectedPath?: string;
 onSelect: (path: string) => void;
 onDelete: (path: string) => void;
 onNewFile: (parentPath: string) => void;
 onNewFolder: (parentPath: string) => void;
}> = ({ item, level, selectedPath, onSelect, onDelete, onNewFile, onNewFolder }) => {
 const [isExpanded, setIsExpanded] = useState(true);
 const [showActions, setShowActions] = useState(false);

 const isSelected = selectedPath === item.path;

 return (
 <div>
 <div
 className={cn(
 'flex items-center gap-1 px-2 py-1 rounded cursor-pointer group',
 'hover:bg-accent hover:text-accent-foreground',
 isSelected && 'bg-accent text-accent-foreground'
 )}
 style={{ paddingLeft: `${level * 12 + 8}px` }}
 onClick={() => item.type === 'file' && onSelect(item.path)}
 onMouseEnter={() => setShowActions(true)}
 onMouseLeave={() => setShowActions(false)}
 >
 {item.type === 'folder' && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setIsExpanded(!isExpanded);
 }}
 className="p-0.5"
 >
 {isExpanded ? (
 <ChevronDown className="w-3 h-3" />
 ) : (
 <ChevronRight className="w-3 h-3" />
 )}
 </button>
 )}

 {item.type === 'folder' ? (
 <Folder className="w-4 h-4 text-blue-500" />
 ) : (
 <FileIcon filename={item.name} className="text-muted-foreground" />
 )}

 <span className="text-sm flex-1 truncate">{item.name}</span>

 {showActions && (
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
 {item.type === 'folder' && (
 <>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onNewFile(item.path);
 }}
 className="p-0.5 hover:bg-accent-foreground/10 rounded"
 title="New file"
 >
 <File className="w-3 h-3" />
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onNewFolder(item.path);
 }}
 className="p-0.5 hover:bg-accent-foreground/10 rounded"
 title="New folder"
 >
 <Folder className="w-3 h-3" />
 </button>
 </>
 )}
 <button
 onClick={(e) => {
 e.stopPropagation();
 onDelete(item.path);
 }}
 className="p-0.5 hover:bg-destructive/20 rounded text-destructive"
 title="Delete"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 )}
 </div>

 {item.type === 'folder' && isExpanded && item.children && (
 <div>
 {item.children.map((child) => (
 <FileTreeNode
 key={child.path}
 item={child}
 level={level + 1}
 selectedPath={selectedPath}
 onSelect={onSelect}
 onDelete={onDelete}
 onNewFile={onNewFile}
 onNewFolder={onNewFolder}
 />
 ))}
 </div>
 )}
 </div>
 );
};

// File tree component
const FileTree: React.FC<FileTreeProps> = ({
 items,
 selectedPath,
 onSelect,
 onDelete,
 onNewFile,
 onNewFolder,
}) => {
 return (
 <div className="py-2">
 {items.map((item) => (
 <FileTreeNode
 key={item.path}
 item={item}
 level={0}
 selectedPath={selectedPath}
 onSelect={onSelect}
 onDelete={onDelete}
 onNewFile={onNewFile}
 onNewFolder={onNewFolder}
 />
 ))}
 </div>
 );
};

// Main file editor component
export const FileEditor: React.FC<FileEditorProps> = ({
 files,
 onChange,
 onPreview,
 className,
}) => {
 const [activeFile, setActiveFile] = useState<string | undefined>(files[0]?.path);
 const [searchTerm, setSearchTerm] = useState('');
 const [showNewFileDialog, setShowNewFileDialog] = useState(false);
 const [newFilePath, setNewFilePath] = useState('');
 const editorRef = useRef<any>(null);
 const monacoRef = useRef<Monaco | null>(null);

 // Build file tree from flat file list
 const fileTree = useMemo(() => {
 const tree: FileTreeItem[] = [];
 const pathMap = new Map<string, FileTreeItem>();

 // Create all folders first
 files.forEach((file) => {
 const parts = file.path.split('/');
 let currentPath = '';

 parts.slice(0, -1).forEach((part, index) => {
 const parentPath = currentPath;
 currentPath = currentPath ? `${currentPath}/${part}` : part;

 if (!pathMap.has(currentPath)) {
 const item: FileTreeItem = {
 name: part,
 path: currentPath,
 type: 'folder',
 children: [],
 };

 pathMap.set(currentPath, item);

 if (parentPath) {
 const parent = pathMap.get(parentPath);
 if (parent && parent.children) {
 parent.children.push(item);
 }
 } else {
 tree.push(item);
 }
 }
 });
 });

 // Add files
 files.forEach((file) => {
 const parts = file.path.split('/');
 const fileName = parts[parts.length - 1];
 const parentPath = parts.slice(0, -1).join('/');

 const fileItem: FileTreeItem = {
 name: fileName,
 path: file.path,
 type: 'file',
 };

 if (parentPath) {
 const parent = pathMap.get(parentPath);
 if (parent && parent.children) {
 parent.children.push(fileItem);
 }
 } else {
 tree.push(fileItem);
 }
 });

 return tree;
 }, [files]);

 // Get active file content
 const activeFileContent = files.find((f) => f.path === activeFile);

 // Configure Monaco editor
 const handleEditorWillMount = (monaco: Monaco) => {
 monacoRef.current = monaco;

 // Define custom template language
 monaco.languages.register({ id: 'backstage-template' });

 // Set language configuration
 monaco.languages.setLanguageConfiguration('backstage-template', {
 comments: {
 lineComment: '#',
 },
 brackets: [
 ['{{', '}}'],
 ['[', ']'],
 ['{', '}'],
 ['(', ')'],
 ],
 autoClosingPairs: [
 { open: '{{', close: '}}' },
 { open: '[', close: ']' },
 { open: '{', close: '}' },
 { open: '(', close: ')' },
 { open: '"', close: '"' },
 { open: "'", close: "'" },
 ],
 });

 // Define syntax highlighting
 monaco.languages.setMonarchTokensProvider('backstage-template', {
 tokenizer: {
 root: [
 // Template variables
 [/\{\{.*?\}\}/, 'variable'],
 // Cookiecutter variables
 [/\{\%.*?\%\}/, 'keyword'],
 // Comments
 [/#.*$/, 'comment'],
 // Strings
 [/"([^"\\]|\\.)*$/, 'string.invalid'],
 [/'([^'\\]|\\.)*$/, 'string.invalid'],
 [/"/, 'string', '@string_double'],
 [/'/, 'string', '@string_single'],
 ],
 string_double: [
 [/[^\\"]+/, 'string'],
 [/\\./, 'string.escape'],
 [/"/, 'string', '@pop'],
 ],
 string_single: [
 [/[^\\']+/, 'string'],
 [/\\./, 'string.escape'],
 [/'/, 'string', '@pop'],
 ],
 },
 });

 // Define theme colors
 monaco.editor.defineTheme('backstage-template-theme', {
 base: 'vs-dark',
 inherit: true,
 rules: [
 { token: 'variable', foreground: 'ffa500' },
 { token: 'keyword', foreground: '569cd6' },
 { token: 'comment', foreground: '6a9955' },
 { token: 'string', foreground: 'ce9178' },
 ],
 colors: {},
 });
 };

 // Handle file content change
 const handleEditorChange = (value: string | undefined) => {
 if (!activeFile || value === undefined) return;

 const updatedFiles = files.map((file) =>
 file.path === activeFile ? { ...file, content: value } : file
 );
 onChange(updatedFiles);
 };

 // Handle file operations
 const handleNewFile = (parentPath: string) => {
 setNewFilePath(parentPath ? `${parentPath}/` : '');
 setShowNewFileDialog(true);
 };

 const handleCreateFile = () => {
 if (!newFilePath) return;

 const newFile: EditorFile = {
 path: newFilePath,
 content: '',
 language: 'plaintext',
 };

 onChange([...files, newFile]);
 setActiveFile(newFilePath);
 setShowNewFileDialog(false);
 setNewFilePath('');
 };

 const handleDeleteFile = (path: string) => {
 const updatedFiles = files.filter((f) => f.path !== path);
 onChange(updatedFiles);
 
 if (activeFile === path) {
 setActiveFile(updatedFiles[0]?.path);
 }
 };

 // Get language from file extension
 const getLanguage = (filename: string): string => {
 const ext = filename.split('.').pop()?.toLowerCase();
 const languageMap: Record<string, string> = {
 ts: 'typescript',
 tsx: 'typescript',
 js: 'javascript',
 jsx: 'javascript',
 json: 'json',
 yaml: 'yaml',
 yml: 'yaml',
 md: 'markdown',
 dockerfile: 'dockerfile',
 gitignore: 'plaintext',
 env: 'plaintext',
 };

 // Check if it's a template file
 if (filename.includes('{{') || filename.includes('{%')) {
 return 'backstage-template';
 }

 return languageMap[ext || ''] || 'plaintext';
 };

 return (
 <div className={cn('flex h-full', className)}>
 {/* File explorer */}
 <div className="w-64 flex-shrink-0 border-r border-border bg-muted/50">
 <div className="p-3 border-b border-border">
 <div className="flex items-center justify-between mb-2">
 <h3 className="font-medium text-sm">Files</h3>
 <div className="flex items-center gap-1">
 <button
 onClick={() => handleNewFile('')}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="New file"
 >
 <Plus className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search files..."
 className="w-full pl-7 pr-2 py-1 text-sm rounded border border-input bg-background"
 />
 </div>
 </div>

 {/* File tree */}
 <div className="overflow-y-auto flex-1">
 <FileTree
 items={fileTree}
 selectedPath={activeFile}
 onSelect={setActiveFile}
 onDelete={handleDeleteFile}
 onNewFile={handleNewFile}
 onNewFolder={handleNewFile}
 />
 </div>
 </div>

 {/* Editor */}
 <div className="flex-1 flex flex-col">
 {activeFileContent && (
 <>
 <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
 <div className="flex items-center gap-2">
 <FileIcon filename={activeFileContent.path} />
 <span className="text-sm font-medium">{activeFileContent.path}</span>
 {activeFileContent.readOnly && (
 <span className="px-2 py-0.5 text-xs rounded bg-secondary text-secondary-foreground">
 Read Only
 </span>
 )}
 </div>

 <div className="flex items-center gap-2">
 {onPreview && (
 <button
 onClick={() => onPreview(activeFileContent)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Preview"
 >
 <Eye className="w-4 h-4" />
 </button>
 )}
 <button
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Download"
 >
 <Download className="w-4 h-4" />
 </button>
 </div>
 </div>

 <div className="flex-1">
 <Editor
 height="100%"
 language={getLanguage(activeFileContent.path)}
 value={activeFileContent.content}
 onChange={handleEditorChange}
 theme="vs-dark"
 options={{
 minimap: { enabled: false },
 fontSize: 14,
 wordWrap: 'on',
 lineNumbers: 'on',
 renderWhitespace: 'selection',
 scrollBeyondLastLine: false,
 readOnly: activeFileContent.readOnly,
 automaticLayout: true,
 }}
 beforeMount={handleEditorWillMount}
 onMount={(editor) => {
 editorRef.current = editor;
 }}
 />
 </div>

 {/* Template variable helper */}
 <div className="px-4 py-2 bg-muted border-t border-border">
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 <span>Use <code className="px-1 py-0.5 rounded bg-background">{`{{ values.paramName }}`}</code> for variables</span>
 <span>•</span>
 <span>Use <code className="px-1 py-0.5 rounded bg-background">{`{% if condition %}`}</code> for conditionals</span>
 </div>
 </div>
 </>
 )}
 </div>

 {/* New file dialog */}
 {showNewFileDialog && (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-popover border border-border rounded-lg p-6 w-full max-w-md">
 <h3 className="text-lg font-semibold mb-4">Create New File</h3>
 <input
 type="text"
 value={newFilePath}
 onChange={(e) => setNewFilePath(e.target.value)}
 placeholder="path/to/file.ts"
 className="w-full px-3 py-2 rounded-md border border-input bg-background mb-4"
 autoFocus
 onKeyDown={(e) => {
 if (e.key === 'Enter') handleCreateFile();
 if (e.key === 'Escape') setShowNewFileDialog(false);
 }}
 />
 <div className="flex justify-end gap-2">
 <button
 onClick={() => setShowNewFileDialog(false)}
 className="px-4 py-2 rounded hover:bg-accent hover:text-accent-foreground"
 >
 Cancel
 </button>
 <button
 onClick={handleCreateFile}
 className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
 >
 Create
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};