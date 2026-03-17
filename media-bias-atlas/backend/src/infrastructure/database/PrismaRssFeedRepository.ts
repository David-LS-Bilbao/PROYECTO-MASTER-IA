import { PrismaClient } from '@prisma/client';
import { RssFeed } from '../../domain/entities/RssFeed';
import { IRssFeedRepository } from '../../domain/repositories/IRssFeedRepository';

export class PrismaRssFeedRepository implements IRssFeedRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(feed: Omit<RssFeed, 'id' | 'createdAt' | 'updatedAt' | 'lastCheckedAt'>): Promise<RssFeed> {
    const created = await this.prisma.rssFeed.create({
      data: {
        outletId: feed.outletId,
        url: feed.url,
        category: feed.category,
        isActive: feed.isActive,
      },
    });

    return {
      ...created,
      lastCheckedAt: created.lastCheckedAt || null,
    };
  }

  async findAllByOutletId(outletId: string): Promise<RssFeed[]> {
    const feeds = await this.prisma.rssFeed.findMany({
      where: { outletId },
      orderBy: { createdAt: 'desc' },
    });

    return feeds.map(f => ({
      ...f,
      lastCheckedAt: f.lastCheckedAt || null,
    }));
  }

  async findById(id: string): Promise<RssFeed | null> {
    const feed = await this.prisma.rssFeed.findUnique({
      where: { id },
    });

    if (!feed) return null;

    return {
      ...feed,
      lastCheckedAt: feed.lastCheckedAt || null,
    };
  }

  async updateLastCheckedAt(id: string, date: Date): Promise<void> {
    await this.prisma.rssFeed.update({
      where: { id },
      data: { lastCheckedAt: date },
    });
  }
}
