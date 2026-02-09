/**
 * URL Security Validator - SSRF Protection
 *
 * Prevents Server-Side Request Forgery attacks by validating URLs
 * before making external HTTP requests.
 *
 * OWASP Top 10: A10:2021 – Server-Side Request Forgery (SSRF)
 *
 * @module shared/utils/url-validator
 */

import { lookup } from 'dns';
import { promisify } from 'util';
import { SecurityError } from '../../domain/errors/domain.error';

const dnsLookup = promisify(lookup);

/**
 * Private IPv4 ranges (RFC 1918 + loopback + link-local)
 */
const PRIVATE_IPV4_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },        // 10.0.0.0/8
  { start: '172.16.0.0', end: '172.31.255.255' },      // 172.16.0.0/12
  { start: '192.168.0.0', end: '192.168.255.255' },    // 192.168.0.0/16
  { start: '127.0.0.0', end: '127.255.255.255' },      // 127.0.0.0/8 (loopback)
  { start: '169.254.0.0', end: '169.254.255.255' },    // 169.254.0.0/16 (link-local)
  { start: '0.0.0.0', end: '0.0.0.0' },                // 0.0.0.0 (unspecified)
];

/**
 * Blocked hostnames (metadata services, localhost variants)
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',  // GCP metadata
  'metadata',                   // Generic metadata
  '169.254.169.254',            // AWS/Azure metadata IP
];

/**
 * IPv6 private patterns
 */
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/,                      // IPv6 loopback
  /^fe80:/i,                    // IPv6 link-local
  /^fc00:/i,                    // IPv6 unique local
  /^fd00:/i,                    // IPv6 unique local
];

export class UrlValidator {
  /**
   * Validates a URL to prevent SSRF attacks
   *
   * @param urlString - URL to validate
   * @returns Promise<boolean> - true if safe, throws SecurityError if unsafe
   * @throws SecurityError if URL points to internal/private network
   */
  static async validate(urlString: string): Promise<boolean> {
    // STEP 1: Parse and validate URL format
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      throw new SecurityError(
        `Invalid URL format: ${urlString}`,
        'URL_VALIDATION_FAILED'
      );
    }

    // STEP 2: Check protocol (only HTTP/HTTPS allowed)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new SecurityError(
        `Protocol ${url.protocol} is not allowed. Only HTTP/HTTPS are permitted.`,
        'INVALID_PROTOCOL'
      );
    }

    // STEP 3: Check blocked hostnames (before DNS lookup)
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      throw new SecurityError(
        `Blocked internal network access: ${hostname}`,
        'SSRF_BLOCKED'
      );
    }

    // STEP 4: Resolve hostname to IP address via DNS
    let resolvedIP: string;
    try {
      const result = await dnsLookup(url.hostname);
      resolvedIP = result.address;
    } catch (error) {
      // DNS resolution failed - could be invalid domain or network issue
      throw new SecurityError(
        `Failed to resolve hostname: ${url.hostname}`,
        'DNS_RESOLUTION_FAILED'
      );
    }

    // STEP 5: Check if resolved IP is private/internal
    if (this.isPrivateIP(resolvedIP)) {
      throw new SecurityError(
        `Blocked internal network access: ${url.hostname} resolves to private IP ${resolvedIP}`,
        'SSRF_BLOCKED'
      );
    }

    // URL is safe
    return true;
  }

  /**
   * Checks if an IP address is private/internal
   *
   * @param ip - IP address (v4 or v6)
   * @returns true if IP is private/internal
   */
  private static isPrivateIP(ip: string): boolean {
    // Check IPv6 private patterns
    if (ip.includes(':')) {
      return PRIVATE_IPV6_PATTERNS.some(pattern => pattern.test(ip));
    }

    // Check IPv4 private ranges
    const ipNum = this.ipToNumber(ip);
    return PRIVATE_IPV4_RANGES.some(range => {
      const startNum = this.ipToNumber(range.start);
      const endNum = this.ipToNumber(range.end);
      return ipNum >= startNum && ipNum <= endNum;
    });
  }

  /**
   * Converts IPv4 address to numeric representation for range comparison
   *
   * @param ip - IPv4 address (e.g., "192.168.1.1")
   * @returns Numeric representation
   */
  private static ipToNumber(ip: string): number {
    return ip.split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Quick validation for URLs without DNS lookup (faster, less secure)
   * Use only for pre-filtering, not as primary security check.
   *
   * @param urlString - URL to check
   * @returns true if URL looks safe (protocol + hostname check only)
   */
  static quickCheck(urlString: string): boolean {
    try {
      const url = new URL(urlString);

      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }

      // Check blocked hostnames
      const hostname = url.hostname.toLowerCase();
      if (BLOCKED_HOSTNAMES.includes(hostname)) {
        return false;
      }

      // Check if hostname looks like a private IP (without DNS lookup)
      if (this.looksLikePrivateIP(hostname)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Heuristic check if hostname looks like a private IP (without DNS)
   *
   * @param hostname - Hostname to check
   * @returns true if hostname matches private IP pattern
   */
  private static looksLikePrivateIP(hostname: string): boolean {
    // Check if it's an IP address (v4 or v6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

    if (!ipv4Regex.test(hostname) && !ipv6Regex.test(hostname)) {
      return false; // Not an IP, probably a domain name (needs DNS lookup)
    }

    // If it's an IPv6, check patterns
    if (hostname.includes(':')) {
      return PRIVATE_IPV6_PATTERNS.some(pattern => pattern.test(hostname));
    }

    // If it's an IPv4, check ranges
    try {
      const ipNum = this.ipToNumber(hostname);
      return PRIVATE_IPV4_RANGES.some(range => {
        const startNum = this.ipToNumber(range.start);
        const endNum = this.ipToNumber(range.end);
        return ipNum >= startNum && ipNum <= endNum;
      });
    } catch {
      return false;
    }
  }
}
