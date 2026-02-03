/**
 * useDashboardStats - Custom Hook para estadísticas del dashboard
 * 
 * FRONTEND MODERNO (Sprint 13 - Fase C):
 * - Caché de estadísticas globales
 * - Refetch automático cada 5 minutos
 * - Estados de loading/error gestionados
 */

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats, type DashboardStats } from '@/lib/api';

/**
 * Hook para fetching de estadísticas del dashboard
 * 
 * Características:
 * - Caché compartida globalmente
 * - Refetch en background cada 5 minutos
 * - Retry automático en errores
 * 
 * @returns { stats, isLoading, isError, error, refetch }
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    
    queryFn: fetchDashboardStats,

    // Refetch automático cada 5 minutos (stats cambian lentamente)
    refetchInterval: 5 * 60 * 1000, // 5min

    // Mantener datos previos durante refetch
    placeholderData: (previousData) => previousData,

    // StaleTime de 2 minutos (menor que refetchInterval)
    staleTime: 2 * 60 * 1000, // 2min
  });
}
