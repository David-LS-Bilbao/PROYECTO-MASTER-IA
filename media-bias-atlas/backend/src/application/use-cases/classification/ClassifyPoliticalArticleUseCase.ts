import { Article, ClassificationStatus } from '../../../domain/entities/Article';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';

export type ClassificationResult = {
  isPolitical: boolean;
  classificationStatus: ClassificationStatus;
  classificationReason: string;
};

export class ClassifyPoliticalArticleUseCase {
  private readonly strongPoliticalKeywords = [
    'gobierno',
    'elecciones',
    'parlamento',
    'presidente',
    'congreso',
    'senado',
    'ministerio',
    'oposicion',
    'ley',
    'politica',
    'alcalde',
    'ayuntamiento',
    'ministro',
    'ministra',
    'democracia',
    'dictadura',
    'psoe',
    'pp',
    'vox',
    'sumar',
    'podemos',
    'sanchez',
    'feijoo',
    'abascal',
    'candidato',
    'candidata',
    'investidura',
    'amnistia',
    'referendum',
    'coalicion',
    'vicepresidente',
    'vicepresidenta',
    'electoral',
    'junta electoral',
    'ciudadanos',
    'trump',
    'dirigentes',
    'ministros'
  ];

  private readonly contextualPoliticalKeywords = [
    'partido',
    'reforma',
    'diputado',
    'diputada',
    'vota',
    'voto',
    'urna',
    'urnas',
    'presupuestos',
    'legislatura'
  ];

  private readonly discardKeywords = [
    'futbol',
    'cine',
    'musica',
    'receta',
    'videojuego',
    'concierto',
    'tenis',
    'moda',
    'deportes',
    'champions',
    'liga',
    'pelicula',
    'serie',
    'series',
    'actor',
    'actriz',
    'cantante',
    'gastronomia',
    'recetas',
    'fichaje',
    'goles',
    'juego',
    'baloncesto',
    'salud',
    'ciencia',
    'arte',
    'streaming',
    'hbo',
    'netflix',
    'apple',
    'whatsapp',
    'iphone',
    'android',
    'tecnologia',
    'tecnologico',
    'tecnologica',
    'television',
    'tv',
    'festival',
    'podcast',
    'video',
    'videos',
    'videojuegos',
    'smartphone'
  ];

  constructor(private readonly articleRepository: IArticleRepository) {}

  async execute(articleId: string): Promise<Article> {
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new Error(`Artículo con id ${articleId} no encontrado`);
    }

    const textToAnalyze = `${article.title}`;
    
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
    const normalizedText = this.normalizeText(text);
    const strongMatches = this.collectMatches(normalizedText, this.strongPoliticalKeywords);
    const contextualMatches = this.collectMatches(normalizedText, this.contextualPoliticalKeywords);
    const discardMatches = this.collectMatches(normalizedText, this.discardKeywords);

    const strongCount = strongMatches.length;
    const contextualCount = contextualMatches.length;
    const discardCount = discardMatches.length;
    const politicalScore = strongCount * 2 + contextualCount;
    const discardScore = discardCount * 2;

    if (discardCount > 0 && strongCount === 0 && contextualCount < 2) {
      return {
        isPolitical: false,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `No político (descarte claro: ${discardCount}, señales políticas débiles: ${contextualCount})`
      };
    }

    if (strongCount > 0 && politicalScore > discardScore) {
      return {
        isPolitical: true,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `Político (fuertes=${strongCount}, contextuales=${contextualCount}, descarte=${discardCount})`
      };
    }

    if (strongCount === 0 && contextualCount >= 2 && politicalScore > discardScore) {
      return {
        isPolitical: true,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `Político contextual (contextuales=${contextualCount}, descarte=${discardCount})`
      };
    }

    if (discardCount > 0 || contextualCount > 0) {
      return {
        isPolitical: false,
        classificationStatus: ClassificationStatus.COMPLETED,
        classificationReason: `No político (fuertes=${strongCount}, contextuales=${contextualCount}, descarte=${discardCount})`
      };
    }

    return {
      isPolitical: false,
      classificationStatus: ClassificationStatus.COMPLETED,
      classificationReason: `Ambiguo o irrelevante (sin keywords)`
    };
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private collectMatches(text: string, keywords: string[]): string[] {
    return keywords.filter((keyword) => {
      const pattern = new RegExp(`\\b${this.escapeRegExp(keyword)}\\b`, 'u');
      return pattern.test(text);
    });
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
