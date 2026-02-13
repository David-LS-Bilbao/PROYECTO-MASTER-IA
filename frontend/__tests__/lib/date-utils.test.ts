/**
 * Tests for Date Utilities
 * Sprint 19.5 - Tarea 2: Separadores de Fecha
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatRelativeDate, groupArticlesByDate } from '@/lib/date-utils';
import type { NewsArticle } from '@/lib/api';

describe('formatRelativeDate', () => {
  beforeEach(() => {
    // Mock current date to 2024-02-06 12:00:00
    vi.setSystemTime(new Date('2024-02-06T12:00:00Z'));
  });

  it('formats today\'s date correctly', () => {
    const result = formatRelativeDate('2024-02-06T10:00:00Z');
    expect(result).toContain('Hoy');
    expect(result).toContain('6 de febrero');
  });

  it('formats yesterday\'s date correctly', () => {
    const result = formatRelativeDate('2024-02-05T10:00:00Z');
    expect(result).toContain('Ayer');
    expect(result).toContain('5 de febrero');
  });

  it('formats recent dates (< 7 days) with weekday', () => {
    const result = formatRelativeDate('2024-02-04T10:00:00Z'); // 2 days ago (Sunday)
    // Should include day name capitalized
    expect(result).toMatch(/^[A-Z]/); // First letter capitalized
    expect(result).toContain('de febrero');
  });

  it('formats older dates (>= 7 days) without weekday', () => {
    const result = formatRelativeDate('2024-01-30T10:00:00Z'); // 7+ days ago
    expect(result).toContain('de enero');
    expect(result).toContain('2024');
  });

  it('handles different months correctly', () => {
    const result = formatRelativeDate('2024-01-15T10:00:00Z');
    expect(result).toContain('enero');
  });
});

describe('groupArticlesByDate', () => {
  const createMockArticle = (
    id: string,
    title: string,
    publishedAt: string,
    url: string,
    source: string
  ): NewsArticle => ({
    id,
    title,
    description: null,
    content: null,
    url,
    urlToImage: null,
    source,
    author: null,
    publishedAt,
    category: 'general',
    language: 'es',
    summary: null,
    biasScore: null,
    analysis: null,
    analyzedAt: null,
    isFavorite: false,
  });

  const mockArticles: NewsArticle[] = [
    createMockArticle('1', 'Article 1', '2024-02-06T10:00:00Z', 'https://example.com/1', 'Source 1'),
    createMockArticle('2', 'Article 2', '2024-02-06T14:00:00Z', 'https://example.com/2', 'Source 2'),
    createMockArticle('3', 'Article 3', '2024-02-05T10:00:00Z', 'https://example.com/3', 'Source 3'),
    createMockArticle('4', 'Article 4', '2024-02-04T10:00:00Z', 'https://example.com/4', 'Source 4'),
  ];

  beforeEach(() => {
    vi.setSystemTime(new Date('2024-02-06T12:00:00Z'));
  });

  it('groups articles by date correctly', () => {
    const groups = groupArticlesByDate(mockArticles);

    expect(groups).toHaveLength(3); // 3 different dates
    expect(groups[0].articles).toHaveLength(2); // 2 articles on Feb 6
    expect(groups[1].articles).toHaveLength(1); // 1 article on Feb 5
    expect(groups[2].articles).toHaveLength(1); // 1 article on Feb 4
  });

  it('sorts groups by date descending (most recent first)', () => {
    const groups = groupArticlesByDate(mockArticles);

    expect(groups[0].date).toBe('2024-02-06'); // Today first
    expect(groups[1].date).toBe('2024-02-05'); // Yesterday second
    expect(groups[2].date).toBe('2024-02-04'); // 2 days ago third
  });

  it('formats group labels correctly', () => {
    const groups = groupArticlesByDate(mockArticles);

    expect(groups[0].label).toContain('Hoy');
    expect(groups[1].label).toContain('Ayer');
  });

  it('includes correct article count in each group', () => {
    const groups = groupArticlesByDate(mockArticles);

    expect(groups[0].articles).toHaveLength(2);
    expect(groups[1].articles).toHaveLength(1);
    expect(groups[2].articles).toHaveLength(1);
  });

  it('handles empty array', () => {
    const groups = groupArticlesByDate([]);

    expect(groups).toHaveLength(0);
  });

  it('handles single article', () => {
    const groups = groupArticlesByDate([mockArticles[0]]);

    expect(groups).toHaveLength(1);
    expect(groups[0].articles).toHaveLength(1);
  });

  it('preserves article order within groups', () => {
    const groups = groupArticlesByDate(mockArticles);

    expect(groups[0].articles[0].id).toBe('1');
    expect(groups[0].articles[1].id).toBe('2');
  });

  it('generates correct date keys (YYYY-MM-DD format)', () => {
    const groups = groupArticlesByDate(mockArticles);

    expect(groups[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(groups[1].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(groups[2].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
