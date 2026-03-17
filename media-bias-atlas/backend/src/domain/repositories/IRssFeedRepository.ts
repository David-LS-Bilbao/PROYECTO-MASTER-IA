import { RssFeed } from '../entities/RssFeed';

export interface IRssFeedRepository {
  save(feed: Omit<RssFeed, 'id' | 'createdAt' | 'updatedAt' | 'lastCheckedAt'>): Promise<RssFeed>;
  findAllByOutletId(outletId: string): Promise<RssFeed[]>;
  findById(id: string): Promise<RssFeed | null>;
  updateLastCheckedAt(id: string, date: Date): Promise<void>;
}
