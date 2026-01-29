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

const COLORS = {
  left: '#ef4444',    // Red 500
  neutral: '#94a3b8', // Slate 400
  right: '#3b82f6',   // Blue 500
};

const LABELS = {
  left: 'Izquierda',
  neutral: 'Neutral',
  right: 'Derecha',
};

function CustomTooltip({
  active,
  payload,
}: any) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const label = item.name || '';
  const value = item.value ?? 0;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{value} artículos</p>
    </div>
  );
}

export function BiasDistributionChart({ data }: BiasDistributionChartProps) {
  const chartData = [
    { name: LABELS.left, value: data.left, color: COLORS.left },
    { name: LABELS.neutral, value: data.neutral, color: COLORS.neutral },
    { name: LABELS.right, value: data.right, color: COLORS.right },
  ];

  const total = chartData.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Distribución de Sesgo</CardTitle>
      </CardHeader>
      <CardContent className="h-65">
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
                innerRadius={70}
                outerRadius={100}
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
