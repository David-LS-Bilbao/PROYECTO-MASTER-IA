'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Alert } from './ui/Alert';

const feedSchema = z.object({
  url: z
    .string()
    .min(1, 'La URL es obligatoria')
    .url('Debe ser una URL válida')
    .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
      message: 'La URL debe empezar por http:// o https://',
    }),
});

type FeedFormValues = z.infer<typeof feedSchema>;

interface AddFeedFormProps {
  outletId: string;
}

export function AddFeedForm({ outletId }: AddFeedFormProps) {
  const router = useRouter();
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeedFormValues>({
    resolver: zodResolver(feedSchema),
  });

  const onSubmit = async (data: FeedFormValues) => {
    try {
      setErrorStatus(null);
      setIsSuccess(false);

      await apiFetch(`/outlets/${outletId}/feeds`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      setIsSuccess(true);
      reset();
      router.refresh(); // Fuerza el refetch de Next.js Server Components en la página actual

    } catch (err: unknown) {
      const error = err as Error;
      // Manejar el 409 Conflict o errores generales del backend centralizado
      if (error.message && error.message.includes('clave única') || error.message.includes('409')) {
        setErrorStatus('Esta URL ya está registrada en el sistema.');
      } else {
        setErrorStatus(error.message || 'Error desconocido al guardar el RSS Feed.');
      }
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Añadir nueva fuente RSS</h3>
      
      {errorStatus && (
        <div className="mb-4">
          <Alert type="error" message={errorStatus} />
        </div>
      )}

      {isSuccess && (
        <div className="mb-4">
          <Alert type="success" message="Fuente RSS agregada correctamente." />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex items-start gap-4 flex-col sm:flex-row">
        <div className="flex-1 w-full">
          <label htmlFor="url" className="sr-only">URL del XML</label>
          <input
            id="url"
            {...register('url')}
            type="url"
            placeholder="https://ejemplo.com/rss.xml"
            disabled={isSubmitting}
            className={`block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ${
              errors.url ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-blue-600'
            } focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
          />
          {errors.url && (
            <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Guardando...' : '+ Vincular Feed'}
        </button>
      </form>
    </div>
  );
}
