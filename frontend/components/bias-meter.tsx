'use client';

import { cn } from '@/lib/utils';

interface BiasMeterProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get bias level info based on score
 */
function getBiasInfo(score: number): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  if (score <= 0.2) {
    return {
      label: 'Neutral',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500',
      description: 'Contenido equilibrado con múltiples perspectivas',
    };
  }
  if (score <= 0.4) {
    return {
      label: 'Ligero sesgo',
      color: 'text-lime-600 dark:text-lime-400',
      bgColor: 'bg-lime-500',
      description: 'Lenguaje mayormente neutral con leve inclinación',
    };
  }
  if (score <= 0.6) {
    return {
      label: 'Sesgo moderado',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500',
      description: 'Omisión de algunas perspectivas importantes',
    };
  }
  if (score <= 0.8) {
    return {
      label: 'Sesgo alto',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500',
      description: 'Lenguaje emocional y perspectiva unilateral',
    };
  }
  return {
    label: 'Muy sesgado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500',
    description: 'Posible propaganda o desinformación',
  };
}

export function BiasMeter({ score, showLabel = true, size = 'md' }: BiasMeterProps) {
  const biasInfo = getBiasInfo(score);
  const percentage = Math.round(score * 100);

  const heightClass = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }[size];

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className={cn('font-medium', biasInfo.color)}>{biasInfo.label}</span>
          <span className="text-sm text-muted-foreground">{percentage}%</span>
        </div>
      )}

      {/* Progress bar */}
      <div className={cn('w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden', heightClass)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', biasInfo.bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Neutral</span>
        <span>Muy sesgado</span>
      </div>
    </div>
  );
}

export function BiasMeterCompact({ score }: { score: number }) {
  const biasInfo = getBiasInfo(score);
  const percentage = Math.round(score * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', biasInfo.bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn('text-sm font-medium', biasInfo.color)}>
        {percentage}%
      </span>
    </div>
  );
}

export function BiasExplanation({ score }: { score: number }) {
  const biasInfo = getBiasInfo(score);

  return (
    <p className="text-sm text-muted-foreground">{biasInfo.description}</p>
  );
}
