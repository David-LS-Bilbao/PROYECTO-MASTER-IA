import React from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Outlet, RssFeed } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { AddFeedForm } from '@/components/AddFeedForm';
import { FeedRowActions } from '@/components/FeedRowActions';
import { OutletBiasProfileCard } from '@/components/OutletBiasProfileCard';
import { getOutletBiasProfile, getOutletBiasProfileErrorMessage } from '@/lib/outletBiasProfile';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OutletDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [outletResult, feedsResult, biasProfileResult] = await Promise.allSettled([
    apiFetch<Outlet>(`/outlets/${id}`),
    apiFetch<RssFeed[]>(`/outlets/${id}/feeds`),
    getOutletBiasProfile(id),
  ]);

  if (outletResult.status === 'rejected') {
    const outletErrorMessage = getErrorMessage(outletResult.reason, 'No se pudo cargar el medio.');

    if (outletErrorMessage.toLowerCase().includes('no encontrado')) {
      return (
        <EmptyState
          title="Medio no encontrado"
          description="El ID proporcionado no pertenece a ningún Medio registrado."
        />
      );
    }

    throw outletResult.reason;
  }

  const outlet = outletResult.value;
  const feeds = feedsResult.status === 'fulfilled' ? feedsResult.value : [];
  const biasProfile = biasProfileResult.status === 'fulfilled' ? biasProfileResult.value : null;
  const biasProfileError =
    biasProfileResult.status === 'rejected'
      ? getOutletBiasProfileErrorMessage(biasProfileResult.reason)
      : null;

  return (
    <div className="space-y-6">
      
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
        <Link href={`/countries/${outlet.countryId}`} className="hover:text-blue-600">
          Volver a medios de {outlet.countryId}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{outlet.name}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{outlet.name}</h1>
          {outlet.websiteUrl && (
            <a 
              href={outlet.websiteUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline mt-1 inline-block text-sm"
            >
              Visitar sitio original &rarr;
            </a>
          )}
        </div>
      </div>

      <OutletBiasProfileCard profile={biasProfile} errorMessage={biasProfileError} />

      {/* Formulario de Alta Rápida de Feeds */}
      <AddFeedForm outletId={outlet.id} />

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 border-b pb-2">Fuentes RSS Configuradas</h2>
        
        {!feeds || feeds.length === 0 ? (
          <EmptyState 
            title="Sin fuentes activas" 
            description="Añade la URL del feed RSS para empezar a ingerir noticias en el atlas." 
          />
        ) : (
          <div className="bg-white shadow-sm border border-gray-200 rounded-md overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {feeds.map((feed) => (
                <li key={feed.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate" title={feed.url}>
                      {feed.url}
                    </p>
                    <div className="flex items-center mt-1 text-xs text-gray-500 gap-3">
                      <span>Estado: {feed.isActive ? <span className="text-green-600 font-semibold">Activo</span> : 'Deshabilitado'}</span>
                      <span>•</span>
                      <span>
                        Última sincronización:{' '}
                        {feed.lastCheckedAt 
                          ? new Date(feed.lastCheckedAt).toLocaleString('es-ES') 
                          : 'Nunca'}
                      </span>
                    </div>
                  </div>
                  <FeedRowActions feedId={feed.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}
