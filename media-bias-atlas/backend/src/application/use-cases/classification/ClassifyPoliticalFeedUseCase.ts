import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { ClassifyPoliticalArticleUseCase } from './ClassifyPoliticalArticleUseCase';
import { ClassificationStatus } from '../../../domain/entities/Article';

export class ClassifyPoliticalFeedUseCase {
  constructor(
    private readonly articleRepository: IArticleRepository,
    private readonly classifyArticleUseCase: ClassifyPoliticalArticleUseCase
  ) {}

  async execute(feedId: string) {
    if (!feedId) {
      throw new Error('El ID del Feed es obligatorio');
    }

    // Buscamos hasta 500 artículos del feed
    const articles = await this.articleRepository.findByFeedId(feedId, 500);
    
    // Filtramos los que falte clasificar o hayan fallado previamente
    const articlesToClassify = articles.filter(a => a.classificationStatus !== ClassificationStatus.COMPLETED);

    let processed = 0;
    let politicalCount = 0;
    let nonPoliticalCount = 0;
    let failedCount = 0;

    for (const article of articlesToClassify) {
      try {
        const result = await this.classifyArticleUseCase.execute(article.id);
        processed++;
        if (result.classificationStatus === ClassificationStatus.FAILED || result.isPolitical === null) {
          failedCount++;
        } else if (result.isPolitical) {
          politicalCount++;
        } else {
          nonPoliticalCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    return {
      totalProcessed: processed,
      politicalCount,
      nonPoliticalCount,
      failedCount
    };
  }
}
