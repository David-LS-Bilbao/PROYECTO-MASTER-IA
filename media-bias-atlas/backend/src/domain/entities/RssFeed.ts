export interface RssFeed {
  id: string;
  outletId: string;
  url: string;
  category: string | null;
  isActive: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
