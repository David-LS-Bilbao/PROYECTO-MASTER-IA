import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeepAnalysisButton } from '@/components/deep-analysis-button';

describe('DeepAnalysisButton', () => {
  it('keeps the button clickable when entitlement is missing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<DeepAnalysisButton hasEntitlement={false} isBusy={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: /solo para usuarios premium/i });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('enables the button when entitlement is active', () => {
    render(<DeepAnalysisButton hasEntitlement isBusy={false} onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /analisis profundo/i });
    expect(button).toBeEnabled();
  });
});
