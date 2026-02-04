import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { calculatePercentage, BiasDistributionChart } from '@/components/dashboard/bias-distribution-chart';

describe('calculatePercentage', () => {
  it('calcula correctamente porcentajes normales', () => {
    expect(calculatePercentage(33, 100)).toBe(33);
    expect(calculatePercentage(50, 100)).toBe(50);
    expect(calculatePercentage(1, 3)).toBe(33);
  });

  it('maneja total = 0 sin dividir por cero', () => {
    expect(calculatePercentage(10, 0)).toBe(0);
    expect(calculatePercentage(0, 0)).toBe(0);
  });

  it('redondea correctamente al entero más cercano', () => {
    expect(calculatePercentage(1, 3)).toBe(33);  // 33.33... → 33
    expect(calculatePercentage(2, 3)).toBe(67);  // 66.66... → 67
    expect(calculatePercentage(1, 6)).toBe(17);  // 16.66... → 17
  });

  it('maneja casos extremos', () => {
    expect(calculatePercentage(100, 100)).toBe(100);
    expect(calculatePercentage(0, 100)).toBe(0);
    expect(calculatePercentage(1, 1)).toBe(100);
  });

  it('no produce valores mayores a 100% con datos válidos', () => {
    // Este test previene el bug de 3300%
    const value = 33;
    const total = 100;
    const result = calculatePercentage(value, total);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('BiasDistributionChart', () => {
  it('renderiza sin errores con datos válidos', () => {
    render(
      <BiasDistributionChart 
        data={{ left: 10, neutral: 70, right: 20 }} 
      />
    );
    
    expect(screen.getByText('¿Cómo se distribuyen las noticias?')).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay datos', () => {
    render(
      <BiasDistributionChart 
        data={{ left: 0, neutral: 0, right: 0 }} 
      />
    );
    
    expect(screen.getByText('Sin datos de sesgo')).toBeInTheDocument();
  });

  it('renderiza el contenedor del gráfico cuando hay datos', () => {
    const { container } = render(
      <BiasDistributionChart 
        data={{ left: 30, neutral: 50, right: 20 }} 
      />
    );
    
    // ResponsiveContainer está presente (el gráfico se renderiza aunque sin dimensiones en test)
    const responsiveContainer = container.querySelector('.recharts-responsive-container');
    expect(responsiveContainer).toBeInTheDocument();
  });
});
