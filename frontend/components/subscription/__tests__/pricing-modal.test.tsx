/**
 * PricingModal Tests - Freemium upgrade flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingModal } from '@/components/subscription/pricing-modal';
import { toast } from 'sonner';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetToken = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
    user: { uid: 'user-1' },
    loading: false,
    logout: vi.fn(),
  }),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('PricingModal', () => {
  const originalFetch = global.fetch;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('renderiza planes Free y Premium', () => {
    render(<PricingModal isOpen onOpenChange={vi.fn()} />);

    expect(screen.getByText('Plan Free')).toBeDefined();
    expect(screen.getByText('Plan Premium')).toBeDefined();
  });

  it('click en canjear activa estado de carga', async () => {
    const user = userEvent.setup();
    mockGetToken.mockResolvedValue('token');

    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockReturnValue(fetchPromise) as any;

    render(<PricingModal isOpen onOpenChange={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Introduce tu codigo'), 'VERITY_ADMIN');
    await user.click(screen.getByRole('button', { name: 'Canjear Codigo' }));

    expect(screen.getByRole('button', { name: 'Canjeando...' })).toBeDefined();

    resolveFetch!(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Canjear Codigo' })).toBeDefined();
    });
  });

  it('canje exitoso muestra toast y actualiza sesion (onPlanUpdated)', async () => {
    const user = userEvent.setup();
    const onPlanUpdated = vi.fn();
    const onOpenChange = vi.fn();
    mockGetToken.mockResolvedValue('token');

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    ) as any;

    render(
      <PricingModal
        isOpen
        onOpenChange={onOpenChange}
        onPlanUpdated={onPlanUpdated}
      />
    );

    await user.type(screen.getByPlaceholderText('Introduce tu codigo'), 'VERITY_ADMIN');
    await user.click(screen.getByRole('button', { name: 'Canjear Codigo' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/subscription/redeem',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ code: 'VERITY_ADMIN' }),
        })
      );
    });

    expect(toast.success).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPlanUpdated).toHaveBeenCalled();
  });

  it('canje con error 400 muestra toast de error', async () => {
    const user = userEvent.setup();
    mockGetToken.mockResolvedValue('token');

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 400 })
    ) as any;

    render(<PricingModal isOpen onOpenChange={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Introduce tu codigo'), 'VERITY_ADMIN');
    await user.click(screen.getByRole('button', { name: 'Canjear Codigo' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
