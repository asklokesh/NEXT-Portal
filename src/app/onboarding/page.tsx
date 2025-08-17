/**
 * Onboarding Landing Page
 */

import { TrialSignupForm } from '@/components/onboarding/TrialSignupForm';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-4 py-12">
        <TrialSignupForm />
      </div>
    </div>
  );
}