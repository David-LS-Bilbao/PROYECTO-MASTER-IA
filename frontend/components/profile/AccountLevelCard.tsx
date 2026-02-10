/**
 * AccountLevelCard - Step 4 Plan Mikado
 *
 * Componente de presentacion: Progreso del plan + info de cuenta.
 */

import { TrendingUp, Calendar, Shield, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

const MONTHLY_LIMIT = 50;

export interface AccountLevelCardProps {
  articlesAnalyzed: number;
  plan: 'FREE' | 'PREMIUM';
  createdAt: string;
  userId: string;
  onShowTokenUsage?: () => void;
  showingTokenUsage?: boolean;
}

export function AccountLevelCard({
  articlesAnalyzed,
  plan,
  createdAt,
  userId,
  onShowTokenUsage,
  showingTokenUsage = false,
}: AccountLevelCardProps) {
  const isPremium = plan === 'PREMIUM';
  const usagePercentage = Math.min(
    (articlesAnalyzed / MONTHLY_LIMIT) * 100,
    100,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-lg">Nivel de Cuenta</CardTitle>
        </div>
        <CardDescription>
          {isPremium ? 'Plan Premium activo' : 'Tu progreso en el plan gratuito'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPremium ? (
          <div className="rounded-lg border border-blue-200/70 bg-blue-50/60 p-4 text-sm text-blue-900/90 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-100">
            <p className="font-semibold">Analisis ilimitados</p>
            <p className="text-xs opacity-80">Sin limites mensuales en tu plan.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Analisis realizados
              </span>
              <span className="text-sm font-semibold">
                {articlesAnalyzed} / {MONTHLY_LIMIT}
              </span>
            </div>
            <Progress value={usagePercentage} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {usagePercentage >= 100
                ? 'Has alcanzado el limite mensual'
                : `Quedan ${MONTHLY_LIMIT - articlesAnalyzed} analisis este mes`}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Miembro desde</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(createdAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">ID de usuario</p>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {userId.substring(0, 20)}...
                </p>
              </div>
            </div>
          </div>
        </div>

        {onShowTokenUsage && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <Button
              variant="outline"
              size="sm"
              onClick={onShowTokenUsage}
              className="w-full gap-2"
            >
              {showingTokenUsage ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Ocultar Uso de Tokens
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Ver Uso de Tokens
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
