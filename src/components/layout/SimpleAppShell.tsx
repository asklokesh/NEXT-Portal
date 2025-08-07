'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SimpleAppShellProps {
 children: React.ReactNode;
}

export function SimpleAppShell({ children }: SimpleAppShellProps) {
 const pathname = usePathname();

 const navItems = [
 { href: '/dashboard', label: 'Dashboard' },
 { href: '/catalog', label: 'Catalog' },
 { href: '/templates', label: 'Templates' },
 { href: '/plugins', label: 'Plugins' },
 { href: '/workflows', label: 'Workflows' },
 ];

 return (
 <div className="min-h-screen bg-gray-50">
 <nav className="bg-white shadow-sm border-b">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <div className="flex justify-between h-16">
 <div className="flex">
 <div className="flex-shrink-0 flex items-center">
 <span className="text-xl font-bold">IDP Platform</span>
 </div>
 <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
 {navItems.map((item) => (
 <Link
 key={item.href}
 href={item.href}
 className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
 pathname === item.href
 ? 'border-blue-500 text-gray-900'
 : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
 }`}
 >
 {item.label}
 </Link>
 ))}
 </div>
 </div>
 </div>
 </div>
 </nav>
 <main className="py-10">
 <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
 {children}
 </div>
 </main>
 </div>
 );
}