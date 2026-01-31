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
  category: string | null;
  language: string;
  embedding: string | null;
  // AI Analysis fields
  summary: string | null;
  biasScore: number | null;
  analysis: string | null;
  analyzedAt: Date | null;
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
  verdict: 'Verified' | 'Mixed' | 'Unproven' | 'False';
  reasoning: string;
}

/**
 * Complete AI analysis of a news article
 */
export interface ArticleAnalysis {
  summary: string;
  // biasScore: -10 (Extrema Izquierda) a +10 (Extrema Derecha), 0 es Neutral
  // Stored normalized to 0-1 for UI compatibility (abs(biasScore)/10)
  biasScore: number;
  // Raw bias score from -10 to +10 for detailed display
  biasRaw: number;
  biasIndicators: string[];
  // clickbaitScore: 0 (Serio) a 100 (Clickbait extremo)
  clickbaitScore: number;
  // reliabilityScore: 0 (Bulo/Falso) a 100 (Altamente Contrastado/Oficial)
  reliabilityScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factCheck: FactCheck;
  // Legacy field for backwards compatibility
  factualClaims: string[];
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
      biasScore: analysis.biasScore,
      analysis: JSON.stringify(analysis),
      analyzedAt: new Date(),
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
    return { ...this.props };
  }
}
