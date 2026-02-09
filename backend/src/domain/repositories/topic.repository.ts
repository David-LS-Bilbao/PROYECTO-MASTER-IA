/**
 * ITopicRepository Interface (Domain Layer)
 * Pure contract - NO implementation details
 *
 * Sprint 20: Topics/Categories Management
 */

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number | null;
  createdAt: Date;
}

export interface ITopicRepository {
  /**
   * Find all topics ordered by `order` field (or alphabetically if no order)
   * @returns All topics sorted by display order
   */
  findAll(): Promise<Topic[]>;

  /**
   * Find topic by slug
   * @param slug - URL-friendly topic identifier
   * @returns Topic if found, null otherwise
   */
  findBySlug(slug: string): Promise<Topic | null>;
}
