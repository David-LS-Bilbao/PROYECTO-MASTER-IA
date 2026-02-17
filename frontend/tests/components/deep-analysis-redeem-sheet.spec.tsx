import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeepAnalysisRedeemSheet } from '@/components/deep-analysis-redeem-sheet';

describe('DeepAnalysisRedeemSheet', () => {
  it('submits promo code and closes on successful redeem', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onRedeem = vi.fn().mockResolvedValue(true);

    render(
      <DeepAnalysisRedeemSheet
        isOpen
        onOpenChange={onOpenChange}
        isSubmitting={false}
        onRedeem={onRedeem}
      />
    );

    await user.type(screen.getByLabelText(/codigo promocional/i), 'verity_deep');
    await user.click(screen.getByRole('button', { name: /activar con codigo/i }));

    await waitFor(() => {
      expect(onRedeem).toHaveBeenCalledWith('VERITY_DEEP');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
