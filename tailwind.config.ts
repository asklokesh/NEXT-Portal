import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
 darkMode: ['class'],
 content: [
 './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
 './src/components/**/*.{js,ts,jsx,tsx,mdx}',
 './src/app/**/*.{js,ts,jsx,tsx,mdx}',
 ],
 theme: {
 container: {
 center: true,
 padding: '2rem',
 screens: {
 '2xl': '1400px',
 },
 },
 extend: {
 fontFamily: {
 sans: ['var(--font-inter)', ...fontFamily.sans],
 mono: ['var(--font-jetbrains-mono)', ...fontFamily.mono],
 },
 colors: {
 border: 'hsl(var(--border))',
 input: 'hsl(var(--input))',
 ring: 'hsl(var(--ring))',
 background: 'hsl(var(--background))',
 foreground: 'hsl(var(--foreground))',
 primary: {
 DEFAULT: 'hsl(var(--primary))',
 foreground: 'hsl(var(--primary-foreground))',
 50: '#eff6ff',
 100: '#dbeafe',
 200: '#bfdbfe',
 300: '#93c5fd',
 400: '#60a5fa',
 500: '#3b82f6',
 600: '#2563eb',
 700: '#1d4ed8',
 800: '#1e40af',
 900: '#1e3a8a',
 950: '#172554',
 },
 secondary: {
 DEFAULT: 'hsl(var(--secondary))',
 foreground: 'hsl(var(--secondary-foreground))',
 50: '#f8fafc',
 100: '#f1f5f9',
 200: '#e2e8f0',
 300: '#cbd5e1',
 400: '#94a3b8',
 500: '#64748b',
 600: '#475569',
 700: '#334155',
 800: '#1e293b',
 900: '#0f172a',
 950: '#020617',
 },
 destructive: {
 DEFAULT: 'hsl(var(--destructive))',
 foreground: 'hsl(var(--destructive-foreground))',
 },
 muted: {
 DEFAULT: 'hsl(var(--muted))',
 foreground: 'hsl(var(--muted-foreground))',
 },
 accent: {
 DEFAULT: 'hsl(var(--accent))',
 foreground: 'hsl(var(--accent-foreground))',
 },
 popover: {
 DEFAULT: 'hsl(var(--popover))',
 foreground: 'hsl(var(--popover-foreground))',
 },
 card: {
 DEFAULT: 'hsl(var(--card))',
 foreground: 'hsl(var(--card-foreground))',
 },
 success: {
 50: '#f0fdf4',
 100: '#dcfce7',
 200: '#bbf7d0',
 300: '#86efac',
 400: '#4ade80',
 500: '#22c55e',
 600: '#16a34a',
 700: '#15803d',
 800: '#166534',
 900: '#14532d',
 950: '#052e16',
 },
 warning: {
 50: '#fffbeb',
 100: '#fef3c7',
 200: '#fde68a',
 300: '#fcd34d',
 400: '#fbbf24',
 500: '#f59e0b',
 600: '#d97706',
 700: '#b45309',
 800: '#92400e',
 900: '#78350f',
 950: '#451a03',
 },
 info: {
 50: '#eff6ff',
 100: '#dbeafe',
 200: '#bfdbfe',
 300: '#93c5fd',
 400: '#60a5fa',
 500: '#3b82f6',
 600: '#2563eb',
 700: '#1d4ed8',
 800: '#1e40af',
 900: '#1e3a8a',
 950: '#172554',
 },
 },
 borderRadius: {
 lg: 'var(--radius)',
 md: 'calc(var(--radius) - 2px)',
 sm: 'calc(var(--radius) - 4px)',
 },
 keyframes: {
 'accordion-down': {
 from: { height: '0' },
 to: { height: 'var(--radix-accordion-content-height)' },
 },
 'accordion-up': {
 from: { height: 'var(--radix-accordion-content-height)' },
 to: { height: '0' },
 },
 shimmer: {
 '100%': {
 transform: 'translateX(100%)',
 },
 },
 pulse: {
 '0%, 100%': {
 opacity: '1',
 },
 '50%': {
 opacity: '.5',
 },
 },
 bounce: {
 '0%, 100%': {
 transform: 'translateY(-25%)',
 animationTimingFunction: 'cubic-bezier(0.8,0,1,1)',
 },
 '50%': {
 transform: 'none',
 animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
 },
 },
 spin: {
 to: {
 transform: 'rotate(360deg)',
 },
 },
 },
 animation: {
 'accordion-down': 'accordion-down 0.2s ease-out',
 'accordion-up': 'accordion-up 0.2s ease-out',
 shimmer: 'shimmer 2s linear infinite',
 pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
 bounce: 'bounce 1s infinite',
 spin: 'spin 1s linear infinite',
 },
 backgroundImage: {
 'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
 'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
 },
 screens: {
 xs: '475px',
 },
 typography: {
 DEFAULT: {
 css: {
 maxWidth: 'none',
 color: 'hsl(var(--foreground))',
 hr: {
 borderColor: 'hsl(var(--border))',
 marginTop: '3em',
 marginBottom: '3em',
 },
 'h1, h2, h3, h4': {
 color: 'hsl(var(--foreground))',
 fontWeight: '600',
 },
 h1: {
 fontSize: '2.25em',
 marginTop: '0',
 marginBottom: '0.8888889em',
 lineHeight: '1.1111111',
 },
 h2: {
 fontSize: '1.5em',
 marginTop: '2em',
 marginBottom: '1em',
 lineHeight: '1.3333333',
 },
 h3: {
 fontSize: '1.25em',
 marginTop: '1.6em',
 marginBottom: '0.6em',
 lineHeight: '1.6',
 },
 h4: {
 marginTop: '1.5em',
 marginBottom: '0.5em',
 lineHeight: '1.5',
 },
 a: {
 color: 'hsl(var(--primary))',
 textDecoration: 'none',
 fontWeight: '500',
 '&:hover': {
 textDecoration: 'underline',
 },
 },
 'ul, ol': {
 paddingLeft: '1.25em',
 },
 li: {
 marginTop: '0.5em',
 marginBottom: '0.5em',
 },
 '> ul > li p': {
 marginTop: '0.75em',
 marginBottom: '0.75em',
 },
 'code': {
 color: 'hsl(var(--foreground))',
 backgroundColor: 'hsl(var(--muted))',
 paddingLeft: '0.25em',
 paddingRight: '0.25em',
 paddingTop: '0.125em',
 paddingBottom: '0.125em',
 borderRadius: '0.25em',
 fontWeight: '600',
 fontSize: '0.875em',
 },
 'pre': {
 color: 'hsl(var(--foreground))',
 backgroundColor: 'hsl(var(--muted))',
 overflow: 'auto',
 borderRadius: '0.375em',
 },
 'pre code': {
 backgroundColor: 'transparent',
 borderWidth: '0',
 borderRadius: '0',
 padding: '0',
 fontWeight: '400',
 color: 'inherit',
 fontSize: 'inherit',
 fontFamily: 'inherit',
 lineHeight: 'inherit',
 },
 },
 },
 },
 },
 },
 plugins: [
 require('@tailwindcss/forms'),
 require('@tailwindcss/typography'),
 require('tailwindcss-animate'),
 ],
};

export default config;