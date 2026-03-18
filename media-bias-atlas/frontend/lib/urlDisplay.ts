export function getWebsiteDisplayLabel(websiteUrl?: string | null): string | null {
  if (!websiteUrl) {
    return null;
  }

  try {
    return new URL(websiteUrl).hostname.replace('www.', '');
  } catch {
    return websiteUrl;
  }
}
