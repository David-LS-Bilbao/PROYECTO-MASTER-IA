import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Article, FeedBiasSummary } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { SyncReloader } from './SyncReloader'; 
import { FeedClassificationBar } from './FeedClassificationBar';
import { ClassificationLabel } from './ClassificationLabel';
import { BiasAnalysisBadge } from './BiasAnalysisBadge';
import { FeedBiasSummaryCard } from './FeedBiasSummaryCard';
import { filterFeedArticles, resolveBiasAnalysisStatus } from '@/lib/feedArticleFilters';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    id: string; // feedId
  }>;
  searchParams: Promise<{
    political?: string;
    analysis?: string;
    ideology?: string;
  }>;
}

export default async function ArticlesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const politicalFilter = resolvedSearchParams.political;
  const analysisFilter = resolvedSearchParams.analysis;
  const ideologyFilter = resolvedSearchParams.ideology;

  const [articlesResult, summaryResult] = await Promise.allSettled([
    apiFetch<Article[]>(`/feeds/${id}/articles`),
    apiFetch<FeedBiasSummary>(`/feeds/${id}/bias-summary`),
  ]);

  const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : [];
  const articlesError = articlesResult.status === 'rejected'
    ? (articlesResult.reason instanceof Error ? articlesResult.reason.message : 'No se pudieron cargar los artículos del feed.')
    : null;
  const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const summaryError = summaryResult.status === 'rejected'
    ? (summaryResult.reason instanceof Error ? summaryResult.reason.message : 'No se pudo cargar el resumen ideológico.')
    : null;
  const filteredArticles = filterFeedArticles(articles, {
    political: politicalFilter,
    analysis: analysisFilter,
    ideology: ideologyFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
        <Link href="/" className="hover:text-blue-600">
          &larr; Volver al Catálogo
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">Artículos Ingeridos</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Visor de Noticias</h1>
          <p className="text-gray-500 mt-1 text-sm">Clasificación política y sesgo ideológico sobre los artículos ya ingeridos del feed.</p>
        </div>
        
        <div className="shrink-0 flex items-center gap-3">
           <SyncReloader feedId={id} />
        </div>
      </div>

      <FeedClassificationBar
        feedId={id}
        currentPoliticalFilter={politicalFilter}
        currentAnalysisFilter={analysisFilter}
        currentIdeologyFilter={ideologyFilter}
      />

      <FeedBiasSummaryCard summary={summary} errorMessage={summaryError} />

      {articlesError && (
        <Alert
          type="error"
          title="No se pudieron cargar los artículos"
          message={articlesError}
        />
      )}

      {articles.length === 0 ? (
        <EmptyState 
          title="Sin Artículos Recolectados" 
          description="Presiona sincronizar o espera a la próxima ejecución del Cron automático." 
        />
      ) : filteredArticles.length === 0 ? (
        <EmptyState
          title="Sin resultados para los filtros actuales"
          description="Ajusta los filtros del feed para volver a mostrar artículos o limpia la selección actual."
        />
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-md overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filteredArticles.map((article) => (
              <li key={article.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col gap-2">
                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-blue-800 hover:text-blue-600 hover:underline leading-snug"
                  >
                    {article.title}
                  </a>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                     <ClassificationLabel article={article} />
                     <BiasAnalysisBadge analysis={article.biasAnalysis} />
                     <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {new Date(article.publishedAt).toLocaleDateString('es-ES', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                     </span>
                     <span className="text-xs truncate max-w-[150px] md:max-w-[300px] text-gray-400">
                       {article.url}
                     </span>
                  </div>

                  {renderBiasAnalysisDetail(article)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderBiasAnalysisDetail(article: Article) {
  const biasStatus = resolveBiasAnalysisStatus(article.biasAnalysis);

  if (article.isPolitical !== true) {
    return (
      <p className="text-xs text-gray-500">
        Este artículo no es político; no se lanza análisis ideológico.
      </p>
    );
  }

  if (biasStatus === 'FAILED') {
    return (
      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {article.biasAnalysis?.errorMessage || 'El análisis ideológico falló y quedó persistido como FAILED.'}
      </p>
    );
  }

  if (biasStatus !== 'COMPLETED') {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Análisis ideológico pendiente o aún no solicitado para este artículo.
      </p>
    );
  }

  const helperText = article.biasAnalysis?.summary || article.biasAnalysis?.reasoningShort || 'Sin resumen disponible.';

  return (
    <div className="text-sm text-gray-700 bg-sky-50 border border-sky-100 rounded-md px-3 py-2 space-y-1">
      <p className="font-medium text-sky-900">{helperText}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-sky-800">
        {article.biasAnalysis?.reasoningShort && article.biasAnalysis.reasoningShort !== helperText && (
          <span>{article.biasAnalysis.reasoningShort}</span>
        )}
        {article.biasAnalysis?.provider && (
          <span>Provider: {article.biasAnalysis.provider}</span>
        )}
        {article.biasAnalysis?.model && (
          <span>Modelo: {article.biasAnalysis.model}</span>
        )}
        {article.biasAnalysis?.analyzedAt && (
          <span>
            Analizado:{' '}
            {new Date(article.biasAnalysis.analyzedAt).toLocaleString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
}
