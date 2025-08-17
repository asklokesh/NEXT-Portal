'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function TemplatesMarketplacePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main templates page
    // This route was being referenced but didn't exist
    router.replace('/templates');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-gray-600">Redirecting to templates...</p>
      </div>
    </div>
  );
}