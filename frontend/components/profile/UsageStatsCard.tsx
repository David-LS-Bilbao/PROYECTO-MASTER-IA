/**
 * UsageStatsCard - Step 4 Plan Mikado
 *
 * Componente de presentación: Estadísticas de consumo de IA.
 */

import { Sparkles, FileText, Search, MessageSquare, Heart, Calendar, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  // Calcular el periodo actual (mes en curso)
  const now = new Date();
  const currentMonth = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Consumo de IA</CardTitle>
          </div>
          <CardDescription>Uso de análisis con inteligencia artificial</CardDescription>
          
          {/* Periodo de facturación */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground capitalize">
                Periodo actual: {currentMonth}
              </p>
              <p className="text-xs text-muted-foreground">
                Día {dayOfMonth} de {totalDaysInMonth}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatBox 
              icon={FileText}
              label="Noticias Analizadas" 
              value={articlesAnalyzed}
              tooltip="Número de noticias que has analizado con IA este mes"
              color="text-blue-600"
            />
            <StatBox 
              icon={Search}
              label="Búsquedas" 
              value={searchesPerformed}
              tooltip="Búsquedas semánticas realizadas con IA este mes"
              color="text-purple-600"
            />
            <StatBox 
              icon={MessageSquare}
              label="Mensajes Chat" 
              value={chatMessages}
              tooltip="Conversaciones con el asistente IA este mes"
              color="text-green-600"
            />
            <StatBox 
              icon={Heart}
              label="Favoritos" 
              value={favorites}
              tooltip="Noticias guardadas en tu lista de favoritos"
              color="text-red-600"
            />
          </div>

          {/* Mensaje informativo cuando no hay actividad */}
          {articlesAnalyzed === 0 && searchesPerformed === 0 && chatMessages === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                💡 <strong>Empieza a usar Verity</strong>: Busca noticias, analízalas con IA o chatea con el asistente para ver tus estadísticas aquí.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

interface StatBoxProps {
  icon: React.ElementType;
  label: string;
  value: number;
  tooltip: string;
  color: string;
}

function StatBox({ icon: Icon, label, value, tooltip, color }: StatBoxProps) {
  return (
    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
        {value?.toLocaleString('es-ES') ?? '—'}
      </p>
    </div>
  );
}
