'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { StatsOverview } from '@/components/dashboard';

interface DashboardDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  totalArticles: number;
  analyzedCount: number;
  coverage: number;
  biasDistribution: {
    left: number;
    neutral: number;
    right: number;
  };
  isLoading?: boolean;
}

export function DashboardDrawer({
  isOpen,
  onOpenChange,
  totalArticles,
  analyzedCount,
  coverage,
  biasDistribution,
  isLoading = false,
}: DashboardDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Inteligencia de Medios</SheetTitle>
          <SheetDescription>
            Análisis global de sesgo y cobertura de noticias
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8">
          <StatsOverview
            totalArticles={totalArticles}
            analyzedCount={analyzedCount}
            coverage={coverage}
            biasDistribution={biasDistribution}
            isLoading={isLoading}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
