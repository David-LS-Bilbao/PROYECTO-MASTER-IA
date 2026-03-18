import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Country } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';

export const dynamic = 'force-dynamic';

export default async function CountriesPage() {
  let countries: Country[] = [];
  let errorMessage: string | null = null;

  try {
    countries = await apiFetch<Country[]>('/countries');
  } catch (error) {
    errorMessage = error instanceof Error
      ? error.message
      : 'No se pudo cargar el catálogo de países.';
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Países Disponibles</h1>
          <p className="text-gray-500 mt-1">Selecciona un país para explorar sus medios registrados.</p>
        </div>

        <Alert
          type="warning"
          title="Catálogo temporalmente no disponible"
          message={errorMessage}
        />
      </div>
    );
  }

  if (!countries || countries.length === 0) {
    return <EmptyState title="Sin países" description="Actualmente no hay países registrados en la base de datos." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Países Disponibles</h1>
        <p className="text-gray-500 mt-1">Selecciona un país para explorar sus medios registrados.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {countries.map((country) => (
          <Link 
            key={country.code} 
            href={`/countries/${country.code}`}
            className="block group"
          >
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary transition-colors">
                  {country.name}
                </h3>
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {country.code}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
