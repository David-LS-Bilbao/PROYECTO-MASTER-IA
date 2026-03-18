import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Outlet } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { OutletBiasSummaryBlock } from '@/components/OutletBiasSummaryBlock';
import { OutletDirectoryControls } from './OutletDirectoryControls';
import { OutletComparisonControls } from './OutletComparisonControls';
import { OutletComparisonPanel } from '@/components/OutletComparisonPanel';
import {
  filterAndSortOutlets,
  isValidAvailabilityFilter,
  isValidIdeologyLabel,
  isValidOutletBiasStatus,
  isValidOutletDirectorySort,
} from '@/lib/outletDirectoryFilters';
import { getOutletBiasProfile, getOutletBiasProfileErrorMessage } from '@/lib/outletBiasProfile';
import { resolveOutletComparisonSelection } from '@/lib/outletComparison';
import { getWebsiteDisplayLabel } from '@/lib/urlDisplay';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    code: string;
  }>;
  searchParams: Promise<{
    availability?: string;
    status?: string;
    ideology?: string;
    sort?: string;
    compareA?: string;
    compareB?: string;
  }>;
}

export default async function OutletsPage({ params, searchParams }: PageProps) {
  const { code: rawCode } = await params;
  const resolvedSearchParams = await searchParams;
  const code = rawCode.toUpperCase();
  const outlets = await apiFetch<Outlet[]>(`/countries/${code}/outlets`);
  const availabilityFilter = isValidAvailabilityFilter(resolvedSearchParams.availability)
    ? resolvedSearchParams.availability
    : '';
  const statusFilter = resolvedSearchParams.status === 'NO_SUMMARY' || isValidOutletBiasStatus(resolvedSearchParams.status)
    ? resolvedSearchParams.status
    : '';
  const ideologyFilter = isValidIdeologyLabel(resolvedSearchParams.ideology)
    ? resolvedSearchParams.ideology
    : '';
  const sort = isValidOutletDirectorySort(resolvedSearchParams.sort)
    ? resolvedSearchParams.sort
    : 'name';
  const comparisonOptions = filterAndSortOutlets(outlets, { sort: 'name' });
  const comparisonSelection = resolveOutletComparisonSelection(
    comparisonOptions,
    resolvedSearchParams.compareA,
    resolvedSearchParams.compareB,
  );
  const visibleOutlets = filterAndSortOutlets(outlets, {
    availability: availabilityFilter,
    status: statusFilter,
    ideology: ideologyFilter,
    sort,
  });
  const comparisonProfiles = comparisonSelection.primaryOutlet && comparisonSelection.secondaryOutlet
    ? await Promise.allSettled([
        getOutletBiasProfile(comparisonSelection.primaryOutlet.id),
        getOutletBiasProfile(comparisonSelection.secondaryOutlet.id),
      ])
    : null;
  const primaryComparisonProfile = comparisonProfiles?.[0]?.status === 'fulfilled'
    ? comparisonProfiles[0].value
    : null;
  const primaryComparisonError = comparisonProfiles?.[0]?.status === 'rejected'
    ? getOutletBiasProfileErrorMessage(comparisonProfiles[0].reason)
    : null;
  const secondaryComparisonProfile = comparisonProfiles?.[1]?.status === 'fulfilled'
    ? comparisonProfiles[1].value
    : null;
  const secondaryComparisonError = comparisonProfiles?.[1]?.status === 'rejected'
    ? getOutletBiasProfileErrorMessage(comparisonProfiles[1].reason)
    : null;

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
        <div className="space-y-4">
          <section className="space-y-4 rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Comparativa rápida entre medios</h2>
              <p className="text-sm text-gray-600 mt-1">
                Selecciona dos medios de {code} para contrastar su perfil ideológico actual sin salir del atlas.
              </p>
            </div>

            <OutletComparisonControls
              countryCode={code}
              outletOptions={comparisonOptions.map((outlet) => ({
                id: outlet.id,
                name: outlet.name,
              }))}
              currentCompareA={resolvedSearchParams.compareA}
              currentCompareB={resolvedSearchParams.compareB}
              currentAvailabilityFilter={availabilityFilter}
              currentStatusFilter={statusFilter}
              currentIdeologyFilter={ideologyFilter}
              currentSort={sort}
            />

            {comparisonSelection.hasDuplicateSelection ? (
              <Alert
                type="warning"
                title="Comparativa no válida"
                message="Selecciona dos medios distintos para mostrar una comparación útil."
              />
            ) : !comparisonSelection.primaryOutlet || !comparisonSelection.secondaryOutlet ? (
              <Alert
                type="info"
                title="Comparativa pendiente"
                message="Elige dos medios en los selectores superiores para cargar sus perfiles ideológicos completos."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <OutletComparisonPanel
                  outlet={comparisonSelection.primaryOutlet}
                  profile={primaryComparisonProfile}
                  errorMessage={primaryComparisonError}
                />
                <OutletComparisonPanel
                  outlet={comparisonSelection.secondaryOutlet}
                  profile={secondaryComparisonProfile}
                  errorMessage={secondaryComparisonError}
                />
              </div>
            )}
          </section>

          <OutletDirectoryControls
            countryCode={code}
            currentAvailabilityFilter={availabilityFilter}
            currentStatusFilter={statusFilter}
            currentIdeologyFilter={ideologyFilter}
            currentSort={sort}
            currentCompareA={resolvedSearchParams.compareA}
            currentCompareB={resolvedSearchParams.compareB}
            totalOutlets={outlets.length}
            visibleOutlets={visibleOutlets.length}
          />

          {visibleOutlets.length === 0 ? (
            <EmptyState
              title="Sin resultados para los filtros actuales"
              description="Ajusta los filtros del listado para volver a mostrar medios o limpia la selección actual."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleOutlets.map((outlet) => (
                <div key={outlet.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{outlet.name}</h3>
                    {outlet.websiteUrl ? (
                      <a 
                        href={outlet.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                        {getWebsiteDisplayLabel(outlet.websiteUrl)}
                        <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">Sin URL</span>
                    )}
                  </div>

                  <OutletBiasSummaryBlock summary={outlet.biasSummary} />

                  <div className="pt-1">
                    <Link
                      href={`/outlets/${outlet.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Ver detalle del medio &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
