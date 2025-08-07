import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import remarkHtml from 'remark-html';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import rehypeHighlight from 'rehype-highlight';
import { visit } from 'unist-util-visit';
import matter from 'gray-matter';
import mermaid from 'mermaid';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProcessedMarkdown {
  html: string;
  metadata: Record<string, any>;
  toc: Array<{
    title: string;
    level: number;
    anchor: string;
    children?: Array<{
      title: string;
      level: number;
      anchor: string;
    }>;
  }>;
  diagrams: Array<{
    id: string;
    type: 'mermaid' | 'plantuml' | 'graphviz';
    source: string;
    svg?: string;
  }>;
  links: Array<{
    url: string;
    title?: string;
    isInternal: boolean;
    isValid?: boolean;
  }>;
  images: Array<{
    src: string;
    alt?: string;
    title?: string;
    width?: number;
    height?: number;
  }>;
  codeBlocks: Array<{
    language: string;
    code: string;
    highlighted: string;
    lineNumbers?: boolean;
    filename?: string;
  }>;
  wordCount: number;
  readingTime: number; // in minutes
  lastModified?: Date;
}

export interface MarkdownProcessorOptions {
  enableToc?: boolean;
  enableSyntaxHighlighting?: boolean;
  enableMermaid?: boolean;
  enableLinkValidation?: boolean;
  enableImageOptimization?: boolean;
  tocDepth?: number;
  baseUrl?: string;
  assetsPath?: string;
  customDirectives?: Record<string, (node: any) => void>;
}

export class MarkdownProcessor {
  private cache: Map<string, { content: ProcessedMarkdown; lastModified: number }> = new Map();
  private cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  private mermaidInitialized = false;

  constructor(
    private options: MarkdownProcessorOptions = {}
  ) {
    this.options = {
      enableToc: true,
      enableSyntaxHighlighting: true,
      enableMermaid: true,
      enableLinkValidation: false, // Disabled by default for performance
      enableImageOptimization: false,
      tocDepth: 3,
      baseUrl: '',
      assetsPath: '/assets',
      ...options,
    };

    this.initializeMermaid();
  }

  /**
   * Process markdown content from string
   */
  async processMarkdown(content: string, filePath?: string): Promise<ProcessedMarkdown> {
    const cacheKey = filePath || content;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.lastModified < this.cacheMaxAge) {
      return cached.content;
    }

    // Parse frontmatter
    const parsed = matter(content);
    const markdownContent = parsed.content;
    const metadata = parsed.data;

    // Initialize result
    const result: ProcessedMarkdown = {
      html: '',
      metadata,
      toc: [],
      diagrams: [],
      links: [],
      images: [],
      codeBlocks: [],
      wordCount: this.countWords(markdownContent),
      readingTime: this.calculateReadingTime(markdownContent),
      lastModified: filePath ? await this.getFileModifiedTime(filePath) : new Date(),
    };

    // Build unified processor
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkFrontmatter);

    // Add ToC generation if enabled
    if (this.options.enableToc) {
      processor = processor.use(remarkToc, {
        maxDepth: this.options.tocDepth,
        tight: true,
      });
    }

    // Add custom directive support
    processor = processor.use(remarkDirective);

    // Add custom plugins
    processor = processor
      .use(() => (tree) => {
        // Extract table of contents
        if (this.options.enableToc) {
          result.toc = this.extractToc(tree);
        }

        // Extract diagrams
        if (this.options.enableMermaid) {
          result.diagrams = this.extractDiagrams(tree);
        }

        // Extract links
        result.links = this.extractLinks(tree);

        // Extract images
        result.images = this.extractImages(tree);

        // Extract code blocks
        result.codeBlocks = this.extractCodeBlocks(tree);

        // Process custom directives
        this.processCustomDirectives(tree);

        // Enhance links
        this.enhanceLinks(tree);

        // Optimize images
        if (this.options.enableImageOptimization) {
          this.optimizeImages(tree);
        }
      });

    // Convert to HTML
    processor = processor.use(remarkHtml, { sanitize: false });

    // Apply syntax highlighting if enabled
    if (this.options.enableSyntaxHighlighting) {
      processor = processor
        .use(rehypeParse, { fragment: true })
        .use(rehypeHighlight, {
          detect: true,
          ignoreMissing: true,
        })
        .use(rehypeStringify);
    }

    // Process the markdown
    const vfile = await processor.process(markdownContent);
    result.html = String(vfile);

    // Process Mermaid diagrams
    if (this.options.enableMermaid && result.diagrams.length > 0) {
      await this.renderMermaidDiagrams(result);
    }

    // Validate links if enabled
    if (this.options.enableLinkValidation) {
      await this.validateLinks(result);
    }

    // Post-process HTML
    result.html = await this.postProcessHtml(result.html, result);

    // Cache the result
    this.cache.set(cacheKey, {
      content: result,
      lastModified: Date.now(),
    });

    return result;
  }

  /**
   * Process markdown file
   */
  async processMarkdownFile(filePath: string): Promise<ProcessedMarkdown> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.processMarkdown(content, filePath);
  }

  /**
   * Process multiple markdown files
   */
  async processMarkdownFiles(filePaths: string[]): Promise<Map<string, ProcessedMarkdown>> {
    const results = new Map<string, ProcessedMarkdown>();
    
    const processingPromises = filePaths.map(async (filePath) => {
      try {
        const processed = await this.processMarkdownFile(filePath);
        results.set(filePath, processed);
      } catch (error) {
        console.warn(`Failed to process markdown file ${filePath}:`, error);
      }
    });

    await Promise.all(processingPromises);
    return results;
  }

  /**
   * Extract table of contents from AST
   */
  private extractToc(tree: any): ProcessedMarkdown['toc'] {
    const toc: ProcessedMarkdown['toc'] = [];
    const headingStack: Array<{ level: number; item: any }> = [];

    visit(tree, 'heading', (node) => {
      if (node.depth <= (this.options.tocDepth || 3)) {
        const title = this.extractTextFromNode(node);
        const anchor = this.generateAnchor(title);

        const tocItem = {
          title,
          level: node.depth,
          anchor,
        };

        // Handle nesting
        while (
          headingStack.length > 0 && 
          headingStack[headingStack.length - 1].level >= node.depth
        ) {
          headingStack.pop();
        }

        if (headingStack.length === 0) {
          toc.push(tocItem);
        } else {
          const parent = headingStack[headingStack.length - 1].item;
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(tocItem);
        }

        headingStack.push({ level: node.depth, item: tocItem });
      }
    });

    return toc;
  }

  /**
   * Extract diagrams from code blocks
   */
  private extractDiagrams(tree: any): ProcessedMarkdown['diagrams'] {
    const diagrams: ProcessedMarkdown['diagrams'] = [];

    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid') {
        diagrams.push({
          id: `mermaid-${diagrams.length}`,
          type: 'mermaid',
          source: node.value,
        });
      } else if (node.lang === 'plantuml') {
        diagrams.push({
          id: `plantuml-${diagrams.length}`,
          type: 'plantuml',
          source: node.value,
        });
      } else if (node.lang === 'graphviz' || node.lang === 'dot') {
        diagrams.push({
          id: `graphviz-${diagrams.length}`,
          type: 'graphviz',
          source: node.value,
        });
      }
    });

    return diagrams;
  }

  /**
   * Extract links from AST
   */
  private extractLinks(tree: any): ProcessedMarkdown['links'] {
    const links: ProcessedMarkdown['links'] = [];

    visit(tree, 'link', (node) => {
      const url = node.url;
      const title = node.title;
      const isInternal = this.isInternalLink(url);

      links.push({
        url,
        title,
        isInternal,
      });
    });

    return links;
  }

  /**
   * Extract images from AST
   */
  private extractImages(tree: any): ProcessedMarkdown['images'] {
    const images: ProcessedMarkdown['images'] = [];

    visit(tree, 'image', (node) => {
      images.push({
        src: node.url,
        alt: node.alt,
        title: node.title,
      });
    });

    return images;
  }

  /**
   * Extract code blocks from AST
   */
  private extractCodeBlocks(tree: any): ProcessedMarkdown['codeBlocks'] {
    const codeBlocks: ProcessedMarkdown['codeBlocks'] = [];

    visit(tree, 'code', (node) => {
      if (node.lang !== 'mermaid' && node.lang !== 'plantuml' && node.lang !== 'graphviz') {
        const meta = node.meta || '';
        const hasLineNumbers = meta.includes('line-numbers');
        const filenameMatch = meta.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : undefined;

        codeBlocks.push({
          language: node.lang || 'text',
          code: node.value,
          highlighted: '', // Will be filled later
          lineNumbers: hasLineNumbers,
          filename,
        });
      }
    });

    return codeBlocks;
  }

  /**
   * Process custom directives
   */
  private processCustomDirectives(tree: any): void {
    visit(tree, (node) => {
      if (node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective') {
        const directiveName = node.name;
        const customHandler = this.options.customDirectives?.[directiveName];
        
        if (customHandler) {
          customHandler(node);
        } else {
          // Handle built-in directives
          this.handleBuiltInDirective(node);
        }
      }
    });
  }

  /**
   * Handle built-in directives
   */
  private handleBuiltInDirective(node: any): void {
    switch (node.name) {
      case 'note':
        node.type = 'html';
        node.value = `<div class="note">${this.extractTextFromNode(node)}</div>`;
        break;
      case 'warning':
        node.type = 'html';
        node.value = `<div class="warning">${this.extractTextFromNode(node)}</div>`;
        break;
      case 'info':
        node.type = 'html';
        node.value = `<div class="info">${this.extractTextFromNode(node)}</div>`;
        break;
      case 'tip':
        node.type = 'html';
        node.value = `<div class="tip">${this.extractTextFromNode(node)}</div>`;
        break;
      default:
        // Unknown directive, leave as-is
        break;
    }
  }

  /**
   * Enhance links with additional attributes
   */
  private enhanceLinks(tree: any): void {
    visit(tree, 'link', (node) => {
      // Add target="_blank" for external links
      if (!this.isInternalLink(node.url)) {
        if (!node.data) node.data = {};
        if (!node.data.hProperties) node.data.hProperties = {};
        node.data.hProperties.target = '_blank';
        node.data.hProperties.rel = 'noopener noreferrer';
      }

      // Add classes based on link type
      if (node.url.startsWith('mailto:')) {
        if (!node.data) node.data = {};
        if (!node.data.hProperties) node.data.hProperties = {};
        node.data.hProperties.className = ['email-link'];
      } else if (node.url.startsWith('tel:')) {
        if (!node.data) node.data = {};
        if (!node.data.hProperties) node.data.hProperties = {};
        node.data.hProperties.className = ['tel-link'];
      }
    });
  }

  /**
   * Optimize images
   */
  private optimizeImages(tree: any): void {
    visit(tree, 'image', (node) => {
      // Convert relative URLs to absolute
      if (node.url.startsWith('./') || node.url.startsWith('../')) {
        node.url = path.join(this.options.assetsPath || '/assets', node.url);
      }

      // Add loading="lazy" for performance
      if (!node.data) node.data = {};
      if (!node.data.hProperties) node.data.hProperties = {};
      node.data.hProperties.loading = 'lazy';

      // Add responsive image attributes
      node.data.hProperties.style = 'max-width: 100%; height: auto;';
    });
  }

  /**
   * Initialize Mermaid
   */
  private async initializeMermaid(): Promise<void> {
    if (this.options.enableMermaid && !this.mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'sandbox',
        fontFamily: 'monospace',
      });
      this.mermaidInitialized = true;
    }
  }

  /**
   * Render Mermaid diagrams
   */
  private async renderMermaidDiagrams(result: ProcessedMarkdown): Promise<void> {
    for (const diagram of result.diagrams) {
      if (diagram.type === 'mermaid') {
        try {
          const { svg } = await mermaid.render(diagram.id, diagram.source);
          diagram.svg = svg;
        } catch (error) {
          console.warn(`Failed to render Mermaid diagram ${diagram.id}:`, error);
        }
      }
    }
  }

  /**
   * Validate links
   */
  private async validateLinks(result: ProcessedMarkdown): Promise<void> {
    const validationPromises = result.links.map(async (link) => {
      if (link.isInternal) {
        // Check if internal file exists
        try {
          const fullPath = path.resolve(process.cwd(), link.url.replace(/^\//, ''));
          await fs.access(fullPath);
          link.isValid = true;
        } catch {
          link.isValid = false;
        }
      } else {
        // Check external link (simplified - just check if URL is well-formed)
        try {
          new URL(link.url);
          link.isValid = true;
          // Note: Full HTTP validation would require actual HTTP requests
          // which could be expensive and slow
        } catch {
          link.isValid = false;
        }
      }
    });

    await Promise.all(validationPromises);
  }

  /**
   * Post-process HTML
   */
  private async postProcessHtml(html: string, result: ProcessedMarkdown): Promise<string> {
    let processedHtml = html;

    // Replace Mermaid code blocks with rendered SVG
    for (const diagram of result.diagrams) {
      if (diagram.type === 'mermaid' && diagram.svg) {
        const codeBlockRegex = new RegExp(
          `<pre><code class="language-mermaid">[\\s\\S]*?</code></pre>`,
          'g'
        );
        
        processedHtml = processedHtml.replace(codeBlockRegex, 
          `<div class="mermaid-diagram" id="${diagram.id}">${diagram.svg}</div>`
        );
      }
    }

    // Add anchor IDs to headings
    processedHtml = processedHtml.replace(
      /<h([1-6])>(.*?)<\/h[1-6]>/g,
      (match, level, content) => {
        const anchor = this.generateAnchor(content);
        return `<h${level} id="${anchor}"><a href="#${anchor}" class="heading-anchor">#</a>${content}</h${level}>`;
      }
    );

    // Add copy buttons to code blocks
    processedHtml = processedHtml.replace(
      /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      (match, language, code) => {
        return `
          <div class="code-block-container">
            <div class="code-block-header">
              <span class="code-block-language">${language}</span>
              <button class="code-block-copy" onclick="navigator.clipboard.writeText(this.nextElementSibling.querySelector('code').textContent)">
                Copy
              </button>
            </div>
            ${match}
          </div>
        `;
      }
    );

    return processedHtml;
  }

  /**
   * Generate table of contents HTML
   */
  generateTocHtml(toc: ProcessedMarkdown['toc']): string {
    if (toc.length === 0) return '';

    const renderTocLevel = (items: ProcessedMarkdown['toc']): string => {
      return `
        <ul class="toc-list">
          ${items.map(item => `
            <li class="toc-item toc-level-${item.level}">
              <a href="#${item.anchor}" class="toc-link">${item.title}</a>
              ${item.children ? renderTocLevel(item.children) : ''}
            </li>
          `).join('')}
        </ul>
      `;
    };

    return `
      <nav class="table-of-contents">
        <h2 class="toc-title">Table of Contents</h2>
        ${renderTocLevel(toc)}
      </nav>
    `;
  }

  /**
   * Generate reading time estimate
   */
  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Count words in content
   */
  private countWords(content: string): number {
    return content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/[^a-zA-Z0-9\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Extract text content from AST node
   */
  private extractTextFromNode(node: any): string {
    if (node.type === 'text') {
      return node.value;
    }
    
    if (node.children) {
      return node.children.map((child: any) => this.extractTextFromNode(child)).join('');
    }
    
    return '';
  }

  /**
   * Generate anchor from text
   */
  private generateAnchor(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Check if link is internal
   */
  private isInternalLink(url: string): boolean {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (this.options.baseUrl) {
        return url.startsWith(this.options.baseUrl);
      }
      return false;
    }
    return true; // Relative links are considered internal
  }

  /**
   * Get file modification time
   */
  private async getFileModifiedTime(filePath: string): Promise<Date | undefined> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime;
    } catch {
      return undefined;
    }
  }

  /**
   * Export processed markdown to different formats
   */
  async exportToFormat(
    processed: ProcessedMarkdown, 
    format: 'html' | 'pdf' | 'docx',
    outputPath: string
  ): Promise<void> {
    switch (format) {
      case 'html':
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Document</title>
            <style>
              ${this.getDefaultCSS()}
            </style>
          </head>
          <body>
            ${this.generateTocHtml(processed.toc)}
            ${processed.html}
          </body>
          </html>
        `;
        await fs.writeFile(outputPath, htmlContent, 'utf-8');
        break;
      
      case 'pdf':
        // Note: PDF generation would require additional dependencies like puppeteer
        throw new Error('PDF export not implemented - would require puppeteer');
      
      case 'docx':
        // Note: DOCX generation would require additional dependencies
        throw new Error('DOCX export not implemented - would require docx library');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get default CSS for HTML export
   */
  private getDefaultCSS(): string {
    return `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        color: #333;
      }

      .table-of-contents {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 2rem;
      }

      .toc-title {
        margin-top: 0;
        color: #555;
      }

      .toc-list {
        list-style: none;
        padding-left: 0;
      }

      .toc-item {
        margin: 0.25rem 0;
        padding-left: 1rem;
      }

      .toc-level-2 { padding-left: 2rem; }
      .toc-level-3 { padding-left: 3rem; }

      .toc-link {
        color: #0066cc;
        text-decoration: none;
      }

      .toc-link:hover {
        text-decoration: underline;
      }

      .heading-anchor {
        color: #ccc;
        text-decoration: none;
        margin-right: 0.5rem;
        opacity: 0;
      }

      h1:hover .heading-anchor,
      h2:hover .heading-anchor,
      h3:hover .heading-anchor,
      h4:hover .heading-anchor,
      h5:hover .heading-anchor,
      h6:hover .heading-anchor {
        opacity: 1;
      }

      .code-block-container {
        position: relative;
        margin: 1rem 0;
      }

      .code-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #2d3748;
        color: white;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        border-radius: 0.375rem 0.375rem 0 0;
      }

      .code-block-copy {
        background: #4a5568;
        border: none;
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.75rem;
      }

      .code-block-copy:hover {
        background: #2d3748;
      }

      pre {
        margin: 0;
        border-radius: 0 0 0.375rem 0.375rem;
        overflow-x: auto;
      }

      .mermaid-diagram {
        text-align: center;
        margin: 2rem 0;
      }

      .note, .warning, .info, .tip {
        padding: 1rem;
        margin: 1rem 0;
        border-left: 4px solid;
        border-radius: 0.25rem;
      }

      .note {
        background: #f0f4f8;
        border-color: #0066cc;
      }

      .warning {
        background: #fff8f0;
        border-color: #ff8c00;
      }

      .info {
        background: #f0f8ff;
        border-color: #1e90ff;
      }

      .tip {
        background: #f0fff4;
        border-color: #32cd32;
      }
    `;
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

export default MarkdownProcessor;