import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface ReliabilityBadgeProps {
  score: number; // 0-100
  reasoning?: string;
}

export function ReliabilityBadge({ score, reasoning }: ReliabilityBadgeProps) {
  let color = 'bg-red-500';
  let textColor = 'text-red-600';
  let text = 'Posible Bulo';
  let Icon = ShieldAlert;

  if (score >= 70) {
    color = 'bg-green-600';
    textColor = 'text-green-600';
    text = 'Contrastada';
    Icon = ShieldCheck;
  } else if (score >= 40) {
    color = 'bg-yellow-500';
    textColor = 'text-yellow-600';
    text = 'Poco Contrastada';
    Icon = ShieldQuestion;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Nivel de Fiabilidad
        </span>
        <span className="text-xs font-bold">{score}/100</span>
      </div>

      {/* Progress bar with native tooltip */}
      <div
        className="w-full h-4 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden cursor-help"
        title={reasoning || "Análisis de fuentes y consistencia"}
      >
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex items-center gap-2 mt-1">
        <Icon className={`w-4 h-4 ${textColor}`} />
        <span className={`text-xs font-semibold ${textColor}`}>{text}</span>
      </div>

      {/* Reasoning text */}
      {reasoning && (
        <p className="text-xs text-muted-foreground mt-1 italic">
          &quot;{reasoning}&quot;
        </p>
      )}
    </div>
  );
}
