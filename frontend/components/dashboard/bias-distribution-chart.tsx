'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
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

function CustomTooltip({
  active,
  payload,
}: any) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const label = item.name || '';
  const value = item.value ?? 0;
  const total = payload[0]?.payload?.payload?.total || 1;
  const percentage = Math.round((value / total) * 100);

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        {value} artículos ({percentage}%)
      </p>
      {label === LABELS.neutral && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          ✓ Objetivo y balanceado
        </p>
      )}
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
      <CardContent className="h-80">
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
