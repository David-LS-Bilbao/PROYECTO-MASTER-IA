/**
 * Date Utilities (Sprint 19.5 - Tarea 2: Separadores de Fecha)
 *
 * Funciones para formatear y agrupar fechas en la interfaz de noticias
 */

import type { NewsArticle } from './api';

export interface DateGroup {
  label: string;
  date: string; // YYYY-MM-DD format for grouping
  articles: NewsArticle[];
}

/**
 * Formatea una fecha relativa (Hoy, Ayer, o fecha absoluta)
 *
 * @param dateString - ISO date string
 * @returns Formatted date label
 *
 * @example
 * formatRelativeDate('2024-02-06T10:00:00Z') // "Hoy, 6 de febrero"
 * formatRelativeDate('2024-02-05T10:00:00Z') // "Ayer, 5 de febrero"
 * formatRelativeDate('2024-02-04T10:00:00Z') // "Domingo, 4 de febrero"
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Normalize dates to midnight for comparison
  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const normalizedDate = normalizeDate(date);
  const normalizedToday = normalizeDate(today);
  const normalizedYesterday = normalizeDate(yesterday);

  const daysDiff = Math.floor((normalizedToday.getTime() - normalizedDate.getTime()) / (1000 * 60 * 60 * 24));

  // Format: Day, DD de Month
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formattedDate = formatter.format(date);

  if (normalizedDate.getTime() === normalizedToday.getTime()) {
    return `Hoy, ${formattedDate.split(', ')[1]}`; // "Hoy, 6 de febrero"
  } else if (normalizedDate.getTime() === normalizedYesterday.getTime()) {
    return `Ayer, ${formattedDate.split(', ')[1]}`; // "Ayer, 5 de febrero"
  } else if (daysDiff < 7) {
    // Capitalize first letter of weekday
    const capitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    return capitalized; // "Domingo, 4 de febrero"
  } else {
    // For older dates, just show the date without weekday
    const dateOnlyFormatter = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return dateOnlyFormatter.format(date); // "15 de enero de 2024"
  }
}

/**
 * Agrupa artículos por fecha de publicación
 *
 * @param articles - Array of news articles
 * @returns Array of date groups with formatted labels
 *
 * @example
 * groupArticlesByDate(articles) // [
 *   { label: "Hoy, 6 de febrero", date: "2024-02-06", articles: [...] },
 *   { label: "Ayer, 5 de febrero", date: "2024-02-05", articles: [...] }
 * ]
 */
export function groupArticlesByDate(articles: NewsArticle[]): DateGroup[] {
  // Group by date (YYYY-MM-DD)
  const grouped = new Map<string, NewsArticle[]>();

  for (const article of articles) {
    const date = new Date(article.publishedAt);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }

    grouped.get(dateKey)!.push(article);
  }

  // Convert to array and format labels
  const groups: DateGroup[] = [];

  for (const [dateKey, groupArticles] of grouped.entries()) {
    const label = formatRelativeDate(groupArticles[0].publishedAt);

    groups.push({
      label,
      date: dateKey,
      articles: groupArticles,
    });
  }

  // Sort by date descending (most recent first)
  groups.sort((a, b) => b.date.localeCompare(a.date));

  return groups;
}
