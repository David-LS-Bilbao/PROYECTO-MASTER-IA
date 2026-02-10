'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BiasDistribution {
  left: number;
  neutral: number;
  right: number;
}

interface BiasDistributionChartProps {
  data: BiasDistribution;
}

// Colores neutrales para evitar asociaciones políticas directas
const COLORS = {
  left: '#f59e0b',    // Amber 500 (antes rojo - evita asociación)
  neutral: '#10b981', // Green 500 (indica equilibrio positivo)
  right: '#8b5cf6',   // Purple 500 (antes azul - evita asociación)
};

const LABELS = {
  left: 'Tendencia Izquierda',
  neutral: 'Equilibrado',
  right: 'Tendencia Derecha',
};

// Función helper para calcular porcentaje (exportada para tests)
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function CustomTooltip({
  active,
  payload,
}: TooltipContentProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const label = item.name || '';
  const value = item.value ?? 0;
  
  // Obtener total del payload (pasado en chartData)
  const total = item.payload?.total ?? 0;
  const percentage = calculatePercentage(value, total);

  // Descripciones educativas según el tipo
  const descriptions: Record<string, { icon: string; text: string; color: string }> = {
    [LABELS.left]: {
      icon: '📊',
      text: 'Noticias con enfoque progresista o de izquierda política',
      color: 'text-amber-600 dark:text-amber-400'
    },
    [LABELS.neutral]: {
      icon: '✓',
      text: 'Noticias objetivas sin sesgo político marcado',
      color: 'text-green-600 dark:text-green-400'
    },
    [LABELS.right]: {
      icon: '📊',
      text: 'Noticias con enfoque conservador o de derecha política',
      color: 'text-purple-600 dark:text-purple-400'
    }
  };

  const info = descriptions[label] || { icon: 'ℹ️', text: 'Información no disponible', color: '' };

  return (
    <div className="rounded-lg border bg-background px-4 py-3 shadow-lg max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{info.icon}</span>
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {info.text}
        </p>
        
        <div className="pt-2 border-t">
          <p className={`text-sm font-bold ${info.color}`}>
            {value} artículos ({percentage}%)
          </p>
        </div>

        {label === LABELS.neutral && (
          <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ⭐ Esto es bueno: indica cobertura imparcial
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function BiasDistributionChart({ data }: BiasDistributionChartProps) {
  const total = data.left + data.neutral + data.right;
  
  const chartData = [
    { name: LABELS.left, value: data.left, color: COLORS.left, total },
    { name: LABELS.neutral, value: data.neutral, color: COLORS.neutral, total },
    { name: LABELS.right, value: data.right, color: COLORS.right, total },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">¿Cómo se distribuyen las noticias?</CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Una cobertura equilibrada tiene más noticias en el centro (verde) y balanceadas hacia los lados.
        </p>
      </CardHeader>
      <CardContent className="h-96">
        {total === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin datos de sesgo</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                label={({ name, percent }) => 
                  `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
