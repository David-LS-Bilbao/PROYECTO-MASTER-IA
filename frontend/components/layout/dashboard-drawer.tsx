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
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>📊 Inteligencia de Medios</SheetTitle>
          <SheetDescription>
            Análisis automático para ayudarte a identificar sesgos y entender la cobertura de noticias
          </SheetDescription>
        </SheetHeader>

        {/* Explicación educativa */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-2">
            💡 ¿Cómo interpretar estos datos?
          </h3>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>Noticias Objetivas altas (&gt;70%):</strong> Tu cobertura es balanceada</li>
            <li>• <strong>Gráfico equilibrado:</strong> Verde en el centro y lados balanceados</li>
            <li>• <strong>% Analizadas alto:</strong> Datos más fiables para tomar decisiones</li>
          </ul>
        </div>

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
