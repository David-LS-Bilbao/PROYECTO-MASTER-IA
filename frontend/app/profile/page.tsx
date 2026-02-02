'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { TokenUsageCard } from '@/components/token-usage-card';
import { getUserProfile, updateUserProfile, UserProfile } from '@/lib/api';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  ArrowLeft, 
  Sparkles, 
  TrendingUp,
  CheckCircle2,
  Loader2,
  Save
} from 'lucide-react';

// Categorías disponibles (alineadas con el dashboard)
const AVAILABLE_CATEGORIES = [
  'Política',
  'Economía',
  'Tecnología',
  'Deportes',
  'Cultura',
  'Ciencia',
  'Mundo'
];

export default function ProfilePage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  
  // Form state
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Protección de ruta
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Cargar perfil desde backend
  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔄 Cargando perfil del usuario...');
        
        // Intentar obtener token (forzar renovación para evitar tokens expirados)
        let token = await getToken(true);
        
        if (!token) {
          console.error('❌ No se pudo obtener el token de autenticación');
          toast.error('No se pudo obtener el token de autenticación');
          setLoading(false);
          return;
        }

        console.log('✅ Token obtenido, llamando a getUserProfile...');
        setAuthToken(token); // Guardar token para TokenUsageCard
        const data = await getUserProfile(token);
        console.log('✅ Perfil cargado:', data);
        
        setProfile(data);
        setName(data.name || '');
        setSelectedCategories(data.preferences?.categories || []);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading profile:', error);
        
        // Verificar si es error de autenticación
        if (error instanceof Error && error.message.includes('Failed to fetch user profile')) {
          // Intentar refrescar el token una vez más
          console.log('🔄 Intentando refrescar token...');
          try {
            const refreshedToken = await getToken(true);
            if (refreshedToken) {
              setAuthToken(refreshedToken);
              const data = await getUserProfile(refreshedToken);
              setProfile(data);
              setName(data.name || '');
              setSelectedCategories(data.preferences?.categories || []);
              toast.success('Perfil cargado correctamente');
              setLoading(false);
              return;
            }
          } catch (retryError) {
            console.error('❌ Error al reintentar con token refrescado:', retryError);
          }
          
          toast.error('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.', {
            action: {
              label: 'Iniciar sesión',
              onClick: () => router.push('/login')
            }
          });
        } else {
          toast.error('Error al cargar el perfil');
        }
        
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadProfile();
    }
  }, [user, authLoading]); // Solo depende de user y authLoading

  // Guardar cambios
  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('No se pudo obtener el token de autenticación');
        return;
      }

      const updatedProfile = await updateUserProfile(token, {
        name: name || undefined,
        preferences: {
          ...profile.preferences,
          categories: selectedCategories
        }
      });

      setProfile(updatedProfile);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  // Toggle category
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
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

  // Calcular progreso del plan gratuito (límite ficticio: 50 análisis/mes)
  const monthlyLimit = 50;
  const usagePercentage = Math.min((profile.usageStats.articlesAnalyzed / monthlyLimit) * 100, 100);

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
            {/* Cabecera del Perfil */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Avatar */}
                  <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-4 ring-blue-500/20 shrink-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuario'}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-12 w-12 text-white" />
                    )}
                  </div>

                  {/* Información */}
                  <div className="flex-1 w-full space-y-4">
                    {/* Nombre */}
                    <div>
                      <Label htmlFor="name" className="text-sm font-medium">
                        Nombre
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        className="mt-1"
                      />
                    </div>

                    {/* Email (solo lectura) */}
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="email"
                          value={profile.email}
                          disabled
                          className="bg-zinc-100 dark:bg-zinc-800"
                        />
                        {user.emailVerified && (
                          <Badge variant="outline" className="shrink-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verificado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Plan Badge */}
                  <div className="shrink-0">
                    <Badge 
                      variant="secondary" 
                      className="text-lg px-4 py-2 font-semibold bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                    >
                      {profile.plan === 'FREE' && '🆓 Plan Gratuito'}
                      {profile.plan === 'QUOTA' && '💎 Plan Quota'}
                      {profile.plan === 'PAY_AS_YOU_GO' && '💳 Pago por Uso'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grid de Estadísticas */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Consumo de IA */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Consumo de IA</CardTitle>
                  </div>
                  <CardDescription>Uso de análisis con inteligencia artificial</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Noticias Analizadas</p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {profile.usageStats.articlesAnalyzed}
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Búsquedas</p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {profile.usageStats.searchesPerformed}
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Mensajes Chat</p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {profile.usageStats.chatMessages}
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Favoritos</p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {profile.counts.favorites}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nivel de Cuenta */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-lg">Nivel de Cuenta</CardTitle>
                  </div>
                  <CardDescription>Tu progreso en el plan gratuito</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Análisis realizados
                      </span>
                      <span className="text-sm font-semibold">
                        {profile.usageStats.articlesAnalyzed} / {monthlyLimit}
                      </span>
                    </div>
                    <Progress value={usagePercentage} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {usagePercentage >= 100 
                        ? '⚠️ Has alcanzado el límite mensual'
                        : `Quedan ${monthlyLimit - profile.usageStats.articlesAnalyzed} análisis este mes`
                      }
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Miembro desde</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(profile.createdAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">ID de usuario</p>
                          <p className="text-xs font-mono text-muted-foreground break-all">
                            {profile.id.substring(0, 20)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configuración de Preferencias */}
            <Card>
              <CardHeader>
                <CardTitle>Preferencias de Contenido</CardTitle>
                <CardDescription>
                  Selecciona las categorías de noticias que más te interesan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {AVAILABLE_CATEGORIES.map((category) => (
                    <div
                      key={category}
                      className="flex items-center space-x-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <Checkbox
                        id={category}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={() => toggleCategory(category)}
                      />
                      <Label
                        htmlFor={category}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>

                {selectedCategories.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      📰 Has seleccionado <strong>{selectedCategories.length}</strong> categoría(s): {' '}
                      {selectedCategories.join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Token Usage Statistics */}
            {authToken && <TokenUsageCard token={authToken} />}
          </div>
        </div>
      </main>
    </div>
  );
}
