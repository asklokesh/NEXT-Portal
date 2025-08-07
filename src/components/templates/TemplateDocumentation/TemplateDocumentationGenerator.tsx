'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 FileText,
 Download,
 Eye,
 Settings,
 Copy,
 Check,
 RefreshCw,
 Wand2,
 Book,
 Code,
 Users,
 Calendar,
 Tag,
 Package,
 GitBranch,
 Play,
 ExternalLink,
 ArrowRight,
 ChevronDown,
 ChevronRight,
 Info,
 AlertTriangle,
 CheckCircle
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';
import { useTemplate } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity, TemplateParameters } from '@/services/backstage/types/templates';

interface TemplateDocumentationGeneratorProps {
 templateRef: string;
 className?: string;
}

interface DocumentationSection {
 id: string;
 title: string;
 content: string;
 enabled: boolean;
 generated: boolean;
}

interface DocumentationConfig {
 format: 'markdown' | 'html' | 'pdf';
 includeTableOfContents: boolean;
 includeExamples: boolean;
 includeParameterDetails: boolean;
 includeStepByStep: boolean;
 includeTroubleshooting: boolean;
 includeContributingGuide: boolean;
 customSections: Array<{ title: string; content: string }>;
}

const DOCUMENTATION_TEMPLATES = {
 basic: {
 name: 'Basic Documentation',
 description: 'Essential template information and usage',
 sections: ['overview', 'parameters', 'usage', 'output'],
 },
 comprehensive: {
 name: 'Comprehensive Guide',
 description: 'Complete documentation with examples and troubleshooting',
 sections: ['overview', 'prerequisites', 'parameters', 'usage', 'examples', 'output', 'troubleshooting', 'contributing'],
 },
 developer: {
 name: 'Developer Guide',
 description: 'Technical documentation for developers',
 sections: ['overview', 'architecture', 'parameters', 'steps', 'customization', 'examples', 'troubleshooting'],
 },
 user: {
 name: 'User Manual',
 description: 'User-friendly guide for non-technical users',
 sections: ['overview', 'getting-started', 'parameters', 'step-by-step', 'examples', 'support'],
 },
};

const DocumentationPreview: React.FC<{
 sections: DocumentationSection[];
 format: 'markdown' | 'html';
}> = ({ sections, format }) => {
 const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

 const toggleSection = (sectionId: string) => {
 const newExpanded = new Set(expandedSections);
 if (newExpanded.has(sectionId)) {
 newExpanded.delete(sectionId);
 } else {
 newExpanded.add(sectionId);
 }
 setExpandedSections(newExpanded);
 };

 return (
 <div className="border rounded-lg overflow-hidden">
 <div className="bg-muted/50 px-4 py-2 border-b">
 <h4 className="font-medium">Documentation Preview</h4>
 </div>
 
 <div className="max-h-96 overflow-y-auto">
 {sections.filter(s => s.enabled).map((section) => (
 <div key={section.id} className="border-b last:border-b-0">
 <button
 onClick={() => toggleSection(section.id)}
 className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="font-medium">{section.title}</span>
 {section.generated && (
 <CheckCircle className="w-4 h-4 text-green-600" />
 )}
 </div>
 {expandedSections.has(section.id) ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 </button>
 
 {expandedSections.has(section.id) && (
 <div className="px-4 pb-4">
 <div className={cn(
 'p-3 rounded bg-muted/30 text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto',
 format === 'html' ? 'text-blue-800' : 'text-gray-800'
 )}>
 {section.content || 'Content will be generated...'}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
};

export const TemplateDocumentationGenerator: React.FC<TemplateDocumentationGeneratorProps> = ({
 templateRef,
 className,
}) => {
 const [activeTab, setActiveTab] = useState<'configure' | 'preview' | 'export'>('configure');
 const [isGenerating, setIsGenerating] = useState(false);
 const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof DOCUMENTATION_TEMPLATES>('comprehensive');
 const [config, setConfig] = useState<DocumentationConfig>({
 format: 'markdown',
 includeTableOfContents: true,
 includeExamples: true,
 includeParameterDetails: true,
 includeStepByStep: true,
 includeTroubleshooting: true,
 includeContributingGuide: false,
 customSections: [],
 });

 const { data: template } = useTemplate(templateRef);

 // Generate documentation sections
 const documentationSections = useMemo((): DocumentationSection[] => {
 if (!template) return [];

 const parameters = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;

 const sections: DocumentationSection[] = [
 {
 id: 'overview',
 title: 'Overview',
 enabled: true,
 generated: true,
 content: `# ${template.metadata.title || template.metadata.name}

${template.metadata.description || 'No description provided.'}

## Template Information

- **Type**: ${template.spec.type}
- **Owner**: ${template.spec.owner}
- **Namespace**: ${template.metadata.namespace || 'default'}
- **Version**: Latest

## Tags

${template.metadata.tags?.map(tag => `- ${tag}`).join('\n') || 'No tags specified.'}`,
 },
 {
 id: 'prerequisites',
 title: 'Prerequisites',
 enabled: true,
 generated: true,
 content: `## Prerequisites

Before using this template, ensure you have:

- Access to Backstage instance
- Appropriate permissions to create ${template.spec.type} projects
- Understanding of the target technology stack
- Development environment set up

### Required Tools

- Git
- Node.js (if applicable)
- Docker (if applicable)
- IDE or text editor`,
 },
 {
 id: 'parameters',
 title: 'Parameters',
 enabled: true,
 generated: true,
 content: `## Template Parameters

This template accepts the following parameters:

${Object.entries(parameters.properties).map(([key, prop]) => {
 const isRequired = parameters.required?.includes(key);
 return `### ${prop.title || key}${isRequired ? ' **(Required)**' : ''}

- **Type**: ${prop.type}
- **Description**: ${prop.description || 'No description provided'}
${prop.default ? `- **Default**: \`${prop.default}\`` : ''}
${prop.enum ? `- **Options**: ${prop.enum.map(v => `\`${v}\``).join(', ')}` : ''}
${prop.pattern ? `- **Pattern**: \`${prop.pattern}\`` : ''}`;
}).join('\n\n')}

### Required Parameters

${parameters.required?.map(param => `- **${param}**: ${parameters.properties[param]?.description || 'No description'}`).join('\n') || 'No required parameters.'}`,
 },
 {
 id: 'usage',
 title: 'Usage Instructions',
 enabled: true,
 generated: true,
 content: `## How to Use This Template

1. **Navigate to Template**: Go to the Backstage template catalog
2. **Select Template**: Find and click on "${template.metadata.title || template.metadata.name}"
3. **Fill Parameters**: Complete all required fields in the form
4. **Review**: Check your inputs before proceeding
5. **Execute**: Click "Create" to generate your project

### Quick Start

\`\`\`bash
# Template will be executed through Backstage UI
# No command-line execution required
\`\`\``,
 },
 {
 id: 'steps',
 title: 'Template Steps',
 enabled: true,
 generated: true,
 content: `## Template Execution Steps

This template performs the following steps:

${template.spec.steps.map((step, index) => `${index + 1}. **${step.name || step.action}**
 - Action: \`${step.action}\`
 - ${step.if ? `Conditional: \`${step.if}\`` : 'Always executed'}`).join('\n\n')}

### Step Details

${template.spec.steps.map((step, index) => `#### Step ${index + 1}: ${step.name || step.action}

**Action**: \`${step.action}\`

${step.input ? Object.entries(step.input).map(([key, value]) => `- **${key}**: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n') : 'No specific input configuration.'}

${step.if ? `**Condition**: This step only runs if: \`${step.if}\`` : ''}`).join('\n\n')}`,
 },
 {
 id: 'examples',
 title: 'Examples',
 enabled: config.includeExamples,
 generated: true,
 content: `## Usage Examples

### Example 1: Basic ${template.spec.type}

\`\`\`json
{
${Object.entries(parameters.properties).slice(0, 3).map(([key, prop]) => ` "${key}": "${prop.default || `example-${key}`}"`).join(',\n')}
}
\`\`\`

### Example 2: Advanced Configuration

\`\`\`json
{
${Object.entries(parameters.properties).map(([key, prop]) => ` "${key}": "${prop.default || `advanced-${key}`}"`).join(',\n')}
}
\`\`\`

### Common Use Cases

1. **Development Environment**: Quick setup for local development
2. **Production Deployment**: Production-ready configuration
3. **Testing**: Configuration for automated testing`,
 },
 {
 id: 'output',
 title: 'Generated Output',
 enabled: true,
 generated: true,
 content: `## What Gets Generated

After successful execution, this template creates:

### Repository Structure

\`\`\`
project-name/
├── README.md
├── catalog-info.yaml
├── src/
│ └── (application code)
├── docs/
│ └── (documentation)
└── .github/
 └── workflows/
 └── (CI/CD pipelines)
\`\`\`

### Generated Files

- **README.md**: Project documentation
- **catalog-info.yaml**: Backstage catalog registration
- **Source code**: Application scaffolding
- **CI/CD**: Automated build and deployment pipelines

### Next Steps

1. Clone the generated repository
2. Follow the README instructions
3. Customize the code for your needs
4. Set up development environment`,
 },
 {
 id: 'troubleshooting',
 title: 'Troubleshooting',
 enabled: config.includeTroubleshooting,
 generated: true,
 content: `## Troubleshooting

### Common Issues

#### Template Execution Fails

**Symptoms**: Template execution stops with an error

**Solutions**:
- Check all required parameters are filled
- Verify repository permissions
- Ensure unique naming for resources

#### Generated Repository Not Accessible

**Symptoms**: Cannot access the created repository

**Solutions**:
- Check repository permissions
- Verify organization/namespace exists
- Confirm Git provider integration

#### Missing Dependencies

**Symptoms**: Build failures in generated project

**Solutions**:
- Update package.json dependencies
- Check environment requirements
- Verify build tool versions

### Getting Help

- Check Backstage logs for detailed errors
- Contact the template maintainer: ${template.spec.owner}
- Review template documentation
- Submit issues to the template repository`,
 },
 {
 id: 'contributing',
 title: 'Contributing Guide',
 enabled: config.includeContributingGuide,
 generated: true,
 content: `## Contributing to This Template

### How to Contribute

1. **Fork the template repository**
2. **Make your changes**
3. **Test your modifications**
4. **Submit a pull request**

### Development Setup

\`\`\`bash
# Clone the template
git clone <template-repository>

# Install dependencies
npm install

# Test the template
npm run test
\`\`\`

### Template Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure backwards compatibility

### Reporting Issues

When reporting issues, include:
- Template version
- Input parameters used
- Error messages
- Expected vs actual behavior

### Contact

- **Owner**: ${template.spec.owner}
- **Repository**: [Template Repository](#)
- **Issues**: [Issue Tracker](#)`,
 },
 ];

 return sections;
 }, [template, config]);

 const generateDocumentation = async () => {
 setIsGenerating(true);
 
 // Simulate generation delay
 await new Promise(resolve => setTimeout(resolve, 2000));
 
 // In real implementation, this would call an API to generate documentation
 console.log('Generating documentation with config:', config);
 
 setIsGenerating(false);
 setActiveTab('preview');
 };

 const exportDocumentation = () => {
 const enabledSections = documentationSections.filter(s => s.enabled);
 const content = enabledSections.map(s => s.content).join('\n\n---\n\n');
 
 let fileName: string;
 let mimeType: string;
 let fileContent: string;

 switch (config.format) {
 case 'markdown':
 fileName = `${template?.metadata.name || 'template'}-documentation.md`;
 mimeType = 'text/markdown';
 fileContent = content;
 break;
 case 'html':
 fileName = `${template?.metadata.name || 'template'}-documentation.html`;
 mimeType = 'text/html';
 fileContent = `<!DOCTYPE html>
<html>
<head>
 <title>${template?.metadata.title || template?.metadata.name} Documentation</title>
 <style>
 body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
 h1, h2, h3 { color: #333; }
 code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
 pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
 </style>
</head>
<body>
${content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
</body>
</html>`;
 break;
 default:
 fileName = `${template?.metadata.name || 'template'}-documentation.txt`;
 mimeType = 'text/plain';
 fileContent = content;
 }

 const blob = new Blob([fileContent], { type: mimeType });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = fileName;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 if (!template) {
 return (
 <div className={cn('flex items-center justify-center h-64', className)}>
 <div className="text-center">
 <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-foreground" />
 <p className="text-muted-foreground">Loading template...</p>
 </div>
 </div>
 );
 }

 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <FileText className="w-6 h-6 text-primary" />
 <div>
 <h2 className="text-2xl font-bold">Documentation Generator</h2>
 <p className="text-sm text-muted-foreground">
 Generate comprehensive documentation for "{template.metadata.title || template.metadata.name}"
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {activeTab === 'preview' && (
 <button
 onClick={exportDocumentation}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent"
 >
 <Download className="w-4 h-4" />
 Export
 </button>
 )}
 
 <button
 onClick={generateDocumentation}
 disabled={isGenerating}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isGenerating ? (
 <>
 <RefreshCw className="w-4 h-4 animate-spin" />
 Generating...
 </>
 ) : (
 <>
 <Wand2 className="w-4 h-4" />
 Generate
 </>
 )}
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex border-b">
 {[
 { id: 'configure', label: 'Configure', icon: Settings },
 { id: 'preview', label: 'Preview', icon: Eye },
 { id: 'export', label: 'Export', icon: Download },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 'flex items-center gap-1 px-4 py-2 text-sm transition-colors border-b-2',
 activeTab === tab.id
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 <tab.icon className="w-4 h-4" />
 {tab.label}
 </button>
 ))}
 </div>

 {/* Content */}
 {activeTab === 'configure' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Configuration */}
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Documentation Template</h3>
 <div className="space-y-3">
 {Object.entries(DOCUMENTATION_TEMPLATES).map(([key, template]) => (
 <label
 key={key}
 className={cn(
 'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
 selectedTemplate === key ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
 )}
 >
 <input
 type="radio"
 name="template"
 value={key}
 checked={selectedTemplate === key}
 onChange={(e) => setSelectedTemplate(e.target.value as any)}
 className="mt-1"
 />
 <div>
 <h4 className="font-medium">{template.name}</h4>
 <p className="text-sm text-muted-foreground">{template.description}</p>
 <div className="flex flex-wrap gap-1 mt-2">
 {template.sections.map(section => (
 <span key={section} className="px-2 py-1 rounded text-xs bg-secondary">
 {section}
 </span>
 ))}
 </div>
 </div>
 </label>
 ))}
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold mb-4">Options</h3>
 <div className="space-y-3">
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.includeTableOfContents}
 onChange={(e) => setConfig({ ...config, includeTableOfContents: e.target.checked })}
 />
 <span>Include table of contents</span>
 </label>
 
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.includeExamples}
 onChange={(e) => setConfig({ ...config, includeExamples: e.target.checked })}
 />
 <span>Include usage examples</span>
 </label>
 
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.includeParameterDetails}
 onChange={(e) => setConfig({ ...config, includeParameterDetails: e.target.checked })}
 />
 <span>Include detailed parameter descriptions</span>
 </label>
 
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.includeTroubleshooting}
 onChange={(e) => setConfig({ ...config, includeTroubleshooting: e.target.checked })}
 />
 <span>Include troubleshooting section</span>
 </label>
 
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.includeContributingGuide}
 onChange={(e) => setConfig({ ...config, includeContributingGuide: e.target.checked })}
 />
 <span>Include contributing guide</span>
 </label>
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold mb-4">Output Format</h3>
 <div className="space-y-2">
 {[
 { value: 'markdown', label: 'Markdown (.md)', icon: FileText },
 { value: 'html', label: 'HTML (.html)', icon: Code },
 { value: 'pdf', label: 'PDF (.pdf)', icon: FileText },
 ].map(format => (
 <label
 key={format.value}
 className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50"
 >
 <input
 type="radio"
 name="format"
 value={format.value}
 checked={config.format === format.value}
 onChange={(e) => setConfig({ ...config, format: e.target.value as any })}
 />
 <format.icon className="w-4 h-4" />
 <span>{format.label}</span>
 </label>
 ))}
 </div>
 </div>
 </div>

 {/* Sections */}
 <div>
 <h3 className="text-lg font-semibold mb-4">Documentation Sections</h3>
 <div className="space-y-2">
 {documentationSections.map((section) => (
 <div
 key={section.id}
 className="flex items-center justify-between p-3 rounded-lg border"
 >
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={section.enabled}
 onChange={(e) => {
 // Update section enabled state
 console.log('Toggle section:', section.id, e.target.checked);
 }}
 />
 <div>
 <h4 className="font-medium">{section.title}</h4>
 <p className="text-xs text-muted-foreground">
 {section.generated ? 'Auto-generated' : 'Manual content'}
 </p>
 </div>
 </div>
 
 {section.generated && (
 <CheckCircle className="w-4 h-4 text-green-600" />
 )}
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'preview' && (
 <div>
 <DocumentationPreview
 sections={documentationSections}
 format={config.format === 'html' ? 'html' : 'markdown'}
 />
 </div>
 )}

 {activeTab === 'export' && (
 <div className="space-y-6">
 <div className="text-center py-8">
 <Download className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">Export Documentation</h3>
 <p className="text-muted-foreground max-w-md mx-auto">
 Download the generated documentation in your preferred format. The documentation will include all enabled sections.
 </p>
 
 <div className="flex justify-center gap-4 mt-6">
 <button
 onClick={exportDocumentation}
 className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Download className="w-4 h-4" />
 Export as {config.format.toUpperCase()}
 </button>
 </div>
 </div>
 
 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
 <div className="flex items-start gap-2">
 <Info className="w-4 h-4 text-blue-600 mt-0.5" />
 <div className="text-sm">
 <p className="font-medium text-blue-800 mb-1">Export Information</p>
 <p className="text-blue-700">
 The exported documentation will include {documentationSections.filter(s => s.enabled).length} sections
 in {config.format} format. You can customize which sections to include in the Configure tab.
 </p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};