/**
 * Auto-Ingest Provider (Sprint 35)
 * Wraps useAutoIngest hook for integration in Server Component layout
 */

'use client';

import { useAutoIngest } from '@/hooks/useAutoIngest';

export function AutoIngestProvider({ children }: { children: React.ReactNode }) {
  // Trigger auto-ingestion on mount
  useAutoIngest();

  // This is a passthrough provider - just triggers the hook
  return <>{children}</>;
}
