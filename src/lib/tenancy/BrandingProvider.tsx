/**
 * Tenant Branding Provider
 * Applies tenant-specific branding and styling dynamically
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTenantConfiguration } from '@/hooks/useTenantConfiguration';

interface BrandingConfig {
  organizationName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customCSS?: string;
  footerText?: string;
  supportEmail?: string;
}

interface BrandingContextType {
  branding: BrandingConfig | null;
  loading: boolean;
  applyBranding: () => void;
  removeBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function useBranding(): BrandingContextType {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}

interface BrandingProviderProps {
  children: React.ReactNode;
  fallbackBranding?: Partial<BrandingConfig>;
}

export function BrandingProvider({ children, fallbackBranding }: BrandingProviderProps) {
  const { config, loading: configLoading } = useTenantConfiguration();
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Default branding configuration
  const defaultBranding: BrandingConfig = {
    organizationName: 'Developer Portal',
    primaryColor: '#1976d2',
    secondaryColor: '#424242',
    accentColor: '#ff4081',
    ...fallbackBranding
  };

  useEffect(() => {
    if (!configLoading) {
      const brandingConfig = config?.branding || defaultBranding;
      setBranding(brandingConfig);
      setLoading(false);
    }
  }, [config, configLoading, defaultBranding]);

  useEffect(() => {
    if (branding && !loading) {
      applyBranding();
    }
  }, [branding, loading]);

  const applyBranding = () => {
    if (!branding) return;

    // Apply CSS custom properties for colors
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    root.style.setProperty('--brand-accent', branding.accentColor);

    // Update document title
    if (branding.organizationName) {
      document.title = `${branding.organizationName} - Developer Portal`;
    }

    // Apply favicon if provided
    if (branding.logoUrl) {
      updateFavicon(branding.logoUrl);
    }

    // Apply custom CSS
    if (branding.customCSS) {
      applyCustomCSS(branding.customCSS);
    }

    // Apply additional CSS variables for theme consistency
    applyCSSVariables(branding);
  };

  const removeBranding = () => {
    const root = document.documentElement;
    root.style.removeProperty('--brand-primary');
    root.style.removeProperty('--brand-secondary');
    root.style.removeProperty('--brand-accent');

    // Remove custom CSS
    removeCustomCSS();
    
    // Reset document title
    document.title = 'Developer Portal';
  };

  const updateFavicon = (logoUrl: string) => {
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = logoUrl;
    } else {
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.href = logoUrl;
      document.head.appendChild(newFavicon);
    }
  };

  const applyCustomCSS = (customCSS: string) => {
    // Remove existing custom CSS
    removeCustomCSS();

    // Create and inject new custom CSS
    const styleElement = document.createElement('style');
    styleElement.id = 'tenant-custom-css';
    styleElement.textContent = customCSS;
    document.head.appendChild(styleElement);
  };

  const removeCustomCSS = () => {
    const existingStyle = document.getElementById('tenant-custom-css');
    if (existingStyle) {
      existingStyle.remove();
    }
  };

  const applyCSSVariables = (config: BrandingConfig) => {
    const root = document.documentElement;

    // Generate color variations
    const primaryColorRgb = hexToRgb(config.primaryColor);
    const secondaryColorRgb = hexToRgb(config.secondaryColor);
    const accentColorRgb = hexToRgb(config.accentColor);

    if (primaryColorRgb) {
      root.style.setProperty('--brand-primary-rgb', primaryColorRgb.join(', '));
      root.style.setProperty('--brand-primary-50', `rgba(${primaryColorRgb.join(', ')}, 0.05)`);
      root.style.setProperty('--brand-primary-100', `rgba(${primaryColorRgb.join(', ')}, 0.1)`);
      root.style.setProperty('--brand-primary-200', `rgba(${primaryColorRgb.join(', ')}, 0.2)`);
      root.style.setProperty('--brand-primary-500', `rgba(${primaryColorRgb.join(', ')}, 0.5)`);
      root.style.setProperty('--brand-primary-600', darkenColor(config.primaryColor, 10));
      root.style.setProperty('--brand-primary-700', darkenColor(config.primaryColor, 20));
    }

    if (secondaryColorRgb) {
      root.style.setProperty('--brand-secondary-rgb', secondaryColorRgb.join(', '));
      root.style.setProperty('--brand-secondary-50', `rgba(${secondaryColorRgb.join(', ')}, 0.05)`);
      root.style.setProperty('--brand-secondary-100', `rgba(${secondaryColorRgb.join(', ')}, 0.1)`);
    }

    if (accentColorRgb) {
      root.style.setProperty('--brand-accent-rgb', accentColorRgb.join(', '));
      root.style.setProperty('--brand-accent-50', `rgba(${accentColorRgb.join(', ')}, 0.05)`);
      root.style.setProperty('--brand-accent-100', `rgba(${accentColorRgb.join(', ')}, 0.1)`);
    }

    // Apply to Tailwind CSS custom properties
    root.style.setProperty('--tw-color-primary', config.primaryColor);
    root.style.setProperty('--tw-color-secondary', config.secondaryColor);
    root.style.setProperty('--tw-color-accent', config.accentColor);
  };

  const hexToRgb = (hex: string): number[] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  };

  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  };

  const contextValue: BrandingContextType = {
    branding,
    loading,
    applyBranding,
    removeBranding
  };

  return (
    <BrandingContext.Provider value={contextValue}>
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Component for displaying tenant logo
 */
interface TenantLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fallback?: React.ReactNode;
}

export function TenantLogo({ className = '', size = 'md', fallback }: TenantLogoProps) {
  const { branding, loading } = useBranding();

  const sizeClasses = {
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto',
    lg: 'h-12 w-auto'
  };

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 animate-pulse rounded ${className}`} />
    );
  }

  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.organizationName}
        className={`${sizeClasses[size]} ${className}`}
        onError={(e) => {
          // Fallback to organization name if logo fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default fallback to organization name
  return (
    <div className={`${sizeClasses[size]} flex items-center font-bold text-primary ${className}`}>
      {branding?.organizationName || 'Portal'}
    </div>
  );
}

/**
 * Component for displaying tenant footer
 */
interface TenantFooterProps {
  className?: string;
}

export function TenantFooter({ className = '' }: TenantFooterProps) {
  const { branding } = useBranding();

  if (!branding?.footerText && !branding?.supportEmail) {
    return null;
  }

  return (
    <footer className={`text-sm text-gray-600 ${className}`}>
      {branding.footerText && (
        <div className="mb-2">{branding.footerText}</div>
      )}
      {branding.supportEmail && (
        <div>
          Support: <a 
            href={`mailto:${branding.supportEmail}`}
            className="text-primary hover:underline"
          >
            {branding.supportEmail}
          </a>
        </div>
      )}
    </footer>
  );
}

/**
 * Hook for accessing current branding values
 */
export function useBrandingValues() {
  const { branding } = useBranding();
  
  return {
    organizationName: branding?.organizationName || 'Developer Portal',
    logoUrl: branding?.logoUrl,
    primaryColor: branding?.primaryColor || '#1976d2',
    secondaryColor: branding?.secondaryColor || '#424242',
    accentColor: branding?.accentColor || '#ff4081',
    supportEmail: branding?.supportEmail,
    footerText: branding?.footerText,
    hasCustomBranding: !!branding?.logoUrl || !!branding?.customCSS
  };
}

/**
 * Higher-order component for wrapping components with branding
 */
export function withBranding<P extends object>(
  Component: React.ComponentType<P>
) {
  return function BrandedComponent(props: P) {
    return (
      <BrandingProvider>
        <Component {...props} />
      </BrandingProvider>
    );
  };
}

export default BrandingProvider;