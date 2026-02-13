/**
 * NewsArticle Entity (Domain Layer)
 * Pure domain entity - NO external dependencies
 */

export interface NewsArticleProps {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  author: string | null;
  publishedAt: Date;
  category: string | null; // DEPRECATED: Use topicId (Sprint 23)
  topicId: string | null; // Sprint 23: Foreign key to Topic table
  language: string;
  embedding: string | null;
  // AI Analysis fields
  summary: string | null;
  biasScore: number | null;
  analysis: string | null;
  analyzedAt: Date | null;
  internalReasoning: string | null; // Chain-of-Thought for XAI auditing
  // User features
  isFavorite: boolean;
  // Metadata
  fetchedAt: Date;
  updatedAt: Date;
}

/**
 * Fact-checking result for an article
 */
export interface FactCheck {
  claims: string[];
  verdict:
    | 'SupportedByArticle'
    | 'NotSupportedByArticle'
    | 'InsufficientEvidenceInArticle';
  reasoning: string;
}

/**
 * Token usage and cost information from Gemini API
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimated: number; // En Euros
}

/**
 * Complete AI analysis of a news article
 */
export interface ArticleAnalysis {
  internal_reasoning?: string; // Chain-of-Thought (XAI auditing only, excluded from client response)
  summary: string;
  category?: string; // AI-suggested category for the article
  analysisModeUsed?: 'low_cost' | 'moderate' | 'standard';

  // Legacy normalized score alias (0-1), kept for compatibility
  biasScore: number;

  // vNext scoring contract
  biasRaw: number; // -10..+10
  biasScoreNormalized: number; // abs(biasRaw)/10

  biasType?: string; // Tipo de sesgo: encuadre|omision|lenguaje|seleccion|ninguno
  biasIndicators: string[];
  // Comentario corto para UI (explicabilidad textual, sin hechos externos)
  biasComment?: string;
  // Tendencia ideologica del articulo (solo con evidencia citada suficiente)
  articleLeaning?: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
  // Legacy alias para compatibilidad hacia atras (deprecado)
  biasLeaning?: 'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra';
  clickbaitScore: number; // 0..100

  // reliabilityScore: fiabilidad basada SOLO en evidencia interna del texto (0-100)
  reliabilityScore: number;
  // traceabilityScore: trazabilidad interna de fuentes/citas/contexto (0-100)
  traceabilityScore: number;

  factualityStatus: 'no_determinable' | 'plausible_but_unverified';
  evidence_needed: string[];
  should_escalate: boolean;
  // Comentario corto sobre fiabilidad interna y evidencia faltante
  reliabilityComment?: string;

  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factCheck: FactCheck;
  explanation?: string; // Transparencia AI Act: por que se asignaron estos scores

  // Token Taximeter: Cost tracking (Sprint 8.2)
  usage?: TokenUsage;
}

export class NewsArticle {
  private constructor(private readonly props: NewsArticleProps) {
    this.validate();
  }

  private validate(): void {
    if (!this.props.id || this.props.id.trim() === '') {
      throw new Error('NewsArticle ID is required');
    }
    if (!this.props.title || this.props.title.trim() === '') {
      throw new Error('NewsArticle title is required');
    }
    if (!this.props.url || this.props.url.trim() === '') {
      throw new Error('NewsArticle URL is required');
    }
    if (!this.props.source || this.props.source.trim() === '') {
      throw new Error('NewsArticle source is required');
    }
  }

  static create(props: NewsArticleProps): NewsArticle {
    return new NewsArticle(props);
  }

  static reconstitute(props: NewsArticleProps): NewsArticle {
    return new NewsArticle(props);
  }

  get id(): string {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get content(): string | null {
    return this.props.content;
  }

  get url(): string {
    return this.props.url;
  }

  get urlToImage(): string | null {
    return this.props.urlToImage;
  }

  get source(): string {
    return this.props.source;
  }

  get author(): string | null {
    return this.props.author;
  }

  get publishedAt(): Date {
    return this.props.publishedAt;
  }

  get category(): string | null {
    return this.props.category;
  }

  get topicId(): string | null {
    return this.props.topicId;
  }

  get language(): string {
    return this.props.language;
  }

  get embedding(): string | null {
    return this.props.embedding;
  }

  get summary(): string | null {
    return this.props.summary;
  }

  get biasScore(): number | null {
    return this.props.biasScore;
  }

  get analysis(): string | null {
    return this.props.analysis;
  }

  get analyzedAt(): Date | null {
    return this.props.analyzedAt;
  }

  get internalReasoning(): string | null {
    return this.props.internalReasoning;
  }

  get fetchedAt(): Date {
    return this.props.fetchedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isAnalyzed(): boolean {
    return this.props.analyzedAt !== null;
  }

  get isFavorite(): boolean {
    return this.props.isFavorite;
  }

  /**
   * Get parsed analysis object
   */
  getParsedAnalysis(): ArticleAnalysis | null {
    if (!this.props.analysis) return null;
    try {
      return JSON.parse(this.props.analysis) as ArticleAnalysis;
    } catch {
      return null;
    }
  }

  /**
   * Create a new instance with analysis data
   */
  withAnalysis(analysis: ArticleAnalysis): NewsArticle {
    return NewsArticle.reconstitute({
      ...this.props,
      summary: analysis.summary,
      biasScore: analysis.biasScoreNormalized,
      analysis: JSON.stringify(analysis),
      analyzedAt: new Date(),
      internalReasoning: analysis.internal_reasoning || null, // Store for XAI auditing
      updatedAt: new Date(),
    });
  }

  /**
   * Create a new instance with full content (from scraping)
   */
  withFullContent(content: string): NewsArticle {
    return NewsArticle.reconstitute({
      ...this.props,
      content,
      updatedAt: new Date(),
    });
  }

  /**
   * Create a new instance with image URL
   */
  withImage(imageUrl: string): NewsArticle {
    return NewsArticle.reconstitute({
      ...this.props,
      urlToImage: imageUrl,
      updatedAt: new Date(),
    });
  }

  /**
   * Toggle favorite status
   */
  withFavoriteToggle(): NewsArticle {
    return NewsArticle.reconstitute({
      ...this.props,
      isFavorite: !this.props.isFavorite,
      updatedAt: new Date(),
    });
  }

  toJSON(): NewsArticleProps {
    const { internalReasoning, ...publicProps } = this.props;
    // Exclude internalReasoning from client responses (XAI auditing only per AI_RULES.md)
    return publicProps as NewsArticleProps;
  }
}
