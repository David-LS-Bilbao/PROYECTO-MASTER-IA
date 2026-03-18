import { describe, expect, it } from 'vitest';
import { Outlet } from '@/types';
import { filterAndSortOutlets, hasActiveOutletDirectoryFilters } from '@/lib/outletDirectoryFilters';

function buildOutlet(overrides: Partial<Outlet> = {}): Outlet {
  return {
    id: 'outlet-1',
    name: 'Medio Base',
    websiteUrl: 'https://example.com',
    countryId: 'ES',
    biasSummary: null,
    ...overrides,
  };
}

describe('outletDirectoryFilters', () => {
  const outlets: Outlet[] = [
    buildOutlet({
      id: 'o-2',
      name: 'Beta Noticias',
      biasSummary: {
        status: 'INSUFFICIENT_DATA',
        dominantLabel: null,
        totalPoliticalArticles: 4,
        totalCompletedAnalyses: 2,
      },
    }),
    buildOutlet({
      id: 'o-3',
      name: 'Gamma Press',
      biasSummary: null,
    }),
    buildOutlet({
      id: 'o-1',
      name: 'Alpha Diario',
      biasSummary: {
        status: 'ANALYZED',
        dominantLabel: 'CENTER_LEFT',
        totalPoliticalArticles: 12,
        totalCompletedAnalyses: 9,
      },
    }),
  ];

  it('filtra por disponibilidad de perfil', () => {
    expect(filterAndSortOutlets(outlets, { availability: 'available' }).map((outlet) => outlet.id)).toEqual(['o-1']);
    expect(filterAndSortOutlets(outlets, { availability: 'limited' }).map((outlet) => outlet.id)).toEqual(['o-2', 'o-3']);
  });

  it('filtra por estado e ideologia dominante', () => {
    expect(filterAndSortOutlets(outlets, { status: 'INSUFFICIENT_DATA' }).map((outlet) => outlet.id)).toEqual(['o-2']);
    expect(filterAndSortOutlets(outlets, { status: 'NO_SUMMARY' }).map((outlet) => outlet.id)).toEqual(['o-3']);
    expect(filterAndSortOutlets(outlets, { ideology: 'CENTER_LEFT' }).map((outlet) => outlet.id)).toEqual(['o-1']);
  });

  it('ordena por analisis completados y por perfil disponible primero', () => {
    expect(filterAndSortOutlets(outlets, { sort: 'completed-analyses' }).map((outlet) => outlet.id)).toEqual(['o-1', 'o-2', 'o-3']);
    expect(filterAndSortOutlets(outlets, { sort: 'profile-first' }).map((outlet) => outlet.id)).toEqual(['o-1', 'o-2', 'o-3']);
  });

  it('detecta si hay filtros activos', () => {
    expect(hasActiveOutletDirectoryFilters({})).toBe(false);
    expect(hasActiveOutletDirectoryFilters({ sort: 'name' })).toBe(false);
    expect(hasActiveOutletDirectoryFilters({ availability: 'available' })).toBe(true);
    expect(hasActiveOutletDirectoryFilters({ sort: 'completed-analyses' })).toBe(true);
  });
});
