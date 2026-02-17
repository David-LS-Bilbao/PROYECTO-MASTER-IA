/**
 * useAutoIngest Hook (Sprint 35)
 * Auto-triggers background news ingestion when user enters or resumes app
 *
 * STRATEGY:
 * - Detects new session (no previous visit timestamp)
 * - Detects resumed session after > 1 hour idle
 * - Triggers silent background ingestion (no UI blocking)
 * - Updates localStorage with last visit timestamp
 *
 * USAGE:
 * Call this hook at the app root level (layout.tsx or _app.tsx)
 */

'use client';

import { useEffect, useRef } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const STORAGE_KEY = 'verity-news-last-visit';
const THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export function useAutoIngest() {
  // Use ref to prevent multiple triggers in StrictMode
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Skip if already triggered (React StrictMode protection)
    if (hasTriggered.current) return;

    const lastVisit = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    let shouldTrigger = false;

    if (!lastVisit) {
      // New session - no previous visit recorded
      shouldTrigger = true;
      console.log('[useAutoIngest] New session detected - triggering ingestion');
    } else {
      const lastVisitTime = parseInt(lastVisit, 10);
      const timeSinceLastVisit = now - lastVisitTime;

      if (timeSinceLastVisit >= THRESHOLD_MS) {
        // Resumed session after > 1 hour
        shouldTrigger = true;
        console.log(
          `[useAutoIngest] Session resumed after ${Math.round(timeSinceLastVisit / 1000 / 60)} minutes - triggering ingestion`
        );
      }
    }

    if (shouldTrigger) {
      // Mark as triggered
      hasTriggered.current = true;

      // Trigger background ingestion (fire-and-forget)
      fetch(`${API_BASE_URL}/api/ingest/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
        .then((response) => {
          if (!response.ok) {
            console.warn('[useAutoIngest] Ingestion trigger failed:', response.status);
            return;
          }
          console.log('[useAutoIngest] Background ingestion triggered successfully');
        })
        .catch((error) => {
          console.warn('[useAutoIngest] Ingestion trigger error:', error);
        });
    }

    // Update last visit timestamp
    localStorage.setItem(STORAGE_KEY, now.toString());

    // Cleanup: Update timestamp when user leaves (optional)
    const handleBeforeUnload = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
