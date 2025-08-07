'use client';

import React from 'react';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function ResponsiveContainer({ 
  children, 
  className = "",
  padding = 'md',
  maxWidth = 'full'
}: ResponsiveContainerProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-2 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full'
  };

  return (
    <div className={`w-full ${maxWidthClasses[maxWidth]} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveDialogProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogContent({ children, className = "" }: ResponsiveDialogProps) {
  return (
    <div className={`w-[95vw] max-w-2xl h-[90vh] sm:h-auto overflow-y-auto ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className = "" }: ResponsiveTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="min-w-full">
        {children}
      </div>
    </div>
  );
}

interface FlexStackProps {
  children: React.ReactNode;
  direction?: 'row' | 'col';
  responsive?: boolean;
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  className?: string;
}

export function FlexStack({
  children,
  direction = 'col',
  responsive = true,
  gap = 4,
  align = 'stretch',
  justify = 'start',
  className = ""
}: FlexStackProps) {
  const directionClass = responsive && direction === 'row' 
    ? 'flex-col sm:flex-row' 
    : direction === 'row' 
      ? 'flex-row' 
      : 'flex-col';
  
  const alignClasses = {
    start: 'items-start',
    center: 'items-center', 
    end: 'items-end',
    stretch: 'items-stretch'
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end', 
    between: 'justify-between',
    around: 'justify-around'
  };

  return (
    <div className={`flex ${directionClass} gap-${gap} ${alignClasses[align]} ${justifyClasses[justify]} ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveTextProps {
  children: React.ReactNode;
  size?: {
    mobile: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
    desktop: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  };
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  className?: string;
}

export function ResponsiveText({ 
  children, 
  size = { mobile: 'sm', desktop: 'base' },
  weight = 'normal',
  className = ""
}: ResponsiveTextProps) {
  const sizeClass = `text-${size.mobile} sm:text-${size.desktop}`;
  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium', 
    semibold: 'font-semibold',
    bold: 'font-bold'
  };

  return (
    <span className={`${sizeClass} ${weightClasses[weight]} ${className}`}>
      {children}
    </span>
  );
}

interface ResponsiveSpacingProps {
  children: React.ReactNode;
  y?: {
    mobile: number;
    desktop: number;
  };
  x?: {
    mobile: number;
    desktop: number;
  };
  className?: string;
}

export function ResponsiveSpacing({ 
  children, 
  y = { mobile: 4, desktop: 6 },
  x,
  className = ""
}: ResponsiveSpacingProps) {
  const yClass = `space-y-${y.mobile} sm:space-y-${y.desktop}`;
  const xClass = x ? `space-x-${x.mobile} sm:space-x-${x.desktop}` : '';

  return (
    <div className={`${yClass} ${xClass} ${className}`}>
      {children}
    </div>
  );
}

export function MobileSafeArea({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pb-safe-area-inset-bottom ${className}`}>
      {children}
    </div>
  );
}