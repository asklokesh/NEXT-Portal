/**
 * Feedback Portal Page
 * 
 * Customer feedback system with feature request voting and roadmap visibility
 */

'use client';

import React from 'react';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

export default function FeedbackPage() {
  return (
    <div className="container mx-auto py-8">
      <FeedbackPortal />
      {/* <FeedbackWidget /> */}
    </div>
  );
}