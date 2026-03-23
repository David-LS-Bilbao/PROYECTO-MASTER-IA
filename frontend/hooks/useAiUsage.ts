'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAiUsageComparison,
  fetchAiUsageOverview,
  fetchAiUsagePrompts,
  fetchAiUsageRuns,
  type AiUsagePromptFilters,
  type AiUsageQueryFilters,
} from '@/lib/ai-usage.api';

async function requireToken(getToken: (forceRefresh?: boolean) => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (!token) {
    throw new Error('No hay token de sesión disponible.');
  }

  return token;
}

export function useAiUsageOverview(filters: AiUsageQueryFilters, enabled = true) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['ai-usage', 'overview', filters],
    queryFn: async () => fetchAiUsageOverview(await requireToken(getToken), filters),
    enabled,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useAiUsageRuns(
  filters: AiUsageQueryFilters & { limit: number },
  enabled = true
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['ai-usage', 'runs', filters],
    queryFn: async () => fetchAiUsageRuns(await requireToken(getToken), filters),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useAiUsagePrompts(
  filters: AiUsagePromptFilters & { limit: number },
  enabled = true
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['ai-usage', 'prompts', filters],
    queryFn: async () => fetchAiUsagePrompts(await requireToken(getToken), filters),
    enabled,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useAiUsageComparison(filters: AiUsageQueryFilters, enabled = true) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['ai-usage', 'comparison', filters],
    queryFn: async () => fetchAiUsageComparison(await requireToken(getToken), filters),
    enabled,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}
