import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateOutletForm } from '@/components/forms/CreateOutletForm';
import { apiFetch } from '@/lib/api';
import { vi, describe, it, expect } from 'vitest';

// Mock the API Fetch
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

describe('CreateOutletForm - Unit Tests', () => {
  it('1. Renderiza los campos esperados del formulario', () => {
    render(<CreateOutletForm preselectedCountry="ES" />);
    
    // Debería pintar los campos de Código País, Nombre y URL
    expect(screen.getByLabelText(/Código de País/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('ES')).toBeInTheDocument();
    
    expect(screen.getByLabelText(/Nombre del Medio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/URL del Sitio/i)).toBeInTheDocument();
    
    // Debería pintar el botón de submit
    expect(screen.getByRole('button', { name: /Añadir Medio/i })).toBeInTheDocument();
  });

  it('2. No permite submit si name está vacío (Validación Zod)', async () => {
    render(<CreateOutletForm preselectedCountry="ES" />);
    
    // Damos click directamente sin rellenar nada (name está vacío)
    const submitBtn = screen.getByRole('button', { name: /Añadir Medio/i });
    fireEvent.click(submitBtn);

    // Esperamos el mensaje de error del componente (de React Hook Form + Zod)
    await waitFor(() => {
      expect(screen.getByText('El nombre debe tener al menos 2 caracteres')).toBeInTheDocument();
    });

    // Validamos que 'apiFetch' JAMÁS haya sido llamado
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('3. Muestra validación de websiteUrl en formato incorrecto', async () => {
    render(<CreateOutletForm preselectedCountry="ES" />);
    
    // Escribimos algo válido en name, pero inválido en URL
    fireEvent.change(screen.getByLabelText(/Nombre del Medio/i), { target: { value: 'El Mundo' } });
    fireEvent.change(screen.getByLabelText(/URL del Sitio/i), { target: { value: 'not-a-url' } });

    fireEvent.click(screen.getByRole('button', { name: /Añadir Medio/i }));

    // Esperamos el mensaje del resolver de URL
    await waitFor(() => {
      expect(screen.getByText('Debe ser una URL válida')).toBeInTheDocument();
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('4. Realiza el POST si la información es válida', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: '123' });
    
    render(<CreateOutletForm preselectedCountry="ES" />);
    
    fireEvent.change(screen.getByLabelText(/Nombre del Medio/i), { target: { value: 'El Abc' } });
    fireEvent.change(screen.getByLabelText(/URL del Sitio/i), { target: { value: 'https://abc.es' } });

    fireEvent.click(screen.getByRole('button', { name: /Añadir Medio/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/outlets', {
        method: 'POST',
        body: JSON.stringify({
          countryCode: 'ES',
          name: 'El Abc',
          websiteUrl: 'https://abc.es'
        }),
      });
    });
  });
});
