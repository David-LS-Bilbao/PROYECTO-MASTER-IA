import { Article, ClassificationStatus } from '../../../domain/entities/Article';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';

export type ClassificationResult = {
  isPolitical: boolean;
  classificationStatus: ClassificationStatus;
  classificationReason: string;
};

export class ClassifyPoliticalArticleUseCase {
  private readonly politicalKeywords = [
    'gobierno', 'elecciones', 'parlamento', 'presidente', 'congreso', 
    'senado', 'ministerio', 'partido', 'oposición', 'ley', 'reforma', 
    'diputado', 'campaña electoral', 'política', 'alcalde', 'ayuntamiento',
    'ministro', 'ministra', 'vota', 'urna', 'democracia', 'dictadura',
    'psoe', 'pp', 'vox', 'sumar', 'podemos', 'sánchez', 'feijóo', 'abascal'
  ];

  private readonly discardKeywords = [
    'fútbol', 'cine', 'música', 'receta', 'videojuego', 'concierto', 
    'tenis', 'moda', 'deportes', 'champions', 'liga', 'película', 
    'serie', 'actor', 'actriz', 'cantante', 'gastronomía', 'recetas', 'fichaje', 'goles', 'juego', 'baloncesto', 'salud', 'ciencia', 'arte'
  ];

  constructor(private readonly articleRepository: IArticleRepository) {}

  async execute(articleId: string): Promise<Article> {
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new Error(`Artículo con id ${articleId} no encontrado`);
    }

    const textToAnalyze = `${article.title}`.toLowerCase();
    
    if (!textToAnalyze.trim()) {
      return this.articleRepository.updateClassification(articleId, {
        isPolitical: null,
        classificationStatus: ClassificationStatus.FAILED,
        classificationReason: 'Texto vacío o nulo',
        classifiedAt: new Date()
      });
    }

    const { isPolitical, classificationStatus, classificationReason } = this.analyzeText(textToAnalyze);

    return this.articleRepository.updateClassification(articleId, {
      isPolitical,
      classificationStatus,
      classificationReason,
      classifiedAt: new Date()
    });
  }

  public analyzeText(text: string): ClassificationResult {
    let politicalCount = 0;
    let discardCount = 0;
    
    for (const kw of this.politicalKeywords) {
      // Uso de regex simple para evitar falsos positivos si la palabra forma parte de otra mayor
      // Pero flexibilizamos un poco
      if (text.includes(kw)) politicalCount++;
    }

    for (const kw of this.discardKeywords) {
      if (text.includes(kw)) discardCount++;
    }

    if (politicalCount > discardCount) {
      return {
        isPolitical: true,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `Político (${politicalCount} vs ${discardCount})`
      };
    } else if (discardCount > politicalCount) {
      return {
        isPolitical: false,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `No político (${discardCount} vs ${politicalCount})`
      };
    } else if (politicalCount > 0 && politicalCount === discardCount) {
       return {
        isPolitical: false,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `Empate heurístico (se asume No Político)`
      };
    } else {
      return {
        isPolitical: false,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `Ambiguo o irrelevante (sin keywords)`
      };
    }
  }
}
