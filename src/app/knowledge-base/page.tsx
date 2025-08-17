/**
 * Knowledge Base Page
 * 
 * Searchable documentation site with articles, videos, and community forums
 */

'use client';

import React from 'react';
import { KnowledgeBaseViewer } from '@/components/knowledge-base/KnowledgeBaseViewer';

export default function KnowledgeBasePage() {
  return (
    <div className="container mx-auto py-8">
      <KnowledgeBaseViewer />
    </div>
  );
}