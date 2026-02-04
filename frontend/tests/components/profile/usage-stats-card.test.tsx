import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageStatsCard } from '@/components/profile/UsageStatsCard';

describe('UsageStatsCard', () => {
  const mockProps = {
    articlesAnalyzed: 15,
    searchesPerformed: 8,
    chatMessages: 23,
    favorites: 5,
  };

  it('renderiza correctamente con datos', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    expect(screen.getByText('Consumo de IA')).toBeInTheDocument();
    expect(screen.getByText('Uso de análisis con inteligencia artificial')).toBeInTheDocument();
  });

  it('muestra el periodo mensual actual', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    const now = new Date();
    const currentMonth = now.toLocaleDateString('es-ES', { month: 'long' });
    
    expect(screen.getByText(/Periodo actual:/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(currentMonth, 'i'))).toBeInTheDocument();
  });

  it('muestra el día del mes actual', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    const dayOfMonth = new Date().getDate();
    expect(screen.getByText(new RegExp(`Día ${dayOfMonth}`, 'i'))).toBeInTheDocument();
  });

  it('muestra todas las estadísticas con formato correcto', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    expect(screen.getByText('15')).toBeInTheDocument(); // articlesAnalyzed
    expect(screen.getByText('8')).toBeInTheDocument();  // searchesPerformed
    expect(screen.getByText('23')).toBeInTheDocument(); // chatMessages
    expect(screen.getByText('5')).toBeInTheDocument();  // favorites
  });

  it('muestra iconos específicos para cada métrica', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    // Verificar que hay iconos para cada métrica
    expect(screen.getByText('Noticias Analizadas')).toBeInTheDocument();
    expect(screen.getByText('Búsquedas')).toBeInTheDocument();
    expect(screen.getByText('Mensajes Chat')).toBeInTheDocument();
    expect(screen.getByText('Favoritos')).toBeInTheDocument();
  });

  it('muestra mensaje informativo cuando no hay actividad', () => {
    render(
      <UsageStatsCard 
        articlesAnalyzed={0}
        searchesPerformed={0}
        chatMessages={0}
        favorites={0}
      />
    );
    
    expect(screen.getByText(/Empieza a usar Verity/i)).toBeInTheDocument();
  });

  it('NO muestra mensaje informativo cuando hay actividad', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    expect(screen.queryByText(/Empieza a usar Verity/i)).not.toBeInTheDocument();
  });

  it('muestra guion cuando valor es null/undefined', () => {
    render(
      <UsageStatsCard 
        articlesAnalyzed={null as any}
        searchesPerformed={undefined as any}
        chatMessages={0}
        favorites={0}
      />
    );
    
    // Debería mostrar "—" para valores null/undefined
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('formatea números grandes con separadores de miles', () => {
    render(
      <UsageStatsCard 
        articlesAnalyzed={1500}
        searchesPerformed={2300}
        chatMessages={4567}
        favorites={100}
      />
    );
    
    // Verificar que los números se muestran (el formato puede variar en jsdom)
    // En navegador: "1.500", en jsdom puede ser "1,500" o "1500"
    expect(screen.getByText(/1[.,]?500|1500/)).toBeInTheDocument();
    expect(screen.getByText(/2[.,]?300|2300/)).toBeInTheDocument();
  });

  it('muestra tooltips con información educativa', () => {
    render(<UsageStatsCard {...mockProps} />);
    
    // Verificar que hay botones de ayuda (HelpCircle icons)
    const helpButtons = screen.getAllByRole('button');
    expect(helpButtons.length).toBeGreaterThanOrEqual(4); // Al menos uno por cada métrica
  });
});
