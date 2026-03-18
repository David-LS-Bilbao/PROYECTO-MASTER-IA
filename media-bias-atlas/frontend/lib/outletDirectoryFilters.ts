import { IdeologyLabel, Outlet, OutletBiasStatus } from '@/types';

export type OutletProfileAvailabilityFilter = '' | 'available' | 'limited';
export type OutletProfileStatusFilter = '' | OutletBiasStatus | 'NO_SUMMARY';
export type OutletDirectorySort = '' | 'name' | 'completed-analyses' | 'profile-first';

export interface OutletDirectoryFilters {
  availability?: string;
  status?: string;
  ideology?: string;
  sort?: string;
}

function hasAvailableProfile(outlet: Outlet): boolean {
  return outlet.biasSummary?.status === 'ANALYZED';
}

function matchesAvailability(outlet: Outlet, availability?: string): boolean {
  if (!availability) {
    return true;
  }

  if (availability === 'available') {
    return hasAvailableProfile(outlet);
  }

  if (availability === 'limited') {
    return !hasAvailableProfile(outlet);
  }

  return true;
}

function matchesStatus(outlet: Outlet, status?: string): boolean {
  if (!status) {
    return true;
  }

  if (status === 'NO_SUMMARY') {
    return !outlet.biasSummary;
  }

  return outlet.biasSummary?.status === status;
}

function matchesIdeology(outlet: Outlet, ideology?: string): boolean {
  if (!ideology) {
    return true;
  }

  return outlet.biasSummary?.dominantLabel === ideology;
}

function sortByName(a: Outlet, b: Outlet): number {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}

function getCompletedAnalyses(outlet: Outlet): number {
  return outlet.biasSummary?.totalCompletedAnalyses ?? 0;
}

export function filterAndSortOutlets(outlets: Outlet[], filters: OutletDirectoryFilters): Outlet[] {
  const filtered = outlets.filter((outlet) => (
    matchesAvailability(outlet, filters.availability)
    && matchesStatus(outlet, filters.status)
    && matchesIdeology(outlet, filters.ideology)
  ));

  const sort = filters.sort || 'name';

  return [...filtered].sort((a, b) => {
    if (sort === 'completed-analyses') {
      return getCompletedAnalyses(b) - getCompletedAnalyses(a) || sortByName(a, b);
    }

    if (sort === 'profile-first') {
      return Number(hasAvailableProfile(b)) - Number(hasAvailableProfile(a))
        || getCompletedAnalyses(b) - getCompletedAnalyses(a)
        || sortByName(a, b);
    }

    return sortByName(a, b);
  });
}

export function hasActiveOutletDirectoryFilters(filters: OutletDirectoryFilters): boolean {
  return Boolean(
    filters.availability
    || filters.status
    || filters.ideology
    || (filters.sort && filters.sort !== 'name')
  );
}

export function isValidOutletBiasStatus(value?: string): value is OutletBiasStatus {
  return value === 'ANALYZED' || value === 'INSUFFICIENT_DATA';
}

export function isValidIdeologyLabel(value?: string): value is IdeologyLabel {
  return value === 'LEFT'
    || value === 'CENTER_LEFT'
    || value === 'CENTER'
    || value === 'CENTER_RIGHT'
    || value === 'RIGHT'
    || value === 'UNCLEAR';
}

export function isValidAvailabilityFilter(value?: string): value is Exclude<OutletProfileAvailabilityFilter, ''> {
  return value === 'available' || value === 'limited';
}

export function isValidOutletDirectorySort(value?: string): value is Exclude<OutletDirectorySort, ''> {
  return value === 'name' || value === 'completed-analyses' || value === 'profile-first';
}
