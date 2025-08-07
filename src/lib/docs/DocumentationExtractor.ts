import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseJS } from '@babel/parser';
import traverse from '@babel/traverse';
import { TypescriptParser } from 'typescript-parser';
import matter from 'gray-matter';
import { glob } from 'glob';

export interface DocComment {
  description: string;
  params?: Array<{
    name: string;
    type?: string;
    description: string;
    optional?: boolean;
  }>;
  returns?: {
    type?: string;
    description: string;
  };
  examples?: string[];
  deprecated?: boolean;
  since?: string;
  tags?: Record<string, string>;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export interface ExtractedDocumentation {
  functions: Array<{
    name: string;
    signature: string;
    documentation: DocComment;
    isExported: boolean;
    isAsync: boolean;
  }>;
  classes: Array<{
    name: string;
    documentation: DocComment;
    methods: Array<{
      name: string;
      signature: string;
      documentation: DocComment;
      visibility: 'public' | 'private' | 'protected';
      isStatic: boolean;
    }>;
    properties: Array<{
      name: string;
      type?: string;
      documentation: DocComment;
      visibility: 'public' | 'private' | 'protected';
      isStatic: boolean;
    }>;
    isExported: boolean;
  }>;
  interfaces: Array<{
    name: string;
    documentation: DocComment;
    properties: Array<{
      name: string;
      type?: string;
      documentation: DocComment;
      optional: boolean;
    }>;
    isExported: boolean;
  }>;
  types: Array<{
    name: string;
    definition: string;
    documentation: DocComment;
    isExported: boolean;
  }>;
  constants: Array<{
    name: string;
    value?: string;
    type?: string;
    documentation: DocComment;
    isExported: boolean;
  }>;
  apiEndpoints: Array<{
    path: string;
    method: string;
    handler: string;
    documentation: DocComment;
    parameters?: Array<{
      name: string;
      type: 'query' | 'body' | 'path' | 'header';
      schema?: any;
      required: boolean;
      description: string;
    }>;
    responses?: Record<string, {
      description: string;
      schema?: any;
    }>;
  }>;
  metadata: {
    file: string;
    lastModified: Date;
    language: 'typescript' | 'javascript' | 'python' | 'java' | 'rust';
    moduleType: 'esm' | 'commonjs' | 'unknown';
    dependencies: string[];
  };
}

export class DocumentationExtractor {
  private cache: Map<string, { content: ExtractedDocumentation; lastModified: number }> = new Map();
  private cacheMaxAge = 5 * 60 * 1000; // 5 minutes

  constructor(
    private options: {
      includePrivate?: boolean;
      includeInternal?: boolean;
      extractExamples?: boolean;
      followImports?: boolean;
      maxDepth?: number;
    } = {}
  ) {
    this.options = {
      includePrivate: false,
      includeInternal: false,
      extractExamples: true,
      followImports: false,
      maxDepth: 3,
      ...options,
    };
  }

  /**
   * Extract documentation from multiple files or directories
   */
  async extractFromPaths(paths: string[]): Promise<Map<string, ExtractedDocumentation>> {
    const results = new Map<string, ExtractedDocumentation>();
    const allFiles = new Set<string>();

    // Collect all files to process
    for (const inputPath of paths) {
      const stats = await fs.stat(inputPath);
      if (stats.isDirectory()) {
        const files = await this.findSourceFiles(inputPath);
        files.forEach(file => allFiles.add(file));
      } else {
        allFiles.add(inputPath);
      }
    }

    // Process files in parallel
    const processingPromises = Array.from(allFiles).map(async (file) => {
      try {
        const documentation = await this.extractFromFile(file);
        results.set(file, documentation);
      } catch (error) {
        console.warn(`Failed to extract documentation from ${file}:`, error);
      }
    });

    await Promise.all(processingPromises);
    return results;
  }

  /**
   * Extract documentation from a single file
   */
  async extractFromFile(filePath: string): Promise<ExtractedDocumentation> {
    const stats = await fs.stat(filePath);
    const cacheKey = filePath;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.lastModified < this.cacheMaxAge) {
      return cached.content;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);
    let documentation: ExtractedDocumentation;

    switch (language) {
      case 'typescript':
      case 'javascript':
        documentation = await this.extractFromJavaScript(content, filePath, language);
        break;
      case 'python':
        documentation = await this.extractFromPython(content, filePath);
        break;
      case 'java':
        documentation = await this.extractFromJava(content, filePath);
        break;
      case 'rust':
        documentation = await this.extractFromRust(content, filePath);
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    // Cache the result
    this.cache.set(cacheKey, {
      content: documentation,
      lastModified: Date.now(),
    });

    return documentation;
  }

  /**
   * Extract documentation from TypeScript/JavaScript files
   */
  private async extractFromJavaScript(
    content: string,
    filePath: string,
    language: 'typescript' | 'javascript'
  ): Promise<ExtractedDocumentation> {
    const documentation: ExtractedDocumentation = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      constants: [],
      apiEndpoints: [],
      metadata: {
        file: filePath,
        lastModified: new Date(),
        language,
        moduleType: this.detectModuleType(content),
        dependencies: this.extractDependencies(content),
      },
    };

    try {
      // Use TypeScript parser for better type information
      if (language === 'typescript') {
        const parser = new TypescriptParser();
        const parsed = await parser.parseSource(content, filePath);
        
        // Extract interfaces and types
        for (const declaration of parsed.declarations) {
          if (declaration.name) {
            if (declaration.constructor.name === 'InterfaceDeclaration') {
              documentation.interfaces.push({
                name: declaration.name,
                documentation: this.extractTSDocComment(declaration as any),
                properties: [],
                isExported: (declaration as any).isExported || false,
              });
            } else if (declaration.constructor.name === 'TypeAliasDeclaration') {
              documentation.types.push({
                name: declaration.name,
                definition: (declaration as any).type?.toString() || '',
                documentation: this.extractTSDocComment(declaration as any),
                isExported: (declaration as any).isExported || false,
              });
            }
          }
        }
      }

      // Parse with Babel for better AST handling
      const ast = parseJS(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'asyncGenerators',
          'bigInt',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining',
        ],
      });

      traverse(ast, {
        FunctionDeclaration: (path) => {
          const node = path.node;
          if (node.id?.name) {
            const docComment = this.extractJSDocComment(path);
            documentation.functions.push({
              name: node.id.name,
              signature: this.getFunctionSignature(node),
              documentation: {
                ...docComment,
                location: {
                  file: filePath,
                  line: node.loc?.start.line || 0,
                  column: node.loc?.start.column || 0,
                },
              },
              isExported: this.isExported(path),
              isAsync: node.async || false,
            });
          }
        },

        ArrowFunctionExpression: (path) => {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            const docComment = this.extractJSDocComment(path);
            documentation.functions.push({
              name: parent.id.name,
              signature: this.getArrowFunctionSignature(path.node, parent.id.name),
              documentation: {
                ...docComment,
                location: {
                  file: filePath,
                  line: path.node.loc?.start.line || 0,
                  column: path.node.loc?.start.column || 0,
                },
              },
              isExported: this.isExported(path.parentPath.parentPath),
              isAsync: path.node.async || false,
            });
          }
        },

        ClassDeclaration: (path) => {
          const node = path.node;
          if (node.id?.name) {
            const docComment = this.extractJSDocComment(path);
            const classDoc = {
              name: node.id.name,
              documentation: {
                ...docComment,
                location: {
                  file: filePath,
                  line: node.loc?.start.line || 0,
                  column: node.loc?.start.column || 0,
                },
              },
              methods: [],
              properties: [],
              isExported: this.isExported(path),
            };

            // Extract methods and properties
            path.traverse({
              ClassMethod: (methodPath) => {
                const methodNode = methodPath.node;
                if (methodNode.key.type === 'Identifier') {
                  const methodDoc = this.extractJSDocComment(methodPath);
                  classDoc.methods.push({
                    name: methodNode.key.name,
                    signature: this.getMethodSignature(methodNode),
                    documentation: {
                      ...methodDoc,
                      location: {
                        file: filePath,
                        line: methodNode.loc?.start.line || 0,
                        column: methodNode.loc?.start.column || 0,
                      },
                    },
                    visibility: this.getMethodVisibility(methodNode),
                    isStatic: methodNode.static || false,
                  });
                }
              },

              ClassProperty: (propPath) => {
                const propNode = propPath.node;
                if (propNode.key.type === 'Identifier') {
                  const propDoc = this.extractJSDocComment(propPath);
                  classDoc.properties.push({
                    name: propNode.key.name,
                    type: this.getPropertyType(propNode),
                    documentation: {
                      ...propDoc,
                      location: {
                        file: filePath,
                        line: propNode.loc?.start.line || 0,
                        column: propNode.loc?.start.column || 0,
                      },
                    },
                    visibility: this.getPropertyVisibility(propNode),
                    isStatic: propNode.static || false,
                  });
                }
              },
            });

            documentation.classes.push(classDoc);
          }
        },

        VariableDeclaration: (path) => {
          for (const declarator of path.node.declarations) {
            if (declarator.id.type === 'Identifier' && declarator.init) {
              const docComment = this.extractJSDocComment(path);
              documentation.constants.push({
                name: declarator.id.name,
                value: this.getConstantValue(declarator.init),
                type: this.getVariableType(declarator),
                documentation: {
                  ...docComment,
                  location: {
                    file: filePath,
                    line: declarator.loc?.start.line || 0,
                    column: declarator.loc?.start.column || 0,
                  },
                },
                isExported: this.isExported(path),
              });
            }
          }
        },
      });

      // Extract API endpoints if this looks like a route file
      if (this.isRouteFile(filePath)) {
        documentation.apiEndpoints = await this.extractAPIEndpoints(content, filePath);
      }

    } catch (error) {
      console.warn(`Error parsing ${filePath}:`, error);
    }

    return documentation;
  }

  /**
   * Extract documentation from Python files
   */
  private async extractFromPython(content: string, filePath: string): Promise<ExtractedDocumentation> {
    const documentation: ExtractedDocumentation = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      constants: [],
      apiEndpoints: [],
      metadata: {
        file: filePath,
        lastModified: new Date(),
        language: 'python',
        moduleType: 'unknown',
        dependencies: this.extractPythonDependencies(content),
      },
    };

    // Simple regex-based extraction for Python docstrings
    const functionRegex = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:\s*(?:"""([^"]*(?:"[^"]*)*?)""")?/g;
    const classRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)[^:]*:\s*(?:"""([^"]*(?:"[^"]*)*?)""")?/g;

    let match;
    
    // Extract functions
    while ((match = functionRegex.exec(content)) !== null) {
      const [, name, docstring] = match;
      const docComment = this.parsePythonDocstring(docstring || '');
      
      documentation.functions.push({
        name,
        signature: `def ${name}(...)`,
        documentation: {
          ...docComment,
          location: {
            file: filePath,
            line: this.getLineNumber(content, match.index),
            column: 0,
          },
        },
        isExported: true, // Python functions are generally public
        isAsync: match[0].includes('async def'),
      });
    }

    // Extract classes
    while ((match = classRegex.exec(content)) !== null) {
      const [, name, docstring] = match;
      const docComment = this.parsePythonDocstring(docstring || '');
      
      documentation.classes.push({
        name,
        documentation: {
          ...docComment,
          location: {
            file: filePath,
            line: this.getLineNumber(content, match.index),
            column: 0,
          },
        },
        methods: [], // Would need more sophisticated parsing
        properties: [],
        isExported: true,
      });
    }

    return documentation;
  }

  /**
   * Extract documentation from Java files
   */
  private async extractFromJava(content: string, filePath: string): Promise<ExtractedDocumentation> {
    const documentation: ExtractedDocumentation = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      constants: [],
      apiEndpoints: [],
      metadata: {
        file: filePath,
        lastModified: new Date(),
        language: 'java',
        moduleType: 'unknown',
        dependencies: this.extractJavaDependencies(content),
      },
    };

    // Simple regex-based extraction for JavaDoc
    const classRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:public\s+)?(?:class|interface)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const methodRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:public|private|protected)?\s*(?:static\s+)?(?:[a-zA-Z_][a-zA-Z0-9_<>]*\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;

    let match;
    
    // Extract classes
    while ((match = classRegex.exec(content)) !== null) {
      const [, javadoc, name] = match;
      const docComment = this.parseJavaDoc(javadoc);
      
      documentation.classes.push({
        name,
        documentation: {
          ...docComment,
          location: {
            file: filePath,
            line: this.getLineNumber(content, match.index),
            column: 0,
          },
        },
        methods: [],
        properties: [],
        isExported: true,
      });
    }

    // Extract methods
    while ((match = methodRegex.exec(content)) !== null) {
      const [, javadoc, name] = match;
      const docComment = this.parseJavaDoc(javadoc);
      
      documentation.functions.push({
        name,
        signature: `${name}(...)`,
        documentation: {
          ...docComment,
          location: {
            file: filePath,
            line: this.getLineNumber(content, match.index),
            column: 0,
          },
        },
        isExported: true,
        isAsync: false,
      });
    }

    return documentation;
  }

  /**
   * Extract documentation from Rust files
   */
  private async extractFromRust(content: string, filePath: string): Promise<ExtractedDocumentation> {
    const documentation: ExtractedDocumentation = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      constants: [],
      apiEndpoints: [],
      metadata: {
        file: filePath,
        lastModified: new Date(),
        language: 'rust',
        moduleType: 'unknown',
        dependencies: this.extractRustDependencies(content),
      },
    };

    // Simple regex-based extraction for Rust doc comments
    const functionRegex = /\/\/\/([^\n]*(?:\n\/\/\/[^\n]*)*)\s*(?:pub\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const structRegex = /\/\/\/([^\n]*(?:\n\/\/\/[^\n]*)*)\s*(?:pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;

    let match;
    
    // Extract functions
    while ((match = functionRegex.exec(content)) !== null) {
      const [, docComment, name] = match;
      const parsedDoc = this.parseRustDocComment(docComment);
      
      documentation.functions.push({
        name,
        signature: `fn ${name}(...)`,
        documentation: {
          ...parsedDoc,
          location: {
            file: filePath,
            line: this.getLineNumber(content, match.index),
            column: 0,
          },
        },
        isExported: match[0].includes('pub fn'),
        isAsync: match[0].includes('async fn'),
      });
    }

    // Extract structs (treating as classes)
    while ((match = structRegex.exec(content)) !== null) {
      const [, docComment, name] = match;
      const parsedDoc = this.parseRustDocComment(docComment);
      
      documentation.classes.push({
        name,
        documentation: {
          ...parsedDoc,
          location: {
            file: filePath,
            line: this.getLineNumber(content, match.index),
            column: 0,
          },
        },
        methods: [],
        properties: [],
        isExported: match[0].includes('pub struct'),
      });
    }

    return documentation;
  }

  /**
   * Extract API endpoints from route files
   */
  private async extractAPIEndpoints(content: string, filePath: string): Promise<ExtractedDocumentation['apiEndpoints']> {
    const endpoints: ExtractedDocumentation['apiEndpoints'] = [];

    // Next.js App Router pattern
    const nextJSHandlerRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\([^)]*\)/g;
    let match;

    while ((match = nextJSHandlerRegex.exec(content)) !== null) {
      const method = match[1];
      const handlerIndex = match.index;
      
      // Extract the route path from file path
      const routePath = this.extractRoutePathFromFile(filePath);
      
      // Try to find JSDoc comment before the handler
      const beforeHandler = content.substring(0, handlerIndex);
      const docCommentMatch = beforeHandler.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
      
      let docComment: DocComment = {
        description: '',
        location: {
          file: filePath,
          line: this.getLineNumber(content, handlerIndex),
          column: 0,
        },
      };

      if (docCommentMatch) {
        docComment = this.parseJSDoc(docCommentMatch[1]);
        docComment.location = {
          file: filePath,
          line: this.getLineNumber(content, handlerIndex),
          column: 0,
        };
      }

      endpoints.push({
        path: routePath,
        method: method.toLowerCase(),
        handler: `${method} handler`,
        documentation: docComment,
        parameters: this.extractEndpointParameters(content, handlerIndex),
        responses: this.extractEndpointResponses(content, handlerIndex),
      });
    }

    return endpoints;
  }

  // Helper methods
  private detectLanguage(filePath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'rust' {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.rs':
        return 'rust';
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }
  }

  private detectModuleType(content: string): 'esm' | 'commonjs' | 'unknown' {
    if (content.includes('import ') || content.includes('export ')) {
      return 'esm';
    } else if (content.includes('require(') || content.includes('module.exports')) {
      return 'commonjs';
    }
    return 'unknown';
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // ESM imports
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    // CommonJS requires
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)];
  }

  private extractPythonDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /(?:from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import|import\s+([a-zA-Z_][a-zA-Z0-9_.]*))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1] || match[2]);
    }
    return [...new Set(dependencies)];
  }

  private extractJavaDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /import\s+(?:static\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    return [...new Set(dependencies)];
  }

  private extractRustDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const useRegex = /use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/g;
    let match;
    while ((match = useRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    return [...new Set(dependencies)];
  }

  private async findSourceFiles(directory: string): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.java',
      '**/*.rs',
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(path.join(directory, pattern), {
        ignore: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/.git/**'],
      });
      files.push(...matches);
    }

    return files;
  }

  private extractJSDocComment(path: any): DocComment {
    const comments = path.hub.file.ast.comments || [];
    const nodeStart = path.node.loc?.start.line || 0;
    
    // Find the closest preceding comment
    const precedingComment = comments
      .filter((comment: any) => comment.type === 'CommentBlock' && 
               comment.loc.end.line < nodeStart)
      .pop();

    if (precedingComment && precedingComment.value.startsWith('*')) {
      return this.parseJSDoc(precedingComment.value);
    }

    return {
      description: '',
      location: { file: '', line: 0, column: 0 },
    };
  }

  private extractTSDocComment(declaration: any): DocComment {
    // TypeScript parser specific logic
    return {
      description: declaration.comment || '',
      location: { file: '', line: 0, column: 0 },
    };
  }

  private parseJSDoc(comment: string): DocComment {
    const lines = comment.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
    let description = '';
    const params: DocComment['params'] = [];
    let returns: DocComment['returns'];
    const examples: string[] = [];
    const tags: Record<string, string> = {};
    let deprecated = false;
    let since: string | undefined;

    let currentSection: 'description' | 'example' | null = 'description';
    let currentExample = '';

    for (const line of lines) {
      if (line.startsWith('@param')) {
        currentSection = null;
        const match = line.match(/@param\s+(?:\{([^}]+)\}\s+)?(\w+)\s*(.*)$/);
        if (match) {
          params.push({
            name: match[2],
            type: match[1],
            description: match[3] || '',
            optional: match[2].includes('?'),
          });
        }
      } else if (line.startsWith('@returns') || line.startsWith('@return')) {
        currentSection = null;
        const match = line.match(/@returns?\s+(?:\{([^}]+)\}\s+)?(.*)$/);
        if (match) {
          returns = {
            type: match[1],
            description: match[2] || '',
          };
        }
      } else if (line.startsWith('@example')) {
        currentSection = 'example';
        currentExample = '';
      } else if (line.startsWith('@deprecated')) {
        deprecated = true;
        tags.deprecated = line.replace('@deprecated', '').trim();
      } else if (line.startsWith('@since')) {
        since = line.replace('@since', '').trim();
      } else if (line.startsWith('@')) {
        currentSection = null;
        const tagMatch = line.match(/@(\w+)\s*(.*)$/);
        if (tagMatch) {
          tags[tagMatch[1]] = tagMatch[2];
        }
      } else if (currentSection === 'description') {
        description += (description ? '\n' : '') + line;
      } else if (currentSection === 'example') {
        if (line === '' && currentExample) {
          examples.push(currentExample.trim());
          currentExample = '';
        } else {
          currentExample += (currentExample ? '\n' : '') + line;
        }
      }
    }

    if (currentExample) {
      examples.push(currentExample.trim());
    }

    return {
      description: description.trim(),
      params: params.length > 0 ? params : undefined,
      returns,
      examples: examples.length > 0 ? examples : undefined,
      deprecated,
      since,
      tags: Object.keys(tags).length > 0 ? tags : undefined,
      location: { file: '', line: 0, column: 0 },
    };
  }

  private parsePythonDocstring(docstring: string): DocComment {
    const lines = docstring.split('\n').map(line => line.trim());
    let description = '';
    const params: DocComment['params'] = [];
    let returns: DocComment['returns'];

    let currentSection: 'description' | 'args' | 'returns' | null = 'description';

    for (const line of lines) {
      if (line.toLowerCase().startsWith('args:') || line.toLowerCase().startsWith('parameters:')) {
        currentSection = 'args';
      } else if (line.toLowerCase().startsWith('returns:') || line.toLowerCase().startsWith('return:')) {
        currentSection = 'returns';
      } else if (currentSection === 'description' && line) {
        description += (description ? '\n' : '') + line;
      } else if (currentSection === 'args' && line) {
        const match = line.match(/(\w+)(?:\s*\(([^)]+)\))?\s*:\s*(.*)$/);
        if (match) {
          params.push({
            name: match[1],
            type: match[2],
            description: match[3] || '',
          });
        }
      } else if (currentSection === 'returns' && line) {
        returns = { description: line };
      }
    }

    return {
      description: description.trim(),
      params: params.length > 0 ? params : undefined,
      returns,
      location: { file: '', line: 0, column: 0 },
    };
  }

  private parseJavaDoc(javadoc: string): DocComment {
    const lines = javadoc.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
    let description = '';
    const params: DocComment['params'] = [];
    let returns: DocComment['returns'];

    for (const line of lines) {
      if (line.startsWith('@param')) {
        const match = line.match(/@param\s+(\w+)\s+(.*)$/);
        if (match) {
          params.push({
            name: match[1],
            description: match[2],
          });
        }
      } else if (line.startsWith('@return')) {
        returns = { description: line.replace('@return', '').trim() };
      } else if (!line.startsWith('@')) {
        description += (description ? '\n' : '') + line;
      }
    }

    return {
      description: description.trim(),
      params: params.length > 0 ? params : undefined,
      returns,
      location: { file: '', line: 0, column: 0 },
    };
  }

  private parseRustDocComment(comment: string): DocComment {
    const lines = comment.split('\n').map(line => line.trim().replace(/^\/\/\/\s?/, ''));
    const description = lines.filter(line => !line.startsWith('#')).join('\n').trim();

    return {
      description,
      location: { file: '', line: 0, column: 0 },
    };
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getFunctionSignature(node: any): string {
    // Simplified signature extraction
    return `${node.id.name}(${node.params.map((p: any) => p.name || '...').join(', ')})`;
  }

  private getArrowFunctionSignature(node: any, name: string): string {
    return `${name} = (${node.params.map((p: any) => p.name || '...').join(', ')}) => {...}`;
  }

  private getMethodSignature(node: any): string {
    return `${node.key.name}(${node.params.map((p: any) => p.name || '...').join(', ')})`;
  }

  private getMethodVisibility(node: any): 'public' | 'private' | 'protected' {
    if (node.key.name.startsWith('_')) return 'private';
    return 'public';
  }

  private getPropertyVisibility(node: any): 'public' | 'private' | 'protected' {
    if (node.key.name.startsWith('_')) return 'private';
    return 'public';
  }

  private getPropertyType(node: any): string | undefined {
    if (node.typeAnnotation?.typeAnnotation) {
      return 'any'; // Simplified type extraction
    }
    return undefined;
  }

  private getConstantValue(node: any): string | undefined {
    if (node.type === 'Literal') {
      return String(node.value);
    }
    return undefined;
  }

  private getVariableType(node: any): string | undefined {
    if (node.id.typeAnnotation?.typeAnnotation) {
      return 'any'; // Simplified type extraction
    }
    return undefined;
  }

  private isExported(path: any): boolean {
    return path.isExportDefaultDeclaration() || 
           path.isExportNamedDeclaration() ||
           (path.parent && path.parent.type === 'ExportNamedDeclaration');
  }

  private isRouteFile(filePath: string): boolean {
    return filePath.includes('/api/') || 
           filePath.includes('route.ts') || 
           filePath.includes('route.js');
  }

  private extractRoutePathFromFile(filePath: string): string {
    const apiIndex = filePath.indexOf('/api/');
    if (apiIndex === -1) return '/';
    
    const routePart = filePath.substring(apiIndex + 4);
    const pathWithoutFile = routePart.replace(/\/route\.(ts|js)$/, '');
    return '/' + pathWithoutFile.replace(/\[([^\]]+)\]/g, ':$1');
  }

  private extractEndpointParameters(content: string, handlerIndex: number): any[] {
    // Simplified parameter extraction
    return [];
  }

  private extractEndpointResponses(content: string, handlerIndex: number): Record<string, any> {
    // Simplified response extraction
    return {
      '200': { description: 'Success' },
    };
  }

  /**
   * Extract documentation from README.md files
   */
  async extractFromReadme(filePath: string): Promise<{
    metadata: any;
    content: string;
    sections: Array<{
      title: string;
      level: number;
      content: string;
      anchor: string;
    }>;
  }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(content);
    
    const sections: Array<{
      title: string;
      level: number;
      content: string;
      anchor: string;
    }> = [];

    const lines = parsed.content.split('\n');
    let currentSection: { title: string; level: number; content: string; anchor: string } | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        
        const level = headerMatch[1].length;
        const title = headerMatch[2];
        const anchor = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        currentSection = {
          title,
          level,
          content: '',
          anchor,
        };
      } else if (currentSection) {
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      metadata: parsed.data,
      content: parsed.content,
      sections,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxAge: this.cacheMaxAge,
    };
  }
}

export default DocumentationExtractor;