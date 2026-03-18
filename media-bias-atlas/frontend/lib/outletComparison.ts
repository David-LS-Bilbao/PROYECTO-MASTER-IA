import { Outlet } from '@/types';

export interface OutletComparisonSelection {
  primaryOutlet: Outlet | null;
  secondaryOutlet: Outlet | null;
  hasDuplicateSelection: boolean;
}

export function resolveOutletComparisonSelection(
  outlets: Outlet[],
  compareA?: string,
  compareB?: string,
): OutletComparisonSelection {
  const outletsById = new Map(outlets.map((outlet) => [outlet.id, outlet]));
  const primaryOutlet = compareA ? outletsById.get(compareA) ?? null : null;
  const rawSecondaryOutlet = compareB ? outletsById.get(compareB) ?? null : null;
  const hasDuplicateSelection = Boolean(
    primaryOutlet
    && rawSecondaryOutlet
    && primaryOutlet.id === rawSecondaryOutlet.id
  );

  return {
    primaryOutlet,
    secondaryOutlet: hasDuplicateSelection ? null : rawSecondaryOutlet,
    hasDuplicateSelection,
  };
}
