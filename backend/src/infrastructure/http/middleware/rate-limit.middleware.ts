/**
 * Rate Limiting Middleware
 *
 * Protects resource-intensive endpoints from abuse and DoS attacks.
 * Uses express-rate-limit to throttle requests per IP address.
 *
 * OWASP Top 10: A05:2021 – Security Misconfiguration
 *
 * @module infrastructure/http/middleware/rate-limit
 */

import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Global Ingestion Endpoint
 *
 * Protects POST /api/ingest/all from abuse.
 *
 * WHY THIS IS CRITICAL:
 * - Global ingestion processes 8+ categories in parallel
 * - Makes 200+ external HTTP requests (RSS feeds)
 * - Consumes 50K+ Gemini tokens per request (~€0.50)
 * - Without rate limiting, an attacker with 10 IPs could cost ~€50/hour
 *
 * CONFIGURATION:
 * - Window: 1 hour (3600 seconds)
 * - Max Requests: 5 per IP per hour
 * - Response: 429 Too Many Requests
 *
 * RECOMMENDED VALUES:
 * - Production: 5 requests/hour (strict)
 * - Staging: 20 requests/hour (testing)
 * - Development: 100 requests/hour (local dev)
 */
export const globalIngestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 5 in prod, 100 in dev
  message: {
    success: false,
    error: 'Too many global refresh requests from this IP, please try again in an hour.',
    hint: 'Use category-specific ingestion (/api/ingest/news) for frequent updates.',
    retryAfter: '1 hour',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests (even successful ones)
  skipFailedRequests: false, // Count failed requests too
  // Note: Using default keyGenerator (handles IPv6 correctly)
  handler: (req, res) => {
    // Custom handler for rate limit exceeded
    console.warn(`[RATE LIMIT] 🚨 Global ingestion blocked for IP: ${req.ip}`);
    console.warn(`   Endpoint: ${req.method} ${req.originalUrl}`);

    res.status(429).json({
      success: false,
      error: 'Too many global refresh requests from this IP, please try again in an hour.',
      hint: 'Use category-specific ingestion (/api/ingest/news) for frequent updates.',
      retryAfter: '1 hour',
      details: {
        limit: process.env.NODE_ENV === 'production' ? 5 : 100,
        windowMs: 60 * 60 * 1000,
      },
    });
  },
});

/**
 * Moderate Rate Limiter for Category-Specific Ingestion
 *
 * Protects POST /api/ingest/news from abuse.
 *
 * CONFIGURATION:
 * - Window: 15 minutes
 * - Max Requests: 30 per IP per 15 minutes
 * - Response: 429 Too Many Requests
 *
 * This is more lenient than global ingestion since it only processes 1 category.
 */
export const categoryIngestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 1000, // 30 in prod, 1000 in dev
  message: {
    success: false,
    error: 'Too many ingestion requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Note: Using default keyGenerator (handles IPv6 correctly)
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] ⚠️ Category ingestion throttled for IP: ${req.ip}`);

    res.status(429).json({
      success: false,
      error: 'Too many ingestion requests from this IP, please try again in 15 minutes.',
      details: {
        limit: process.env.NODE_ENV === 'production' ? 30 : 1000,
        windowMs: 15 * 60 * 1000,
      },
    });
  },
});

/**
 * Lenient Rate Limiter for Status Checks
 *
 * Protects GET /api/ingest/status from abuse.
 *
 * CONFIGURATION:
 * - Window: 1 minute
 * - Max Requests: 60 per IP per minute
 * - Response: 429 Too Many Requests
 */
export const statusCheckRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second average)
  message: {
    success: false,
    error: 'Too many status check requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
