import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeepAnalysisButton } from '@/components/deep-analysis-button';

describe('DeepAnalysisButton', () => {
  it('disables the button for FREE users', () => {
    render(<DeepAnalysisButton isPremium={false} isBusy={false} onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /disponible en premium/i });
    expect(button).toBeDisabled();
  });

  it('enables the button for PREMIUM users', () => {
    render(<DeepAnalysisButton isPremium isBusy={false} onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /analisis profundo/i });
    expect(button).toBeEnabled();
  });
});
