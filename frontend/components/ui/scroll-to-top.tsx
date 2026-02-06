/**
 * ScrollToTop Component (Sprint 19.6 - Tarea 1: Botón Volver Arriba)
 *
 * Botón flotante que aparece cuando el usuario hace scroll hacia abajo
 * y permite volver al inicio de la página con scroll suave.
 *
 * UX Features:
 * - Se muestra solo cuando scrollY > 300px
 * - Transición fade-in/fade-out suave
 * - Scroll animado al hacer click
 * - Posición fixed en esquina inferior derecha
 */

'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<Element | null>(null);

  useEffect(() => {
    // Buscar el contenedor con scroll (main con overflow-y-auto)
    const findScrollContainer = () => {
      const container = document.querySelector('main .overflow-y-auto');
      setScrollContainer(container);
    };

    // Esperar a que el DOM esté listo
    const timer = setTimeout(findScrollContainer, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!scrollContainer) return;

    // Función que detecta el scroll
    const toggleVisibility = () => {
      const scrollTop = scrollContainer.scrollTop || 0;

      if (scrollTop > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Escuchar evento scroll del contenedor
    scrollContainer.addEventListener('scroll', toggleVisibility);

    // Cleanup al desmontar
    return () => {
      scrollContainer.removeEventListener('scroll', toggleVisibility);
    };
  }, [scrollContainer]);

  const scrollToTop = () => {
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-8 right-8 z-50
        flex items-center justify-center
        w-12 h-12
        bg-blue-600 hover:bg-blue-700
        text-white
        rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16 pointer-events-none'}
      `}
      aria-label="Volver arriba"
      title="Volver arriba"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
