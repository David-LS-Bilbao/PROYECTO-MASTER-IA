import { OutletBiasSummary } from './OutletBiasProfile';

export interface Outlet {
  id: string;
  countryId: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  biasSummary?: OutletBiasSummary | null;
}
