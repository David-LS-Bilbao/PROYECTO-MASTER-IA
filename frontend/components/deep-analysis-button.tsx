'use client';

import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeepAnalysisButtonProps {
  isPremium: boolean;
  isBusy: boolean;
  onClick: () => void;
}

export function DeepAnalysisButton({
  isPremium,
  isBusy,
  onClick,
}: DeepAnalysisButtonProps) {
  const disabled = isBusy || !isPremium;

  return (
    <Button
      variant="secondary"
      className="w-full gap-2"
      onClick={onClick}
      disabled={disabled}
      title={!isPremium ? 'Disponible en Premium' : undefined}
    >
      {isBusy ? (
        <>
          <span className="animate-spin">⏳</span>
          Procesando...
        </>
      ) : isPremium ? (
        <>
          <Sparkles className="h-4 w-4" />
          Analisis profundo (Premium)
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" />
          Disponible en Premium
        </>
      )}
    </Button>
  );
}
