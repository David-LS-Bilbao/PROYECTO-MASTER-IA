/**
 * AdBanner Tests - Freemium ads rendering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdBanner } from '@/components/ads/ad-banner';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseAuth = vi.fn();
const mockUseProfile = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: (...args: any[]) => mockUseProfile(...args),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('AdBanner', () => {
  const originalEnable = process.env.NEXT_PUBLIC_ENABLE_ADSENSE;
  const originalClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1' },
      loading: false,
      getToken: vi.fn(),
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_ADSENSE = originalEnable;
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = originalClient;
  });

  it('usuario PREMIUM no ve anuncios', () => {
    process.env.NEXT_PUBLIC_ENABLE_ADSENSE = 'true';
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test';

    mockUseProfile.mockReturnValue({
      profile: { plan: 'PREMIUM' },
      loading: false,
    });

    const { container } = render(
      <AdBanner dataAdSlot="1234567890" format="auto" />
    );

    expect(container.firstChild).toBeNull();
  });

  it('usuario FREE en dev muestra placeholder', () => {
    process.env.NEXT_PUBLIC_ENABLE_ADSENSE = 'false';
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test';

    mockUseProfile.mockReturnValue({
      profile: { plan: 'FREE' },
      loading: false,
    });

    render(<AdBanner dataAdSlot="1234567890" format="auto" />);

    expect(screen.getByText('Espacio Publicitario')).toBeDefined();
  });

  it('usuario FREE en prod muestra ins.adsbygoogle', () => {
    process.env.NEXT_PUBLIC_ENABLE_ADSENSE = 'true';
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test';

    mockUseProfile.mockReturnValue({
      profile: { plan: 'FREE' },
      loading: false,
    });

    const { container } = render(
      <AdBanner dataAdSlot="1234567890" format="fluid" />
    );

    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).toBeDefined();
  });
});
