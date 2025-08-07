'use client';

import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface MobileNavProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  className?: string;
}

export function MobileNav({ children, trigger, className }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="sm:hidden">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className={`w-[300px] sm:w-[400px] ${className}`}>
        <div className="mt-6 flow-root">
          <div className="space-y-2">
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MobileNavItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileNavItem({ children, onClick, className }: MobileNavItemProps) {
  return (
    <button
      className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 hover:text-gray-900 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  className?: string;
}

export function ResponsiveGrid({ 
  children, 
  cols = { default: 1, sm: 2, lg: 3, xl: 4 }, 
  gap = { default: 3, sm: 4 },
  className = ""
}: ResponsiveGridProps) {
  const gridCols = [
    `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  ].filter(Boolean).join(' ');

  const gridGap = [
    `gap-${gap.default}`,
    gap.sm && `sm:gap-${gap.sm}`,
    gap.md && `md:gap-${gap.md}`,
    gap.lg && `lg:gap-${gap.lg}`
  ].filter(Boolean).join(' ');

  return (
    <div className={`grid ${gridCols} ${gridGap} ${className}`}>
      {children}
    </div>
  );
}

interface MobileScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function MobileScrollArea({ 
  children, 
  className = "", 
  maxHeight = "h-64 sm:h-96" 
}: MobileScrollAreaProps) {
  return (
    <div className={`overflow-y-auto ${maxHeight} ${className}`}>
      {children}
    </div>
  );
}

interface TouchFriendlyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}

export function TouchFriendlyButton({
  children,
  onClick,
  variant = 'default',
  size = 'default',
  className = "",
  disabled = false
}: TouchFriendlyButtonProps) {
  const sizeClasses = {
    sm: 'min-h-[40px] px-3 py-2 text-sm',
    default: 'min-h-[44px] px-4 py-2',
    lg: 'min-h-[48px] px-6 py-3 text-lg'
  };

  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClasses[size]} touch-manipulation ${className}`}
    >
      {children}
    </Button>
  );
}

export function MobileBreakpoint({ children, showOn = 'mobile' }: { 
  children: React.ReactNode; 
  showOn: 'mobile' | 'desktop' 
}) {
  const className = showOn === 'mobile' ? 'sm:hidden' : 'hidden sm:block';
  
  return (
    <div className={className}>
      {children}
    </div>
  );
}