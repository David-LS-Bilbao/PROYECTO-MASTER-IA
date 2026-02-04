'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TokenUsageCard } from '@/components/token-usage-card';
import { useProfileAuth } from '@/hooks/useProfileAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCategoryToggle } from '@/hooks/useCategoryToggle';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

import {
  ProfileHeader,
  UsageStatsCard,
  AccountLevelCard,
  CategoryPreferences,
} from '@/components/profile';

const AVAILABLE_CATEGORIES = [
  'Política',
  'Economía',
  'Tecnología',
  'Deportes',
  'Cultura',
  'Ciencia',
  'Mundo',
];

export default function ProfilePage() {
  const { user, authLoading, getToken } = useProfileAuth();
  const router = useRouter();
  const { profile, loading, saving, authToken, save } = useProfile(user, authLoading, getToken);

  // Form state
  const [name, setName] = useState('');
  const { selected: selectedCategories, toggle: toggleCategory, setSelected: setSelectedCategories } = useCategoryToggle([]);

  // Sincronizar form state cuando el perfil carga
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setSelectedCategories(profile.preferences?.categories || []);
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    await save({
      name: name || undefined,
      preferences: {
        ...profile?.preferences,
        categories: selectedCategories,
      },
    });
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-zinc-900 dark:text-white">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  // No autenticado
  if (!user || !profile) {
    return null;
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Mi Perfil
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gestiona tu cuenta y preferencias
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <ProfileHeader
                  name={name}
                  email={profile.email}
                  photoURL={user.photoURL}
                  displayName={user.displayName}
                  emailVerified={user.emailVerified}
                  plan={profile.plan}
                  onNameChange={setName}
                />
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <UsageStatsCard
                articlesAnalyzed={profile.usageStats.articlesAnalyzed}
                searchesPerformed={profile.usageStats.searchesPerformed}
                chatMessages={profile.usageStats.chatMessages}
                favorites={profile.counts.favorites}
              />

              <AccountLevelCard
                articlesAnalyzed={profile.usageStats.articlesAnalyzed}
                plan={profile.plan}
                createdAt={profile.createdAt}
                userId={profile.id}
              />
            </div>

            <CategoryPreferences
              availableCategories={AVAILABLE_CATEGORIES}
              selectedCategories={selectedCategories}
              onToggle={toggleCategory}
            />

            {authToken && <TokenUsageCard token={authToken} />}
          </div>
        </div>
      </main>
    </div>
  );
}
