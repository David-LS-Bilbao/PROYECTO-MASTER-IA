import { Fragment } from 'react';
import { AdBanner } from '@/components/ads';
import { NewsCard } from '@/components/news-card';
import type { NewsArticle } from '@/lib/api';

interface NewsGridProps {
  articles: NewsArticle[];
}

export function NewsGrid({ articles }: NewsGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => (
        <Fragment key={article.id}>
          <NewsCard article={article} />
          {(index + 1) % 6 === 0 && (
            <AdBanner
              dataAdSlot="1234567890"
              format="fluid"
              className="col-span-1 min-h-[400px]"
              mockLabel="Publicidad Sugerida"
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
