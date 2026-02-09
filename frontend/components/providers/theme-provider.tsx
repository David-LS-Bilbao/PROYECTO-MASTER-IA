/**
 * Theme Provider
 * Wrapper para next-themes con configuración para Verity News
 *
 * Proporciona soporte para:
 * - Tema claro/oscuro/sistema
 * - Persistencia en localStorage
 * - Sin flash de contenido (FOUC)
 */

'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
