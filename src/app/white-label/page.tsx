/**
 * White-Label Configuration Page
 * 
 * Multi-tenant white-labeling system with custom branding and feature toggles
 */

'use client';

import React from 'react';
import { WhiteLabelConfig } from '@/components/white-label/WhiteLabelConfig';

export default function WhiteLabelPage() {
  return (
    <div className="container mx-auto py-8">
      <WhiteLabelConfig />
    </div>
  );
}