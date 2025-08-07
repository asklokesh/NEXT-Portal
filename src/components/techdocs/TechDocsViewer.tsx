'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileText,
  Code,
  Hash,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TechDocsViewerProps {
  entity: any;
  path: string;
  theme?: 'light' | 'dark';
  className?: string;
}

export function TechDocsViewer({
  entity,
  path,
  theme = 'light',
  className,
}: TechDocsViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchDocContent();
  }, [entity, path]);

  const fetchDocContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate fetching markdown content
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock markdown content
      const mockContent = `# ${entity.metadata?.title || entity.name}

${entity.metadata?.description || entity.description || ''}

## Overview

This is the technical documentation for **${entity.name}**. This service is maintained by ${entity.owner || 'the platform team'}.

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Getting Started

To get started with ${entity.name}, follow these steps:

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Run the service

### Prerequisites

- Node.js 18+
- Docker
- Kubernetes cluster (for production)

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/example/${entity.name}.git

# Navigate to the project directory
cd ${entity.name}

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
\`\`\`

## Configuration

The service can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|--------|
| \`PORT\` | Service port | \`3000\` |
| \`DATABASE_URL\` | Database connection string | \`postgresql://localhost\` |
| \`LOG_LEVEL\` | Logging level | \`info\` |
| \`API_KEY\` | API authentication key | Required |

### Example Configuration

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${entity.name}-config
data:
  PORT: "3000"
  LOG_LEVEL: "debug"
\`\`\`

## API Reference

The service exposes the following endpoints:

### \`GET /health\`

Health check endpoint.

**Response:**
\`\`\`json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600
}
\`\`\`

### \`POST /api/users\`

Create a new user.

**Request Body:**
\`\`\`json
{
  "name": "John Doe",
  "email": "john@example.com"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
\`\`\`

## Deployment

### Docker

\`\`\`bash
# Build the Docker image
docker build -t ${entity.name}:latest .

# Run the container
docker run -p 3000:3000 ${entity.name}:latest
\`\`\`

### Kubernetes

\`\`\`bash
# Apply the Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=${entity.name}
\`\`\`

> **Note:** Make sure to configure the appropriate resource limits and requests.

> **Warning:** Always use secrets for sensitive configuration values.

> **Info:** The service automatically scales based on CPU usage.

> **Success:** Deployment typically completes within 2-3 minutes.

## Troubleshooting

### Common Issues

#### Service won't start

- Check that all required environment variables are set
- Verify database connectivity
- Review logs: \`kubectl logs -l app=${entity.name}\`

#### High memory usage

- Adjust Node.js heap size: \`NODE_OPTIONS="--max-old-space-size=2048"\`
- Enable memory profiling
- Review for memory leaks

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please contact ${entity.owner || 'the platform team'} or create an issue in the repository.

---

*Last updated: ${new Date().toLocaleDateString()}*
*Version: ${entity.metadata?.version || '1.0.0'}*
`;
      
      setContent(mockContent);
    } catch (err) {
      setError('Failed to load documentation');
      console.error('Error loading docs:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("prose prose-slate dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkToc]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
        ]}
        components={{
          // Custom heading renderer
          h1: ({ children, ...props }) => (
            <h1 className="text-3xl font-bold mb-4 flex items-center gap-2" {...props}>
              <Hash className="h-6 w-6 text-muted-foreground" />
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-2xl font-semibold mb-3 mt-8 flex items-center gap-2" {...props}>
              <Hash className="h-5 w-5 text-muted-foreground" />
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-xl font-semibold mb-2 mt-6" {...props}>
              {children}
            </h3>
          ),
          
          // Custom code block renderer
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');
            
            if (!inline) {
              return (
                <div className="relative group my-4">
                  <div className="absolute right-2 top-2 z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeString)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedCode === codeString ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <SyntaxHighlighter
                    language={language}
                    style={theme === 'dark' ? oneDark : oneLight}
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }
            
            return (
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          
          // Custom link renderer
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 inline-flex items-center gap-1"
              {...props}
            >
              {children}
              {href?.startsWith('http') && <ExternalLink className="h-3 w-3" />}
            </a>
          ),
          
          // Custom blockquote renderer for alerts
          blockquote: ({ children, ...props }) => {
            const text = String(children);
            
            if (text.includes('**Note:**')) {
              return (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{children}</AlertDescription>
                </Alert>
              );
            }
            
            if (text.includes('**Warning:**')) {
              return (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{children}</AlertDescription>
                </Alert>
              );
            }
            
            if (text.includes('**Success:**')) {
              return (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{children}</AlertDescription>
                </Alert>
              );
            }
            
            if (text.includes('**Info:**')) {
              return (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{children}</AlertDescription>
                </Alert>
              );
            }
            
            return (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic" {...props}>
                {children}
              </blockquote>
            );
          },
          
          // Custom table renderer
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700" {...props}>
                {children}
              </table>
            </div>
          ),
          
          thead: ({ children, ...props }) => (
            <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
              {children}
            </thead>
          ),
          
          th: ({ children, ...props }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold" {...props}>
              {children}
            </th>
          ),
          
          td: ({ children, ...props }) => (
            <td className="px-4 py-2 text-sm" {...props}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}