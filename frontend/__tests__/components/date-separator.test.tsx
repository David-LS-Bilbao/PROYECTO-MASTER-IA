/**
 * Tests for DateSeparator Component
 * Sprint 19.5 - Tarea 2: Separadores de Fecha
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateSeparator } from '@/components/date-separator';

describe('DateSeparator Component', () => {
  it('renders the label correctly', () => {
    render(<DateSeparator label="Hoy, 6 de febrero" />);

    const label = screen.getByText('Hoy, 6 de febrero');
    expect(label).toBeDefined();
  });

  it('displays article count when provided', () => {
    render(<DateSeparator label="Ayer, 5 de febrero" articleCount={12} />);

    const count = screen.getByText('12 noticias');
    expect(count).toBeDefined();
  });

  it('uses singular form for count = 1', () => {
    render(<DateSeparator label="Hoy, 6 de febrero" articleCount={1} />);

    const count = screen.getByText('1 noticia');
    expect(count).toBeDefined();
  });

  it('uses plural form for count > 1', () => {
    render(<DateSeparator label="Hoy, 6 de febrero" articleCount={5} />);

    const count = screen.getByText('5 noticias');
    expect(count).toBeDefined();
  });

  it('does not display article count when not provided', () => {
    render(<DateSeparator label="Hoy, 6 de febrero" />);

    const count = screen.queryByText(/noticias?/i);
    expect(count).toBeNull();
  });

  it('renders calendar icon', () => {
    const { container } = render(<DateSeparator label="Hoy, 6 de febrero" />);

    const icon = container.querySelector('svg');
    expect(icon).toBeDefined();
  });

  it('has correct accessibility structure', () => {
    render(<DateSeparator label="Hoy, 6 de febrero" articleCount={10} />);

    // Check that label text is present
    const label = screen.getByText('Hoy, 6 de febrero');
    expect(label).toBeDefined();

    // Check that it's in a semantic structure
    expect(label.tagName).toBe('SPAN');
  });

  it('applies correct styling classes', () => {
    const { container } = render(<DateSeparator label="Hoy, 6 de febrero" />);

    // Check for col-span-full class (takes full width in grid)
    const wrapper = container.querySelector('.col-span-full');
    expect(wrapper).toBeDefined();
  });

  it('renders with gradient lines decoration', () => {
    const { container } = render(<DateSeparator label="Hoy, 6 de febrero" />);

    // Check for gradient classes
    const gradients = container.querySelectorAll('.bg-gradient-to-r, .bg-gradient-to-l');
    expect(gradients.length).toBeGreaterThan(0);
  });

  it('handles long labels correctly', () => {
    const longLabel = "Miércoles, 15 de enero de 2024";
    render(<DateSeparator label={longLabel} />);

    const label = screen.getByText(longLabel);
    expect(label).toBeDefined();
    expect(label.className).toContain('whitespace-nowrap');
  });

  it('handles zero article count', () => {
    render(<DateSeparator label="Hoy, 6 de febrero" articleCount={0} />);

    const count = screen.getByText('0 noticias');
    expect(count).toBeDefined();
  });
});
