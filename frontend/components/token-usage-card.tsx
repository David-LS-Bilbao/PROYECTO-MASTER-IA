'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTokenUsage, TokenUsageStats } from '@/lib/api';
import { Loader2, Coins, TrendingUp, Activity } from 'lucide-react';

interface TokenUsageCardProps {
  token: string;
}

export function TokenUsageCard({ token }: TokenUsageCardProps) {
  const [stats, setStats] = useState<TokenUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTokenStats() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTokenUsage(token);
        setStats(data);
      } catch (err) {
        console.error('Error loading token stats:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadTokenStats();
    }
  }, [token]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Uso de Tokens (Gemini API)
          </CardTitle>
          <CardDescription>
            Consumo de tokens en la sesión actual del servidor
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Uso de Tokens (Gemini API)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const formatCost = (cost?: number) => cost != null ? `€${cost.toFixed(4)}` : '€0.0000';
  const formatTokens = (tokens?: number) => tokens != null ? tokens.toLocaleString('es-ES') : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Uso de Tokens (Gemini API)
        </CardTitle>
        <CardDescription>
          Estadísticas de la sesión actual del servidor
        </CardDescription>
        <div className="text-xs text-muted-foreground mt-2">
          <p>🕒 Sesión iniciada: {new Date(stats.sessionStart).toLocaleString('es-ES')}</p>
          <p>⏱️ Tiempo activo: {stats.uptime}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Totales */}
        <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Sesión
            </h3>
            <span className="text-2xl font-bold text-primary">
              {formatCost(stats.total.cost)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Operaciones</p>
              <p className="font-semibold">{stats.total?.operations ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tokens Totales</p>
              <p className="font-semibold">{formatTokens(stats.total?.totalTokens)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Input</p>
              <p className="font-semibold">{formatTokens(stats.total?.promptTokens)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Output</p>
              <p className="font-semibold">{formatTokens(stats.total?.completionTokens)}</p>
            </div>
          </div>
        </div>

        {/* Desglose por tipo */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            Desglose por Operación
          </h3>

          {/* Análisis de Artículos */}
          {stats.analysis?.count > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">📊 Análisis de Artículos</h4>
                <span className="font-bold text-sm">{formatCost(stats.analysis?.cost)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Operaciones</p>
                  <p className="font-semibold">{stats.analysis?.count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Input</p>
                  <p className="font-semibold">{formatTokens(stats.analysis?.promptTokens)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Output</p>
                  <p className="font-semibold">{formatTokens(stats.analysis?.completionTokens)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Chat RAG */}
          {stats.ragChat?.count > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">💬 Chat con RAG</h4>
                <span className="font-bold text-sm">{formatCost(stats.ragChat?.cost)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Operaciones</p>
                  <p className="font-semibold">{stats.ragChat?.count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Input</p>
                  <p className="font-semibold">{formatTokens(stats.ragChat?.promptTokens)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Output</p>
                  <p className="font-semibold">{formatTokens(stats.ragChat?.completionTokens)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Grounding Chat */}
          {stats.groundingChat?.count > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">🔍 Chat con Búsqueda</h4>
                <span className="font-bold text-sm">{formatCost(stats.groundingChat?.cost)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Operaciones</p>
                  <p className="font-semibold">{stats.groundingChat?.count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Input</p>
                  <p className="font-semibold">{formatTokens(stats.groundingChat?.promptTokens)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Output</p>
                  <p className="font-semibold">{formatTokens(stats.groundingChat?.completionTokens)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sin actividad */}
          {(stats.total?.operations ?? 0) === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No hay actividad registrada en esta sesión</p>
            </div>
          )}
        </div>

        {/* Nota informativa */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
          <p>
            💡 <strong>Nota:</strong> Estas estadísticas corresponden a la sesión actual del servidor.
            Al reiniciar el servidor, los contadores se reinician. Para estadísticas históricas personales,
            consulta las métricas de actividad en tu perfil.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
