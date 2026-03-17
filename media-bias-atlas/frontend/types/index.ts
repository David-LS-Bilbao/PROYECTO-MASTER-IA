export interface Country {
  code: string;
  name: string;
}

export interface Outlet {
  id: string;
  name: string;
  websiteUrl: string | null;
  countryId: string;
}

export interface RssFeed {
  id: string;
  outletId: string;
  url: string;
  category: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  isPolitical?: boolean | null;
  classificationStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  classificationReason?: string | null;
  classifiedAt?: string | null;
}
