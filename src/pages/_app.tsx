import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Ensure DOM is ready before any style injection
    if (typeof window !== 'undefined') {
      // Force a reflow to ensure styles are applied correctly
      document.documentElement.style.display = 'block';
    }
  }, []);

  return <Component {...pageProps} />;
}