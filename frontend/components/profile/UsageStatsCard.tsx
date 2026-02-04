/**
 * UsageStatsCard - Step 4 Plan Mikado
 *
 * Componente de presentación: Estadísticas de consumo de IA.
 */

import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface UsageStatsCardProps {
  articlesAnalyzed: number;
  searchesPerformed: number;
  chatMessages: number;
  favorites: number;
}

export function UsageStatsCard({
  articlesAnalyzed,
  searchesPerformed,
  chatMessages,
  favorites,
}: UsageStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Consumo de IA</CardTitle>
        </div>
        <CardDescription>Uso de análisis con inteligencia artificial</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <StatBox label="Noticias Analizadas" value={articlesAnalyzed} />
          <StatBox label="Búsquedas" value={searchesPerformed} />
          <StatBox label="Mensajes Chat" value={chatMessages} />
          <StatBox label="Favoritos" value={favorites} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}
