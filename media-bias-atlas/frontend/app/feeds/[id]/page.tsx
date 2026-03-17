import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Article } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
// Como SyncButton es interactivo (Client) necesita onResult, 
// Pero en un Server Component solo podemos refrescar auto con router o ignorarlo.
import { SyncReloader } from './SyncReloader'; 
import { FeedClassificationBar } from './FeedClassificationBar';
import { ClassificationLabel } from './ClassificationLabel';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    id: string; // feedId
  }>;
  searchParams: Promise<{
    political?: string; // query para el backend
  }>;
}

export default async function ArticlesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const politicalFilter = resolvedSearchParams.political;

  // Lógica fetching
  const endpoint = politicalFilter ? `/feeds/${id}/articles?political=${politicalFilter}` : `/feeds/${id}/articles`;
  const articles = await apiFetch<Article[]>(endpoint).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
         {/* Al no tener outletId aquí directamente tendríamos que traer el feed primero,
             Por simplicidad en la iteración 4 asumimos volver genérico */}
        <Link href="/" className="hover:text-blue-600">
          &larr; Volver al Catálogo
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">Artículos Ingeridos</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Visor de Noticias</h1>
          <p className="text-gray-500 mt-1 text-sm">Mostrando los últimos registros recolectados de este Feed.</p>
        </div>
        
        <div className="shrink-0 flex items-center gap-3">
           <SyncReloader feedId={id} />
        </div>
      </div>

      <FeedClassificationBar feedId={id} currentFilter={politicalFilter} />

      {!articles || articles.length === 0 ? (
        <EmptyState 
          title="Sin Artículos Recolectados" 
          description="Presiona sincronizar o espera a la próxima ejecución del Cron automático." 
        />
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-md overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {articles.map((article) => (
              <li key={article.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col gap-1">
                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-blue-800 hover:text-blue-600 hover:underline leading-snug"
                  >
                    {article.title}
                  </a>
                  
                  <div className="flex items-center gap-3 mt-2">
                     <ClassificationLabel article={article} />
                     <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {new Date(article.publishedAt).toLocaleDateString('es-ES', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                     </span>
                     <span className="text-xs truncate max-w-[150px] md:max-w-[300px] text-gray-400">
                       {article.url}
                     </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
