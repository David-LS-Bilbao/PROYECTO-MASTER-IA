'use client';

import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeepAnalysisButtonProps {
  hasEntitlement: boolean;
  isBusy: boolean;
  onClick: () => void;
}

export function DeepAnalysisButton({
  hasEntitlement,
  isBusy,
  onClick,
}: DeepAnalysisButtonProps) {
  const disabled = isBusy;

  return (
    <Button
      variant="secondary"
      className="w-full gap-2"
      onClick={onClick}
      disabled={disabled}
      title={!hasEntitlement ? 'Solo para usuarios Premium' : undefined}
    >
      {isBusy ? (
        <>
          <span className="animate-spin">...</span>
          Procesando...
        </>
      ) : hasEntitlement ? (
        <>
          <Sparkles className="h-4 w-4" />
          Analisis profundo
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" />
          Solo para usuarios Premium
        </>
      )}
    </Button>
  );
}
