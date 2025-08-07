'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Share2,
 Copy,
 Download,
 Mail,
 Link,
 Users,
 Globe,
 Lock,
 Shield,
 QrCode,
 Clock,
 Check,
 X,
 ExternalLink,
 FileText,
 Package,
 Settings,
 Eye,
 EyeOff,
 Calendar,
 User
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateShareDialogProps {
 template: TemplateEntity;
 onClose: () => void;
 className?: string;
}

interface ShareOption {
 id: string;
 name: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
 action: () => void;
 disabled?: boolean;
}

interface ShareLink {
 id: string;
 name: string;
 url: string;
 permissions: 'view' | 'use' | 'edit';
 expiresAt?: string;
 createdAt: string;
 uses: number;
 maxUses?: number;
}

interface ExportFormat {
 id: string;
 name: string;
 description: string;
 extension: string;
 icon: React.ComponentType<{ className?: string }>;
}

const EXPORT_FORMATS: ExportFormat[] = [
 {
 id: 'yaml',
 name: 'YAML Template',
 description: 'Original Backstage template format',
 extension: '.yaml',
 icon: FileText,
 },
 {
 id: 'json',
 name: 'JSON Template',
 description: 'Template in JSON format',
 extension: '.json',
 icon: FileText,
 },
 {
 id: 'zip',
 name: 'Template Package',
 description: 'Complete template with all files',
 extension: '.zip',
 icon: Package,
 },
 {
 id: 'markdown',
 name: 'Documentation',
 description: 'Template documentation and usage guide',
 extension: '.md',
 icon: FileText,
 },
];

const ShareLinkCard: React.FC<{
 link: ShareLink;
 onCopy: (url: string) => void;
 onRevoke: (id: string) => void;
 onEdit: (id: string) => void;
}> = ({ link, onCopy, onRevoke, onEdit }) => {
 const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
 const isMaxUsesReached = link.maxUses && link.uses >= link.maxUses;
 const isActive = !isExpired && !isMaxUsesReached;

 const permissionConfig = {
 view: { color: 'bg-blue-100 text-blue-800', icon: Eye, label: 'View Only' },
 use: { color: 'bg-green-100 text-green-800', icon: Package, label: 'Use Template' },
 edit: { color: 'bg-purple-100 text-purple-800', icon: Settings, label: 'Edit Template' },
 };

 const config = permissionConfig[link.permissions];
 const PermissionIcon = config.icon;

 return (
 <div className={cn(
 'border rounded-lg p-4',
 isActive ? 'bg-card' : 'bg-muted/50 opacity-75'
 )}>
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium">{link.name}</h4>
 <div className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
 <PermissionIcon className="w-3 h-3 inline mr-1" />
 {config.label}
 </div>
 {!isActive && (
 <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
 {isExpired ? 'Expired' : 'Max Uses Reached'}
 </div>
 )}
 </div>
 
 <div className="text-sm text-muted-foreground space-y-1">
 <div className="flex items-center gap-4">
 <span>Uses: {link.uses}{link.maxUses ? `/${link.maxUses}` : ''}</span>
 <span>Created: {new Date(link.createdAt).toLocaleDateString()}</span>
 {link.expiresAt && (
 <span>Expires: {new Date(link.expiresAt).toLocaleDateString()}</span>
 )}
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-1 ml-4">
 <button
 onClick={() => onCopy(link.url)}
 disabled={!isActive}
 className={cn(
 'p-1 rounded hover:bg-accent transition-colors',
 !isActive && 'opacity-50 cursor-not-allowed'
 )}
 title="Copy link"
 >
 <Copy className="w-4 h-4" />
 </button>
 
 <button
 onClick={() => onEdit(link.id)}
 className="p-1 rounded hover:bg-accent transition-colors"
 title="Edit link"
 >
 <Settings className="w-4 h-4" />
 </button>
 
 <button
 onClick={() => onRevoke(link.id)}
 className="p-1 rounded hover:bg-accent transition-colors text-red-600"
 title="Revoke link"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 
 <div className="bg-muted/30 rounded p-2 font-mono text-xs break-all">
 {link.url}
 </div>
 </div>
 );
};

const CreateLinkForm: React.FC<{
 onSubmit: (data: { name: string; permissions: 'view' | 'use' | 'edit'; expiresAt?: string; maxUses?: number }) => void;
 onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
 const [formData, setFormData] = useState({
 name: '',
 permissions: 'use' as 'view' | 'use' | 'edit',
 expiresAt: '',
 maxUses: '',
 });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSubmit({
 name: formData.name || 'Shared Template Link',
 permissions: formData.permissions,
 expiresAt: formData.expiresAt || undefined,
 maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
 });
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-1">Link Name</label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 placeholder="e.g., 'For Development Team'"
 className="w-full px-3 py-2 rounded border border-input bg-background"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium mb-1">Permissions</label>
 <select
 value={formData.permissions}
 onChange={(e) => setFormData({ ...formData, permissions: e.target.value as any })}
 className="w-full px-3 py-2 rounded border border-input bg-background"
 >
 <option value="view">View Only - Can see template details</option>
 <option value="use">Use Template - Can execute template</option>
 <option value="edit">Edit Template - Can modify template</option>
 </select>
 </div>
 
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-1">Expires At (Optional)</label>
 <input
 type="datetime-local"
 value={formData.expiresAt}
 onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
 className="w-full px-3 py-2 rounded border border-input bg-background"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium mb-1">Max Uses (Optional)</label>
 <input
 type="number"
 value={formData.maxUses}
 onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
 placeholder="Unlimited"
 min="1"
 className="w-full px-3 py-2 rounded border border-input bg-background"
 />
 </div>
 </div>
 
 <div className="flex justify-end gap-2">
 <button
 type="button"
 onClick={onCancel}
 className="px-4 py-2 rounded border border-border hover:bg-accent transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
 >
 Create Link
 </button>
 </div>
 </form>
 );
};

export const TemplateShareDialog: React.FC<TemplateShareDialogProps> = ({
 template,
 onClose,
 className,
}) => {
 const [activeTab, setActiveTab] = useState<'share' | 'export' | 'links'>('share');
 const [showCreateLink, setShowCreateLink] = useState(false);
 const [copiedText, setCopiedText] = useState<string | null>(null);
 const [shareLinks, setShareLinks] = useState<ShareLink[]>([
 {
 id: '1',
 name: 'Development Team Access',
 url: `${window.location.origin}/templates/shared/abc123def456`,
 permissions: 'use',
 expiresAt: '2024-02-15T23:59:59',
 createdAt: '2024-01-20T10:00:00Z',
 uses: 12,
 maxUses: 50,
 },
 {
 id: '2',
 name: 'Public Demo Link',
 url: `${window.location.origin}/templates/shared/xyz789uvw012`,
 permissions: 'view',
 createdAt: '2024-01-18T14:30:00Z',
 uses: 45,
 },
 ]);

 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const templateUrl = `${window.location.origin}/templates/${encodeURIComponent(templateRef)}`;

 const handleCopy = async (text: string) => {
 try {
 await navigator.clipboard.writeText(text);
 setCopiedText(text);
 setTimeout(() => setCopiedText(null), 2000);
 } catch (error) {
 console.error('Failed to copy:', error);
 }
 };

 const handleExport = (format: ExportFormat) => {
 console.log('Exporting template in format:', format.id);
 // In real implementation, generate and download the file
 const fileName = `${template.metadata.name}${format.extension}`;
 
 // Mock file content based on format
 let content: string;
 switch (format.id) {
 case 'yaml':
 content = `# Template: ${template.metadata.title || template.metadata.name}\n# Generated on: ${new Date().toISOString()}\n\napiVersion: scaffolder.backstage.io/v1beta3\nkind: Template\nmetadata:\n name: ${template.metadata.name}\n title: ${template.metadata.title || template.metadata.name}\n description: ${template.metadata.description || ''}\nspec:\n type: ${template.spec.type}\n # ... rest of template definition`;
 break;
 case 'json':
 content = JSON.stringify({
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: template.metadata.name,
 title: template.metadata.title || template.metadata.name,
 description: template.metadata.description || '',
 },
 spec: {
 type: template.spec.type,
 // Simplified spec
 }
 }, null, 2);
 break;
 case 'markdown':
 content = `# ${template.metadata.title || template.metadata.name}\n\n${template.metadata.description || 'No description available'}\n\n## Usage\n\nThis template can be used to create a new ${template.spec.type} project.\n\n## Parameters\n\n[Parameter documentation would be generated here]\n\n## Generated on\n\n${new Date().toISOString()}`;
 break;
 default:
 content = 'Template export content';
 }

 // Create and trigger download
 const blob = new Blob([content], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = fileName;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 const shareOptions: ShareOption[] = useMemo(() => [
 {
 id: 'copy-link',
 name: 'Copy Link',
 description: 'Copy template URL to clipboard',
 icon: Copy,
 action: () => handleCopy(templateUrl),
 },
 {
 id: 'email',
 name: 'Share via Email',
 description: 'Open email client with template link',
 icon: Mail,
 action: () => {
 const subject = `Check out this template: ${template.metadata.title || template.metadata.name}`;
 const body = `I wanted to share this template with you:\n\n${template.metadata.title || template.metadata.name}\n${template.metadata.description || ''}\n\nLink: ${templateUrl}`;
 window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
 },
 },
 {
 id: 'qr-code',
 name: 'QR Code',
 description: 'Generate QR code for easy mobile sharing',
 icon: QrCode,
 action: () => {
 console.log('Generate QR code for:', templateUrl);
 // In real implementation, generate QR code
 },
 },
 {
 id: 'embed',
 name: 'Embed Code',
 description: 'Get HTML embed code for websites',
 icon: ExternalLink,
 action: () => {
 const embedCode = `<iframe src="${templateUrl}/embed" width="600" height="400" frameborder="0"></iframe>`;
 handleCopy(embedCode);
 },
 },
 ], [template, templateUrl]);

 const handleCreateLink = (data: { name: string; permissions: 'view' | 'use' | 'edit'; expiresAt?: string; maxUses?: number }) => {
 const newLink: ShareLink = {
 id: Date.now().toString(),
 name: data.name,
 url: `${window.location.origin}/templates/shared/${Math.random().toString(36).substr(2, 12)}`,
 permissions: data.permissions,
 expiresAt: data.expiresAt,
 createdAt: new Date().toISOString(),
 uses: 0,
 maxUses: data.maxUses,
 };
 
 setShareLinks([newLink, ...shareLinks]);
 setShowCreateLink(false);
 };

 const handleRevokeLink = (id: string) => {
 setShareLinks(shareLinks.filter(link => link.id !== id));
 };

 const handleEditLink = (id: string) => {
 console.log('Edit link:', id);
 // In real implementation, open edit dialog
 };

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className={cn('bg-background rounded-lg border w-full max-w-3xl max-h-[80vh] overflow-hidden', className)}>
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-primary/10">
 <Share2 className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h2 className="text-xl font-semibold">Share Template</h2>
 <p className="text-sm text-muted-foreground">
 {template.metadata.title || template.metadata.name}
 </p>
 </div>
 </div>
 
 <button
 onClick={onClose}
 className="p-2 rounded-md hover:bg-accent transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Navigation */}
 <div className="flex border-b">
 {[
 { id: 'share', label: 'Quick Share', icon: Share2 },
 { id: 'links', label: 'Share Links', icon: Link },
 { id: 'export', label: 'Export', icon: Download },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 'flex items-center gap-1 px-4 py-3 text-sm transition-colors border-b-2',
 activeTab === tab.id
 ? 'border-primary text-primary bg-primary/5'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 <tab.icon className="w-4 h-4" />
 {tab.label}
 </button>
 ))}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {activeTab === 'share' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Quick Share Options</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {shareOptions.map((option) => (
 <button
 key={option.id}
 onClick={option.action}
 disabled={option.disabled}
 className={cn(
 'flex items-start gap-3 p-4 rounded-lg border text-left',
 'hover:bg-accent hover:border-primary/50 transition-all',
 option.disabled && 'opacity-50 cursor-not-allowed'
 )}
 >
 <div className="p-2 rounded-lg bg-primary/10">
 <option.icon className="w-4 h-4 text-primary" />
 </div>
 <div>
 <h4 className="font-medium">{option.name}</h4>
 <p className="text-sm text-muted-foreground">{option.description}</p>
 </div>
 </button>
 ))}
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold mb-4">Direct Link</h3>
 <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
 <input
 type="text"
 value={templateUrl}
 readOnly
 className="flex-1 bg-transparent border-none outline-none text-sm"
 />
 <button
 onClick={() => handleCopy(templateUrl)}
 className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90"
 >
 {copiedText === templateUrl ? (
 <>
 <Check className="w-3 h-3" />
 Copied
 </>
 ) : (
 <>
 <Copy className="w-3 h-3" />
 Copy
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'links' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold">Share Links</h3>
 <p className="text-sm text-muted-foreground">
 Create custom links with specific permissions and expiration
 </p>
 </div>
 
 {!showCreateLink && (
 <button
 onClick={() => setShowCreateLink(true)}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Link className="w-4 h-4" />
 Create Link
 </button>
 )}
 </div>

 {showCreateLink && (
 <div className="bg-card rounded-lg border p-6">
 <h4 className="font-medium mb-4">Create New Share Link</h4>
 <CreateLinkForm
 onSubmit={handleCreateLink}
 onCancel={() => setShowCreateLink(false)}
 />
 </div>
 )}

 <div className="space-y-4">
 {shareLinks.map((link) => (
 <ShareLinkCard
 key={link.id}
 link={link}
 onCopy={handleCopy}
 onRevoke={handleRevokeLink}
 onEdit={handleEditLink}
 />
 ))}
 
 {shareLinks.length === 0 && (
 <div className="text-center py-8">
 <Link className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
 <h4 className="font-medium mb-1">No share links created</h4>
 <p className="text-sm text-muted-foreground">
 Create custom share links with specific permissions and expiration dates
 </p>
 </div>
 )}
 </div>
 </div>
 )}

 {activeTab === 'export' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Export Template</h3>
 <p className="text-sm text-muted-foreground mb-6">
 Download the template in various formats for backup, migration, or sharing
 </p>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {EXPORT_FORMATS.map((format) => (
 <button
 key={format.id}
 onClick={() => handleExport(format)}
 className="flex items-start gap-3 p-4 rounded-lg border text-left hover:bg-accent hover:border-primary/50 transition-all"
 >
 <div className="p-2 rounded-lg bg-primary/10">
 <format.icon className="w-4 h-4 text-primary" />
 </div>
 <div>
 <h4 className="font-medium">{format.name}</h4>
 <p className="text-sm text-muted-foreground">{format.description}</p>
 <p className="text-xs text-muted-foreground mt-1">
 File format: {format.extension}
 </p>
 </div>
 </button>
 ))}
 </div>
 </div>

 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
 <div className="flex items-start gap-2">
 <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
 <div className="text-sm">
 <p className="font-medium text-blue-800 mb-1">Export Security Note</p>
 <p className="text-blue-700">
 Exported templates may contain sensitive information. Review the content before sharing
 and ensure proper access controls are in place.
 </p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Notifications */}
 {copiedText && (
 <div className="absolute bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
 <div className="flex items-center gap-2">
 <Check className="w-4 h-4" />
 <span>Copied to clipboard</span>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};