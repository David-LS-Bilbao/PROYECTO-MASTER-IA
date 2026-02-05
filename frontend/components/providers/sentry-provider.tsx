/**
 * Sentry Provider Component
 * Sprint 15: Observabilidad & Analytics
 *
 * Initializes Sentry on the client side
 * This is a Client Component that must wrap the app to enable error tracking
 */

'use client';

import { useEffect } from 'react';
import { initSentryClient } from '@/sentry.client.config';

interface SentryProviderProps {
  children: React.ReactNode;
}

export function SentryProvider({ children }: SentryProviderProps) {
  useEffect(() => {
    // Initialize Sentry once on client mount
    initSentryClient();
  }, []);

  return <>{children}</>;
}
