/**
 * Type definitions for environment variables
 *
 * This file extends the NodeJS.ProcessEnv interface to include
 * all custom environment variables used in the frontend application.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // Backend API
    NEXT_PUBLIC_API_URL: string;

    // Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY: string;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
    NEXT_PUBLIC_FIREBASE_APP_ID: string;

    // Sentry Configuration
    NEXT_PUBLIC_SENTRY_DSN: string;
    SENTRY_DSN: string;
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: string;
    NEXT_PUBLIC_RELEASE_VERSION: string;

    // Google AdSense Configuration
    /**
     * Enable/disable AdSense ads
     * - 'true': Show real ads (production)
     * - 'false': Show mock ads (development)
     */
    NEXT_PUBLIC_ENABLE_ADSENSE: string;

    /**
     * AdSense Publisher ID
     * Format: ca-pub-xxxxxxxxxxxxxxxx
     */
    NEXT_PUBLIC_ADSENSE_CLIENT_ID: string;
  }
}

export {};
