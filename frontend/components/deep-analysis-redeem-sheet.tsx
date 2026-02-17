'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DeepAnalysisRedeemSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onRedeem: (code: string) => Promise<boolean>;
}

export function DeepAnalysisRedeemSheet({
  isOpen,
  onOpenChange,
  isSubmitting,
  onRedeem,
}: DeepAnalysisRedeemSheetProps) {
  const [code, setCode] = useState('');
  const [hasError, setHasError] = useState(false);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setHasError(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!normalizedCode || isSubmitting) {
      return;
    }

    const ok = await onRedeem(normalizedCode);
    if (ok) {
      onOpenChange(false);
      return;
    }

    setHasError(true);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle>Activar Analisis profundo</SheetTitle>
          <SheetDescription>
            Introduce tu codigo promocional para desbloquear esta funcionalidad premium.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deep-analysis-code">Codigo promocional</Label>
            <Input
              id="deep-analysis-code"
              autoComplete="off"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (hasError) {
                  setHasError(false);
                }
              }}
              placeholder="Ej: VERITY_DEEP"
              aria-invalid={hasError}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!normalizedCode || isSubmitting}>
            {isSubmitting ? 'Activando...' : 'Activar con codigo'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
