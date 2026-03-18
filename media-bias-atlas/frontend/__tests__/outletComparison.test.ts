import { describe, expect, it } from 'vitest';
import { Outlet } from '@/types';
import { resolveOutletComparisonSelection } from '@/lib/outletComparison';

const outlets: Outlet[] = [
  {
    id: 'outlet-1',
    name: 'Alpha Diario',
    websiteUrl: 'https://alpha.example.com',
    countryId: 'ES',
    biasSummary: null,
  },
  {
    id: 'outlet-2',
    name: 'Beta Noticias',
    websiteUrl: 'https://beta.example.com',
    countryId: 'ES',
    biasSummary: null,
  },
];

describe('resolveOutletComparisonSelection', () => {
  it('resuelve dos outlets válidos para comparar', () => {
    const result = resolveOutletComparisonSelection(outlets, 'outlet-1', 'outlet-2');

    expect(result.primaryOutlet?.id).toBe('outlet-1');
    expect(result.secondaryOutlet?.id).toBe('outlet-2');
    expect(result.hasDuplicateSelection).toBe(false);
  });

  it('descarta selección duplicada del mismo outlet', () => {
    const result = resolveOutletComparisonSelection(outlets, 'outlet-1', 'outlet-1');

    expect(result.primaryOutlet?.id).toBe('outlet-1');
    expect(result.secondaryOutlet).toBeNull();
    expect(result.hasDuplicateSelection).toBe(true);
  });

  it('ignora ids inexistentes sin romper la comparativa', () => {
    const result = resolveOutletComparisonSelection(outlets, 'missing', 'outlet-2');

    expect(result.primaryOutlet).toBeNull();
    expect(result.secondaryOutlet?.id).toBe('outlet-2');
    expect(result.hasDuplicateSelection).toBe(false);
  });
});
