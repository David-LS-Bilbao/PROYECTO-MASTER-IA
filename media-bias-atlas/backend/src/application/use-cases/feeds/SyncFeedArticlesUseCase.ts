import Parser from 'rss-parser';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { IRssFeedRepository } from '../../../domain/repositories/IRssFeedRepository';

export interface SyncResult {
  feedId: string;
  checkedAt: string;
  fetched: number;
  inserted: number;
  skipped: number;
  status: 'success' | 'failed';
}

export class SyncFeedArticlesUseCase {
  private parser: Parser;

  constructor(
    private readonly rssFeedRepository: IRssFeedRepository,
    private readonly articleRepository: IArticleRepository
  ) {
    this.parser = new Parser({
      timeout: 8000, 
    });
  }

  async execute(feedId: string): Promise<SyncResult> {
    const feed = await this.rssFeedRepository.findById(feedId);
    
    if (!feed) {
      throw new Error(`Feed con id ${feedId} no encontrado`);
    }

    const now = new Date();
    const result: SyncResult = {
      feedId,
      checkedAt: now.toISOString(),
      fetched: 0,
      inserted: 0,
      skipped: 0,
      status: 'failed',
    };

    try {
      const parsedFeed = await this.parser.parseURL(feed.url);
      
      const articlesToInsert = [];
      const items = parsedFeed.items || [];
      result.fetched = items.length;

      for (const item of items) {
        if (!item.title || !item.link) {
          result.skipped++;
          continue;
        }

        const normalizedUrl = item.link.trim();
        // Validacion super basica de URL
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          result.skipped++;
          continue;
        }

        let pubDate = now;
        if (item.pubDate) {
          const parsedDate = new Date(item.pubDate);
          if (!isNaN(parsedDate.getTime())) {
            pubDate = parsedDate;
          }
        } else if (item.isoDate) {
          pubDate = new Date(item.isoDate);
        }

        articlesToInsert.push({
          feedId: feed.id,
          title: item.title.trim(),
          url: normalizedUrl,
          publishedAt: pubDate
        });
      }

      if (articlesToInsert.length > 0) {
        const { count } = await this.articleRepository.saveManySkipDuplicates(articlesToInsert);
        result.inserted = count;
        result.skipped += (articlesToInsert.length - count);
      } else {
        // En caso todos los validos fallaran
        result.skipped += articlesToInsert.length;
      }
      
      result.status = 'success';
      
      // Marcar el feed como escaneado
      await this.rssFeedRepository.updateLastCheckedAt(feed.id, now);
      
      return result;

    } catch (error) {
      // Manejar silenciosamente XML rotos, caídas de red, timeout, etc.
      // Guardamos la marca de tiempo igual para no bombardear a la DB
      await this.rssFeedRepository.updateLastCheckedAt(feed.id, now);
      
      return result;
    }
  }
}
