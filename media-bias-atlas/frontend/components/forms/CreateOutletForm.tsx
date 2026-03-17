'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOutletSchema, CreateOutletFormData } from '@/lib/validations';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';

export function CreateOutletForm({ preselectedCountry = '' }: { preselectedCountry?: string }) {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOutletFormData>({
    resolver: zodResolver(createOutletSchema),
    defaultValues: {
      countryCode: preselectedCountry.toUpperCase(),
      name: '',
      websiteUrl: '',
    },
  });

  const onSubmit = async (data: CreateOutletFormData) => {
    setGlobalError(null);
    try {
      // Remover campos vacíos opcionales para no mandar strings vacíos en lugar de null/undefined
      const payload = { ...data };
      if (!payload.websiteUrl) delete payload.websiteUrl;

      await apiFetch('/outlets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Redireccionar a la página del país sobre el que registramos el medio, reseteando la caché
      router.push(`/countries/${data.countryCode}`);
      router.refresh();
      
    } catch (err: unknown) {
      const error = err as Error;
      setGlobalError(error.message || 'Apareció un error desconocido al comunicarse con el servidor.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg mx-auto bg-white p-6 sm:p-8 rounded-lg border border-gray-200 shadow-sm">
      
      {globalError && (
        <Alert title="Error de creaci&oacute;n" message={globalError} type="error" />
      )}

      <div>
        <label htmlFor="countryCode" className="block text-sm font-medium text-gray-700">Código de País (Ej. ES, US)</label>
        <input
          {...register('countryCode')}
          id="countryCode"
          maxLength={2}
          className={`mt-1 block w-full rounded-md border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.countryCode ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="ES"
        />
        {errors.countryCode && <p className="mt-1 text-sm text-red-600">{errors.countryCode.message}</p>}
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre del Medio</label>
        <input
          {...register('name')}
          id="name"
          className={`mt-1 block w-full rounded-md border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.name ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="El País"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700">URL del Sitio (Opcional)</label>
        <input
          {...register('websiteUrl')}
          id="websiteUrl"
          type="text"
          className={`mt-1 block w-full rounded-md border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.websiteUrl ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="https://elpais.com"
        />
        {errors.websiteUrl && <p className="mt-1 text-sm text-red-600">{errors.websiteUrl.message}</p>}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Guardando...' : 'Añadir Medio'}
        </button>
      </div>
    </form>
  );
}
