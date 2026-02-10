/**
 * Pricing Modal
 * Includes plan comparison and promo code redemption
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PricingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  currentPlan?: 'FREE' | 'PREMIUM';
  onPlanUpdated?: () => void;
}

export function PricingModal({
  isOpen,
  onOpenChange,
  title = 'Planes y precios',
  description = 'Elige el plan que mejor se adapte a ti.',
  currentPlan = 'FREE',
  onPlanUpdated,
}: PricingModalProps) {
  const router = useRouter();
  const { getToken } = useAuth();

  const [code, setCode] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setHasError(false);
      setIsSubmitting(false);
      setIsCanceling(false);
    }
  }, [isOpen]);

  const handleRedeem = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!normalizedCode || isSubmitting) return;

    setIsSubmitting(true);
    setHasError(false);

    try {
      const token = await getToken(true);
      if (!token) {
        toast.error('Debes iniciar sesion para canjear un codigo');
        setHasError(true);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/subscription/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: normalizedCode }),
      });

      if (!res.ok) {
        setHasError(true);
        toast.error('Codigo no valido');
        return;
      }

      toast.success('?Ahora eres Premium!');
      onOpenChange(false);

      if (onPlanUpdated) {
        onPlanUpdated();
      } else if (typeof router.refresh === 'function') {
        router.refresh();
      }
    } catch (err) {
      console.error('Error redeeming promo code:', err);
      setHasError(true);
      toast.error('No se pudo canjear el codigo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (isCanceling) return;

    setIsCanceling(true);
    try {
      const token = await getToken(true);
      if (!token) {
        toast.error('Debes iniciar sesion para cancelar la suscripcion');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/subscription/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        toast.error('No se pudo cancelar la suscripcion');
        return;
      }

      toast.success('Plan cambiado a Free');
      onOpenChange(false);

      if (onPlanUpdated) {
        onPlanUpdated();
      } else if (typeof router.refresh === 'function') {
        router.refresh();
      }
    } catch (err) {
      console.error('Error canceling subscription:', err);
      toast.error('No se pudo cancelar la suscripcion');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-zinc-200/70 bg-zinc-50/70 dark:bg-zinc-900/60 gap-4 py-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Plan Free</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>? Anuncios</p>
                <p>? Limites estandar</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200/70 bg-blue-50/60 dark:bg-blue-900/30 gap-4 py-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                  Plan Premium
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-blue-900/80 dark:text-blue-100/80">
                <p>? Sin anuncios</p>
                <p>? Analisis ilimitado</p>
              </CardContent>
            </Card>
          </div>

          <form onSubmit={handleRedeem} className="border-t pt-4 space-y-2">
            <div className="space-y-2">
              <Label htmlFor="promoCode">?Tienes un codigo promocional?</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="promoCode"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    if (hasError) setHasError(false);
                  }}
                  placeholder="Introduce tu codigo"
                  autoComplete="off"
                  className="sm:flex-1"
                  aria-invalid={hasError}
                />
                <Button
                  type="submit"
                  disabled={!normalizedCode || isSubmitting}
                  className="sm:w-44"
                >
                  {isSubmitting ? 'Canjeando...' : 'Canjear Codigo'}
                </Button>
              </div>
            </div>
          </form>

          {currentPlan === 'PREMIUM' && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={isCanceling}
                className="w-full"
              >
                {isCanceling ? 'Cancelando...' : 'Cancelar suscripcion'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
