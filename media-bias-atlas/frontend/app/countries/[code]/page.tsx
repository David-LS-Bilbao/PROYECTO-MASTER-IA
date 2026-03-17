import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Outlet } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    code: string;
  }>;
}

export default async function OutletsPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const outlets = await apiFetch<Outlet[]>(`/countries/${code}/outlets`);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-blue-600">Países</Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{code}</span>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Medios de {code}</h1>
          <p className="text-gray-500 mt-1">Explora los medios registrados para este país.</p>
        </div>
        <Link 
          href={`/outlets/new?country=${code}`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          Añadir Medio
        </Link>
      </div>

      {!outlets || outlets.length === 0 ? (
        <EmptyState 
          title="Sin medios registrados" 
          description={`Actualmente no hay medios dados de alta para el país ${code}.`} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((outlet) => (
            <div key={outlet.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{outlet.name}</h3>
              {outlet.websiteUrl ? (
                <a 
                  href={outlet.websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center"
                >
                  {new URL(outlet.websiteUrl).hostname.replace('www.', '')}
                  <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <span className="text-sm text-gray-400">Sin URL</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
