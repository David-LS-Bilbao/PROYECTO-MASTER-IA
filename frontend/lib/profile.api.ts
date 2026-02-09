/**
 * Profile API Layer - Step 1 Plan Mikado
 *
 * Responsabilidad: CRUD de perfil con errores HTTP tipados.
 * Extraído de lib/api.ts para cumplir SRP.
 */

import type { UserProfile, UserProfileResponse } from './api';

export type { UserProfile } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Error tipado para fallos de Profile API
 */
export class ProfileAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileAPIError';
  }
}

export interface UpdateProfileDTO {
  name?: string;
  location?: string; // Sprint 20: Geolocalización
  preferences?: {
    categories?: string[];
    theme?: string;
    notifications?: boolean;
  };
}

/**
 * Obtener perfil del usuario autenticado
 * @throws ProfileAPIError en fallos HTTP
 */
export async function getUserProfile(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new ProfileAPIError(
      res.status,
      `Failed to fetch user profile: ${res.statusText}`,
    );
  }

  const response: UserProfileResponse = await res.json();
  return response.data;
}

/**
 * Actualizar perfil del usuario (nombre, ubicación y preferencias)
 * Sprint 20: Añadido soporte para location
 * @throws ProfileAPIError en fallos HTTP
 */
export async function updateUserProfile(
  token: string,
  data: UpdateProfileDTO,
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new ProfileAPIError(
      res.status,
      `Failed to update profile: ${res.statusText}`,
    );
  }

  const response: UserProfileResponse = await res.json();
  return response.data;
}
