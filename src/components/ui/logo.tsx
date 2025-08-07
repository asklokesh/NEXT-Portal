import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white' | 'dark' | 'mono';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-auto',
  md: 'h-8 w-auto', 
  lg: 'h-12 w-auto',
  xl: 'h-16 w-auto'
};

export function Logo({ size = 'md', variant = 'default', className = '' }: LogoProps) {
  const getColors = () => {
    switch (variant) {
      case 'white':
        return {
          primary: '#ffffff',
          secondary: '#f1f5f9',
          accent: '#e2e8f0'
        };
      case 'dark':
        return {
          primary: '#0f172a',
          secondary: '#1e293b',
          accent: '#334155'
        };
      case 'mono':
        return {
          primary: '#6b7280',
          secondary: '#9ca3af',
          accent: '#d1d5db'
        };
      default:
        return {
          primary: '#0f172a', // slate-900 - professional, confident
          secondary: '#3b82f6', // blue-500 - trustworthy, tech
          accent: '#06b6d4' // cyan-500 - innovation, forward-thinking
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg 
        viewBox="0 0 160 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        {/* Modern triangular logo elements based on provided design */}
        <defs>
          <linearGradient id="triangleGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="30%" stopColor="#6366f1" />
            <stop offset="70%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="triangleGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id="triangleGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
        
        {/* Triangular geometric elements - matching the design */}
        <g className="logo-triangles">
          {/* Main forward-pointing triangle */}
          <path 
            d="M2 30 L2 2 L24 16 Z" 
            fill="url(#triangleGradient1)" 
            className="transition-all duration-300"
          />
          
          {/* Secondary overlapping triangle */}
          <path 
            d="M14 26 L14 6 L32 16 Z" 
            fill="url(#triangleGradient2)" 
            opacity="0.85"
            className="transition-all duration-300"
          />
          
          {/* Accent triangle for momentum */}
          <path 
            d="M24 22 L24 10 L36 16 Z" 
            fill="url(#triangleGradient3)" 
            opacity="0.7"
            className="transition-all duration-300"
          />
        </g>

        {/* NEXT Text - matching the style from the image */}
        <g className="logo-text" transform="translate(48, 0)">
          {/* N */}
          <path
            d="M0 5 L0 27 L4 27 L4 12 L12 27 L16 27 L16 5 L12 5 L12 20 L4 5 Z"
            fill={colors.primary}
            className="transition-colors duration-200"
          />
          
          {/* E */}
          <path
            d="M22 5 L22 27 L38 27 L38 23 L26 23 L26 17.5 L36 17.5 L36 13.5 L26 13.5 L26 9 L38 9 L38 5 Z"
            fill={colors.primary}
            className="transition-colors duration-200"
          />
          
          {/* X */}
          <path
            d="M44 5 L50 16 L44 27 L48.5 27 L52.5 18.5 L56.5 27 L61 27 L55 16 L61 5 L56.5 5 L52.5 13.5 L48.5 5 Z"
            fill={colors.primary}
            className="transition-colors duration-200"
          />
          
          {/* T */}
          <path
            d="M67 5 L67 9 L74 9 L74 27 L78 27 L78 9 L85 9 L85 5 Z"
            fill={colors.primary}
            className="transition-colors duration-200"
          />
        </g>
      </svg>
    </div>
  );
}

// Icon-only version for tight spaces
export function LogoIcon({ size = 'md', variant = 'default', className = '' }: LogoProps) {
  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg 
        viewBox="0 0 40 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        <defs>
          <linearGradient id="iconTriangleGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="30%" stopColor="#6366f1" />
            <stop offset="70%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="iconTriangleGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id="iconTriangleGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
        
        {/* Triangular logo icon - matching the design */}
        <g className="logo-triangles">
          {/* Main forward-pointing triangle */}
          <path 
            d="M2 30 L2 2 L24 16 Z" 
            fill="url(#iconTriangleGradient1)" 
            className="transition-all duration-300"
          />
          
          {/* Secondary overlapping triangle */}
          <path 
            d="M14 26 L14 6 L32 16 Z" 
            fill="url(#iconTriangleGradient2)" 
            opacity="0.85"
            className="transition-all duration-300"
          />
          
          {/* Accent triangle for momentum */}
          <path 
            d="M24 22 L24 10 L36 16 Z" 
            fill="url(#iconTriangleGradient3)" 
            opacity="0.7"
            className="transition-all duration-300"
          />
        </g>
      </svg>
    </div>
  );
}