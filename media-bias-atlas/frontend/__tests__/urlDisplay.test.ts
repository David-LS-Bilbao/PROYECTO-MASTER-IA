import { describe, expect, it } from 'vitest';
import { getWebsiteDisplayLabel } from '@/lib/urlDisplay';

describe('getWebsiteDisplayLabel', () => {
  it('muestra el hostname limpio cuando la URL es válida', () => {
    expect(getWebsiteDisplayLabel('https://www.example.com/news')).toBe('example.com');
  });

  it('devuelve la cadena original si la URL está mal formada', () => {
    expect(getWebsiteDisplayLabel('example.com/noticia')).toBe('example.com/noticia');
  });

  it('devuelve null cuando no hay URL', () => {
    expect(getWebsiteDisplayLabel(null)).toBeNull();
  });
});
