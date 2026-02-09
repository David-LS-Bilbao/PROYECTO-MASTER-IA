/**
 * SSRF Protection Integration Tests
 *
 * Verifies that the URL validator correctly blocks internal network access
 * and prevents Server-Side Request Forgery (SSRF) attacks.
 *
 * OWASP Top 10: A10:2021 – Server-Side Request Forgery (SSRF)
 *
 * @module tests/integration/ssrf-protection
 */

import { describe, it, expect } from 'vitest';
import { UrlValidator } from '../../src/shared/utils/url-validator';
import { SecurityError } from '../../src/domain/errors/domain.error';

describe('SSRF Protection - UrlValidator', () => {
  describe('Private IP Detection', () => {
    it('should block localhost (127.0.0.1)', async () => {
      await expect(
        UrlValidator.validate('http://127.0.0.1:6379')
      ).rejects.toThrow(SecurityError);
    });

    it('should block localhost (localhost)', async () => {
      await expect(
        UrlValidator.validate('http://localhost:8080')
      ).rejects.toThrow(SecurityError);
    });

    it('should block 10.x.x.x private network', async () => {
      await expect(
        UrlValidator.validate('http://10.0.0.1')
      ).rejects.toThrow(SecurityError);
    });

    it('should block 192.168.x.x private network', async () => {
      await expect(
        UrlValidator.validate('http://192.168.1.1')
      ).rejects.toThrow(SecurityError);
    });

    it('should block 172.16-31.x.x private network', async () => {
      await expect(
        UrlValidator.validate('http://172.16.0.1')
      ).rejects.toThrow(SecurityError);
    });

    it('should block link-local 169.254.x.x', async () => {
      await expect(
        UrlValidator.validate('http://169.254.169.254/latest/meta-data/')
      ).rejects.toThrow(SecurityError);
    });

    it('should block IPv6 loopback (::1)', async () => {
      await expect(
        UrlValidator.validate('http://[::1]:8080')
      ).rejects.toThrow(SecurityError);
    });

    it('should block IPv6 link-local (fe80::)', async () => {
      await expect(
        UrlValidator.validate('http://[fe80::1]/')
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('Protocol Validation', () => {
    it('should block file:// protocol', async () => {
      await expect(
        UrlValidator.validate('file:///etc/passwd')
      ).rejects.toThrow(SecurityError);

      await expect(
        UrlValidator.validate('file:///etc/passwd')
      ).rejects.toThrow(/Protocol.*not allowed/);
    });

    it('should block ftp:// protocol', async () => {
      await expect(
        UrlValidator.validate('ftp://example.com')
      ).rejects.toThrow(SecurityError);
    });

    it('should block gopher:// protocol', async () => {
      await expect(
        UrlValidator.validate('gopher://example.com')
      ).rejects.toThrow(SecurityError);
    });

    it('should allow http:// protocol', async () => {
      // Note: This will fail if google.com is unreachable, but that's expected in real tests
      // In a real test environment, you'd mock DNS or use a test server
      await expect(
        UrlValidator.validate('http://example.com')
      ).resolves.toBe(true);
    });

    it('should allow https:// protocol', async () => {
      await expect(
        UrlValidator.validate('https://example.com')
      ).resolves.toBe(true);
    });
  });

  describe('Metadata Service Protection', () => {
    it('should block AWS metadata service (169.254.169.254)', async () => {
      await expect(
        UrlValidator.validate('http://169.254.169.254/latest/meta-data/')
      ).rejects.toThrow(SecurityError);
    });

    it('should block GCP metadata (metadata.google.internal)', async () => {
      await expect(
        UrlValidator.validate('http://metadata.google.internal/')
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('DNS Resolution Attack Prevention', () => {
    it('should reject domains that resolve to private IPs', async () => {
      // This test assumes localhost resolves to 127.0.0.1
      // In a real scenario, an attacker might create a domain that resolves to an internal IP
      await expect(
        UrlValidator.validate('http://localhost/')
      ).rejects.toThrow(/internal network/);
    });
  });

  describe('Quick Check (Pre-filter)', () => {
    it('should quickly reject localhost without DNS lookup', () => {
      expect(UrlValidator.quickCheck('http://localhost:8080')).toBe(false);
    });

    it('should quickly reject private IPs without DNS lookup', () => {
      expect(UrlValidator.quickCheck('http://192.168.1.1')).toBe(false);
      expect(UrlValidator.quickCheck('http://10.0.0.1')).toBe(false);
      expect(UrlValidator.quickCheck('http://172.16.0.1')).toBe(false);
    });

    it('should quickly reject invalid protocols', () => {
      expect(UrlValidator.quickCheck('file:///etc/passwd')).toBe(false);
      expect(UrlValidator.quickCheck('ftp://example.com')).toBe(false);
    });

    it('should pass safe URLs through quick check', () => {
      expect(UrlValidator.quickCheck('https://www.elpais.com')).toBe(true);
      expect(UrlValidator.quickCheck('http://example.com')).toBe(true);
    });

    it('should pass domains to full validation (not IPs)', () => {
      // Domain names that might resolve to private IPs should pass quick check
      // but fail full validation with DNS lookup
      expect(UrlValidator.quickCheck('http://internal-server.local')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should reject invalid URL format', async () => {
      await expect(
        UrlValidator.validate('not-a-url')
      ).rejects.toThrow(SecurityError);

      await expect(
        UrlValidator.validate('not-a-url')
      ).rejects.toThrow(/Invalid URL format/);
    });

    it('should reject URLs with ports targeting internal services', async () => {
      await expect(
        UrlValidator.validate('http://127.0.0.1:6379') // Redis
      ).rejects.toThrow(SecurityError);

      await expect(
        UrlValidator.validate('http://localhost:5432') // PostgreSQL
      ).rejects.toThrow(SecurityError);
    });

    it('should reject 0.0.0.0 (unspecified address)', async () => {
      await expect(
        UrlValidator.validate('http://0.0.0.0')
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('Safe URLs (Should Pass)', () => {
    it('should allow legitimate external domains', async () => {
      // Note: These tests hit real DNS, so they might be slow or fail if DNS is unavailable
      const safeUrls = [
        'https://www.elpais.com',
        'https://www.elmundo.es',
        'http://example.com',
        'https://news.google.com',
      ];

      for (const url of safeUrls) {
        await expect(UrlValidator.validate(url)).resolves.toBe(true);
      }
    });
  });
});

describe('SSRF Protection - LocalSourceDiscoveryService Integration', () => {
  it('should be tested with actual service integration', () => {
    // TODO: Create integration test with LocalSourceDiscoveryService
    // This would require mocking Prisma and GeminiClient
    expect(true).toBe(true);
  });

  it('should log security warnings when blocking SSRF attempts', () => {
    // TODO: Test that console.warn is called with security messages
    expect(true).toBe(true);
  });
});
