/**
 * Tests for ScrollToTop Component
 * Sprint 19.6 - Tarea 1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ScrollToTop } from '@/components/ui/scroll-to-top';

describe('ScrollToTop Component', () => {
  let mockContainer: HTMLDivElement;

  const runContainerTimer = async () => {
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock scroll container
    mockContainer = document.createElement('div');
    mockContainer.className = 'overflow-y-auto';
    mockContainer.style.height = '500px';
    mockContainer.style.overflowY = 'auto';

    const main = document.createElement('main');
    main.appendChild(mockContainer);
    document.body.appendChild(main);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders button element', () => {
    render(<ScrollToTop />);

    const button = screen.getByRole('button', { name: /volver arriba/i });
    expect(button).toBeDefined();
  });

  it('button is hidden by default (opacity-0)', () => {
    render(<ScrollToTop />);

    const button = screen.getByRole('button', { name: /volver arriba/i });
    expect(button.className).toContain('opacity-0');
  });

  it('button becomes visible when scrolling down >300px', async () => {
    render(<ScrollToTop />);

    await runContainerTimer();

    Object.defineProperty(mockContainer, 'scrollTop', {
      writable: true,
      value: 400,
    });

    act(() => {
      mockContainer.dispatchEvent(new Event('scroll'));
    });

    const button = screen.getByRole('button', { name: /volver arriba/i });
    expect(button.className).toContain('opacity-100');
  });

  it('button has ArrowUp icon', () => {
    render(<ScrollToTop />);

    const button = screen.getByRole('button', { name: /volver arriba/i });
    const svg = button.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('scrolls to top when clicked', async () => {
    render(<ScrollToTop />);

    await runContainerTimer();

    Object.defineProperty(mockContainer, 'scrollTop', {
      writable: true,
      value: 500,
    });

    const mockScrollTo = vi.fn();
    mockContainer.scrollTo = mockScrollTo;

    act(() => {
      mockContainer.dispatchEvent(new Event('scroll'));
    });

    const button = screen.getByRole('button', { name: /volver arriba/i });
    fireEvent.click(button);

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('has correct accessibility attributes', () => {
    render(<ScrollToTop />);

    const button = screen.getByRole('button', { name: /volver arriba/i });
    expect(button.getAttribute('aria-label')).toBe('Volver arriba');
    expect(button.getAttribute('title')).toBe('Volver arriba');
  });

  it('has correct z-index for overlay', () => {
    render(<ScrollToTop />);

    const button = screen.getByRole('button', { name: /volver arriba/i });
    expect(button.className).toContain('z-50');
  });

  it('has fixed position in bottom-right corner', () => {
    render(<ScrollToTop />);

    const button = screen.getByRole('button', { name: /volver arriba/i });
    expect(button.className).toContain('fixed');
    expect(button.className).toContain('bottom-8');
    expect(button.className).toContain('right-8');
  });
});
