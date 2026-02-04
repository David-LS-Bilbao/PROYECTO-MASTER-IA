import { describe, it, expect } from 'vitest';
import {
  getBiasInfo,
  getSentimentInfo,
  formatDate,
  isValidUUID,
  isSafeUrl,
} from './news-utils';

describe('news-utils', () => {
  describe('getBiasInfo', () => {
    it('should return "Muy Neutral" for scores <= 0.2', () => {
      expect(getBiasInfo(0)).toEqual({
        label: 'Muy Neutral',
        color: 'text-green-700',
        bg: 'bg-green-100',
      });
      expect(getBiasInfo(0.1)).toEqual({
        label: 'Muy Neutral',
        color: 'text-green-700',
        bg: 'bg-green-100',
      });
      expect(getBiasInfo(0.2)).toEqual({
        label: 'Muy Neutral',
        color: 'text-green-700',
        bg: 'bg-green-100',
      });
    });

    it('should return "Ligero Sesgo" for scores > 0.2 and <= 0.4', () => {
      expect(getBiasInfo(0.21)).toEqual({
        label: 'Ligero Sesgo',
        color: 'text-blue-700',
        bg: 'bg-blue-100',
      });
      expect(getBiasInfo(0.3)).toEqual({
        label: 'Ligero Sesgo',
        color: 'text-blue-700',
        bg: 'bg-blue-100',
      });
      expect(getBiasInfo(0.4)).toEqual({
        label: 'Ligero Sesgo',
        color: 'text-blue-700',
        bg: 'bg-blue-100',
      });
    });

    it('should return "Sesgo Moderado" for scores > 0.4 and <= 0.6', () => {
      expect(getBiasInfo(0.41)).toEqual({
        label: 'Sesgo Moderado',
        color: 'text-amber-700',
        bg: 'bg-amber-100',
      });
      expect(getBiasInfo(0.5)).toEqual({
        label: 'Sesgo Moderado',
        color: 'text-amber-700',
        bg: 'bg-amber-100',
      });
      expect(getBiasInfo(0.6)).toEqual({
        label: 'Sesgo Moderado',
        color: 'text-amber-700',
        bg: 'bg-amber-100',
      });
    });

    it('should return "Sesgo Alto" for scores > 0.6 and <= 0.8', () => {
      expect(getBiasInfo(0.61)).toEqual({
        label: 'Sesgo Alto',
        color: 'text-orange-700',
        bg: 'bg-orange-100',
      });
      expect(getBiasInfo(0.7)).toEqual({
        label: 'Sesgo Alto',
        color: 'text-orange-700',
        bg: 'bg-orange-100',
      });
      expect(getBiasInfo(0.8)).toEqual({
        label: 'Sesgo Alto',
        color: 'text-orange-700',
        bg: 'bg-orange-100',
      });
    });

    it('should return "Muy Sesgado" for scores > 0.8', () => {
      expect(getBiasInfo(0.81)).toEqual({
        label: 'Muy Sesgado',
        color: 'text-red-700',
        bg: 'bg-red-100',
      });
      expect(getBiasInfo(0.9)).toEqual({
        label: 'Muy Sesgado',
        color: 'text-red-700',
        bg: 'bg-red-100',
      });
      expect(getBiasInfo(1)).toEqual({
        label: 'Muy Sesgado',
        color: 'text-red-700',
        bg: 'bg-red-100',
      });
    });
  });

  describe('getSentimentInfo', () => {
    it('should return positive sentiment with happy emoji', () => {
      expect(getSentimentInfo('positive')).toEqual({
        label: 'Positivo',
        emoji: '😊',
      });
    });

    it('should return negative sentiment with sad emoji', () => {
      expect(getSentimentInfo('negative')).toEqual({
        label: 'Negativo',
        emoji: '😟',
      });
    });

    it('should return neutral sentiment for "neutral" value', () => {
      expect(getSentimentInfo('neutral')).toEqual({
        label: 'Neutral',
        emoji: '😐',
      });
    });

    it('should return neutral sentiment for any other value', () => {
      expect(getSentimentInfo('unknown')).toEqual({
        label: 'Neutral',
        emoji: '😐',
      });
      expect(getSentimentInfo('')).toEqual({
        label: 'Neutral',
        emoji: '😐',
      });
    });
  });

  describe('formatDate', () => {
    it('should format date to Spanish locale with full details', () => {
      const dateString = '2024-01-15T14:30:00Z';
      const result = formatDate(dateString);
      
      // Should contain day, month, year, hour, minute
      expect(result).toMatch(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/i);
      expect(result).toMatch(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i);
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should handle different dates correctly', () => {
      const result1 = formatDate('2026-02-04T10:00:00Z');
      const result2 = formatDate('2025-12-25T23:59:59Z');
      
      expect(result1).toContain('2026');
      expect(result2).toContain('2025');
      expect(result2).toMatch(/diciembre/i);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1 UUID
      expect(isValidUUID('550e8400-e29b-21d4-a716-446655440000')).toBe(false); // v2 UUID
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // Incomplete
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No hyphens
    });

    it('should return false for malformed UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false); // Invalid char
      expect(isValidUUID('../../admin')).toBe(false); // Path traversal attempt
      expect(isValidUUID("'; DROP TABLE--")).toBe(false); // SQL injection attempt
    });
  });

  describe('isSafeUrl', () => {
    it('should return true for HTTP URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
      expect(isSafeUrl('http://example.com/path?query=value')).toBe(true);
    });

    it('should return true for HTTPS URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('https://sub.example.com/path')).toBe(true);
      expect(isSafeUrl('https://example.com:8080/secure')).toBe(true);
    });

    it('should return false for dangerous schemes', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript:void(0)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('ftp://example.com')).toBe(false);
    });

    it('should return false for empty or invalid URLs', () => {
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl('not-a-url')).toBe(false);
      expect(isSafeUrl('//example.com')).toBe(false); // Protocol-relative
    });

    it('should be case-sensitive for security', () => {
      expect(isSafeUrl('HTTP://example.com')).toBe(false);
      expect(isSafeUrl('HTTPS://example.com')).toBe(false);
      expect(isSafeUrl('Http://example.com')).toBe(false);
    });
  });
});
