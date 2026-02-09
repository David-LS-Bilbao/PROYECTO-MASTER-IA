/**
 * ProfileHeader - Step 4 Plan Mikado
 *
 * Componente de presentación: Avatar + Nombre + Email + Plan Badge.
 * Stateless: toda la lógica de estado vive en el componente padre.
 */

import { User, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export interface ProfileHeaderProps {
  name: string;
  email: string;
  location: string; // Sprint 20: Geolocalización
  photoURL?: string | null;
  displayName?: string | null;
  emailVerified: boolean;
  plan: 'FREE' | 'QUOTA' | 'PAY_AS_YOU_GO';
  onNameChange: (name: string) => void;
  onLocationChange: (location: string) => void; // Sprint 20: Handler para location
}

export function ProfileHeader({
  name,
  email,
  location,
  photoURL,
  displayName,
  emailVerified,
  plan,
  onNameChange,
  onLocationChange,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
      {/* Avatar */}
      <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-4 ring-blue-500/20 shrink-0 overflow-hidden">
        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName || 'Usuario'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <User className="h-12 w-12 text-white" />
        )}
        {photoURL && (
          <User className="h-12 w-12 text-white absolute" style={{ display: 'none' }} />
        )}
      </div>

      {/* Información */}
      <div className="flex-1 w-full space-y-4">
        <div>
          <Label htmlFor="name" className="text-sm font-medium">
            Nombre
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Tu nombre"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              id="email"
              value={email}
              disabled
              className="bg-zinc-100 dark:bg-zinc-800"
            />
            {emailVerified && (
              <Badge variant="outline" className="shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verificado
              </Badge>
            )}
          </div>
        </div>

        {/* Sprint 20: Ubicación (Geolocalización) */}
        <div>
          <Label htmlFor="location" className="text-sm font-medium">
            Ubicación (Ciudad, País)
          </Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Ej: Madrid, España"
            className="mt-1"
          />
        </div>
      </div>

      {/* Plan Badge */}
      <div className="shrink-0">
        <Badge
          variant="secondary"
          className="text-lg px-4 py-2 font-semibold bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
        >
          {plan === 'FREE' && 'Plan Gratuito'}
          {plan === 'QUOTA' && 'Plan Quota'}
          {plan === 'PAY_AS_YOU_GO' && 'Pago por Uso'}
        </Badge>
      </div>
    </div>
  );
}
