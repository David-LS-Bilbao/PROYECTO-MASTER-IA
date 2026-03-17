import Link from 'next/link';
import { CreateOutletForm } from '@/components/forms/CreateOutletForm';

interface PageProps {
  searchParams: Promise<{
    country?: string;
  }>;
}

export default async function NewOutletPage({ searchParams }: PageProps) {
  const { country = '' } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-600">Países</Link>
        <span>/</span>
        {country ? (
          <>
            <Link href={`/countries/${country}`} className="hover:text-blue-600">{country}</Link>
            <span>/</span>
          </>
        ) : null}
        <span className="font-medium text-gray-900">Nuevo Medio</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Añadir Nuevo Medio</h1>
        <p className="text-gray-500 mt-1">
          Completa los datos del medio para vincularlo a un país en la base de datos de Media Bias Atlas.
        </p>
      </div>

      <CreateOutletForm preselectedCountry={country as string} />
    </div>
  );
}
