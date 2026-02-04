/**
 * useProfile - Step 6 Plan Mikado
 *
 * Hook para gestión de estado del perfil de usuario.
 * Maneja carga, guardado y token de autenticación.
 *
 * Responsabilidad: Estado del perfil + operaciones CRUD.
 */

import { useEffect, useState } from 'react';
import { getUserProfile, updateUserProfile } from '@/lib/profile.api';
import type { UserProfile, UpdateProfileDTO } from '@/lib/profile.api';
import { useRetryWithToast } from '@/hooks/useRetryWithToast';
import { toast } from 'sonner';

export function useProfile(
  user: any | null,
  authLoading: boolean,
  getToken: (forceRefresh?: boolean) => Promise<string | null>,
) {
  const { retryWithTokenRefresh } = useRetryWithToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');

  // Cargar perfil desde backend
  useEffect(() => {
    if (authLoading) return;

    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      const data = await retryWithTokenRefresh(
        async (token) => {
          setAuthToken(token);
          return getUserProfile(token);
        },
        'Error al cargar el perfil',
      );

      if (data) {
        setProfile(data);
      }

      setLoading(false);
    }

    loadProfile();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardar cambios del perfil
  const save = async (updates: UpdateProfileDTO) => {
    if (!profile) return;

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('No se pudo obtener el token de autenticación');
        return;
      }

      const updatedProfile = await updateUserProfile(token, updates);
      setProfile(updatedProfile);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  return { profile, loading, saving, authToken, save };
}
