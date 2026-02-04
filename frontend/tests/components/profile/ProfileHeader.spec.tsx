/**
 * Tests para ProfileHeader - Step 4 Plan Mikado
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileHeader } from '@/components/profile/ProfileHeader';

const defaultProps = {
  name: 'Test User',
  email: 'test@example.com',
  photoURL: null,
  displayName: null,
  emailVerified: true,
  plan: 'FREE' as const,
  onNameChange: vi.fn(),
};

describe('ProfileHeader', () => {
  it('renderiza nombre y email correctamente', () => {
    render(<ProfileHeader {...defaultProps} />);

    expect(screen.getByDisplayValue('Test User')).toBeDefined();
    expect(screen.getByDisplayValue('test@example.com')).toBeDefined();
  });

  it('muestra badge Verificado cuando emailVerified es true', () => {
    render(<ProfileHeader {...defaultProps} emailVerified={true} />);

    expect(screen.getByText('Verificado')).toBeDefined();
  });

  it('no muestra badge Verificado cuando emailVerified es false', () => {
    render(<ProfileHeader {...defaultProps} emailVerified={false} />);

    expect(screen.queryByText('Verificado')).toBeNull();
  });

  it('llama onNameChange al escribir en el input', () => {
    const onNameChange = vi.fn();
    render(<ProfileHeader {...defaultProps} onNameChange={onNameChange} />);

    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), {
      target: { value: 'Nuevo Nombre' },
    });

    expect(onNameChange).toHaveBeenCalledWith('Nuevo Nombre');
  });

  it('muestra Plan Gratuito para plan FREE', () => {
    render(<ProfileHeader {...defaultProps} plan="FREE" />);
    expect(screen.getByText('Plan Gratuito')).toBeDefined();
  });

  it('muestra Plan Quota para plan QUOTA', () => {
    render(<ProfileHeader {...defaultProps} plan="QUOTA" />);
    expect(screen.getByText('Plan Quota')).toBeDefined();
  });

  it('deshabilita el campo email', () => {
    render(<ProfileHeader {...defaultProps} />);
    const emailInput = screen.getByDisplayValue('test@example.com');
    expect(emailInput).toBeDisabled();
  });
});
