'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import React from 'react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

interface ViewOption {
 id: string;
 label: string;
 icon: LucideIcon;
}

interface ViewToggleProps {
 view: string;
 onChange: (view: string) => void;
 views: ViewOption[];
 className?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
 view,
 onChange,
 views,
 className,
}) => {
 return (
 <div className={cn('flex rounded-lg bg-muted p-1', className)}>
 {views.map((viewOption) => {
 const Icon = viewOption.icon;
 const isActive = view === viewOption.id;
 
 return (
 <button
 key={viewOption.id}
 onClick={() => onChange(viewOption.id)}
 className={cn(
 'flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-md',
 'transition-all duration-200',
 isActive
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 )}
 aria-label={`Switch to ${viewOption.label} view`}
 aria-pressed={isActive}
 >
 <Icon className="w-4 h-4" />
 <span className="hidden sm:inline">{viewOption.label}</span>
 </button>
 );
 })}
 </div>
 );
};