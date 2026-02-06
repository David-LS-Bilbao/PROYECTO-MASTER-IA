/**
 * Tests for ScrollToTop Component
 * Sprint 19.6 - Tarea 1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ScrollToTop } from '@/components/ui/scroll-to-top';

describe('ScrollToTop Component', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
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
  });

  it('renders button element', async () => {
    render(<ScrollToTop />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button).toBeDefined();
    });
  });

  it('button is hidden by default (opacity-0)', async () => {
    render(<ScrollToTop />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button.className).toContain('opacity-0');
    });
  });

  it('button becomes visible when scrolling down >300px', async () => {
    render(<ScrollToTop />);

    // Wait for scroll container to be found
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button).toBeDefined();
    });

    // Simulate scroll
    Object.defineProperty(mockContainer, 'scrollTop', {
      writable: true,
      value: 400,
    });

    mockContainer.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button.className).toContain('opacity-100');
    });
  });

  it('button has ArrowUp icon', async () => {
    render(<ScrollToTop />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      const svg = button.querySelector('svg');
      expect(svg).toBeDefined();
    });
  });

  it('scrolls to top when clicked', async () => {
    const user = userEvent.setup();
    render(<ScrollToTop />);

    // Set scroll position
    Object.defineProperty(mockContainer, 'scrollTop', {
      writable: true,
      value: 500,
    });

    const mockScrollTo = vi.fn();
    mockContainer.scrollTo = mockScrollTo;

    // Wait for button and make it visible
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button).toBeDefined();
    });

    mockContainer.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button.className).toContain('opacity-100');
    });

    // Click button
    const button = screen.getByRole('button', { name: /volver arriba/i });
    await user.click(button);

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('has correct accessibility attributes', async () => {
    render(<ScrollToTop />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button.getAttribute('aria-label')).toBe('Volver arriba');
      expect(button.getAttribute('title')).toBe('Volver arriba');
    });
  });

  it('has correct z-index for overlay', async () => {
    render(<ScrollToTop />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button.className).toContain('z-50');
    });
  });

  it('has fixed position in bottom-right corner', async () => {
    render(<ScrollToTop />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /volver arriba/i });
      expect(button.className).toContain('fixed');
      expect(button.className).toContain('bottom-8');
      expect(button.className).toContain('right-8');
    });
  });
});
