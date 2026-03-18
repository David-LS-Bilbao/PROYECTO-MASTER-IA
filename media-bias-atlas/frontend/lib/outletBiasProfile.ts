import { apiFetch } from '@/lib/api';
import { OutletBiasProfile } from '@/types';

export async function getOutletBiasProfile(outletId: string): Promise<OutletBiasProfile> {
  return apiFetch<OutletBiasProfile>(`/outlets/${outletId}/bias-profile`);
}

export function getOutletBiasProfileErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : 'No se pudo cargar el perfil ideológico del medio.';

  if (message.toLowerCase().includes('no encontrado')) {
    return 'El perfil ideológico no está disponible para este medio.';
  }

  return message;
}
