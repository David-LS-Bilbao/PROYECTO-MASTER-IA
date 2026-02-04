/**
 * CategoryPreferences - Step 4 Plan Mikado
 *
 * Componente de presentación: Selección de categorías de noticias.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface CategoryPreferencesProps {
  availableCategories: string[];
  selectedCategories: string[];
  onToggle: (category: string) => void;
}

export function CategoryPreferences({
  availableCategories,
  selectedCategories,
  onToggle,
}: CategoryPreferencesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de Contenido</CardTitle>
        <CardDescription>
          Selecciona las categorías de noticias que más te interesan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {availableCategories.map((category) => (
            <div
              key={category}
              className="flex items-center space-x-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <Checkbox
                id={category}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => onToggle(category)}
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
              Has seleccionado <strong>{selectedCategories.length}</strong> categoría(s):{' '}
              {selectedCategories.join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
