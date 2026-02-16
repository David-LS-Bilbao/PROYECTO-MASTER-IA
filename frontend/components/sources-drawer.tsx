'use client';

/**
 * Sources Drawer Component - Enhanced with LocalStorage Persistence
 * 
 * FEATURE: RSS AUTO-DISCOVERY + SOURCES MANAGER (Sprint 9)
 * Gestiona fuentes RSS con auto-descubrimiento IA y persistencia local.
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
// import { Switch } from '@/components/ui/switch'; // TODO: Instalar con: npx shadcn@latest add switch
// import { toast } from 'sonner'; // TODO: Instalar con: npx shadcn@latest add sonner
import { discoverRssSource } from '@/lib/api';
import { Sparkles, Loader2, Rss, Trash2, ToggleLeft, ToggleRight, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const STORAGE_KEY = 'verity_rss_sources';

interface RssSource {
  id: string;
  name: string;
  url: string;
  category: string;
  active: boolean;
  region?: string; // Sprint 32: Para filtrar fuentes locales por ubicación
}

/**
 * Sprint 32: Mapping de provincias/regiones a fuentes locales
 * Usado para recomendar fuentes según la ubicación del usuario
 */
const REGION_TO_SOURCES: Record<string, string[]> = {
  // Galicia
  'A Coruña': ['vozgalicia', 'farodevigo'],
  'Lugo': ['vozgalicia'],
  'Ourense': ['vozgalicia'],
  'Pontevedra': ['vozgalicia', 'farodevigo'],
  'Galicia': ['vozgalicia', 'farodevigo'],

  // País Vasco
  'Álava': ['elcorreo', 'diariovasco'],
  'Vizcaya': ['elcorreo', 'diariovasco'],
  'Guipúzcoa': ['elcorreo', 'diariovasco'],
  'Bilbao': ['elcorreo'],
  'País Vasco': ['elcorreo', 'diariovasco'],

  // Aragón
  'Zaragoza': ['heraldo'],
  'Huesca': ['heraldo'],
  'Teruel': ['heraldo'],
  'Aragón': ['heraldo'],

  // Comunidad Valenciana
  'Valencia': ['levante', 'lasnuevecr'],
  'Alicante': ['levante'],
  'Castellón': ['levante'],

  // Andalucía
  'Málaga': ['diariosur'],
  'Sevilla': ['diariodesevilla'],
  'Granada': ['ideal'],
  'Andalucía': ['diariosur', 'diariodesevilla', 'ideal'],

  // Murcia
  'Murcia': ['laopinion'],

  // Cataluña
  'Barcelona': ['diaridebarcelona'],
  'Girona': ['diaridebarcelona'],
  'Cataluña': ['diaridebarcelona'],
};

/**
 * Default Spanish media sources (60+ outlets)
 * Solo 3 activos por defecto para no saturar
 */
const DEFAULT_SOURCES: RssSource[] = [
  // --- GENERAL (TOP 10) --- Solo 4 primeras activas por defecto
  { id: 'elpais', name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', active: true, category: 'General' },
  { id: 'elmundo', name: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', active: true, category: 'General' },
  { id: '20min', name: '20 Minutos', url: 'https://www.20minutos.es/rss/', active: true, category: 'General' },
  { id: 'abc', name: 'Diario ABC', url: 'https://www.abc.es/rss/2.0/portada', active: true, category: 'General' },
  { id: 'lavanguardia', name: 'La Vanguardia', url: 'https://www.lavanguardia.com/mvc/feed/rss/home', active: false, category: 'General' },
  { id: 'elconfi', name: 'El Confidencial', url: 'https://rss.elconfidencial.com/espana/', active: false, category: 'General' },
  { id: 'elespanol', name: 'El Español', url: 'https://www.elespanol.com/rss/', active: false, category: 'General' },
  { id: 'larazon', name: 'La Razón', url: 'https://www.larazon.es/rss/portada.xml', active: false, category: 'General' },
  { id: 'eldiario', name: 'Eldiario.es', url: 'https://www.eldiario.es/rss/', active: false, category: 'General' },
  { id: 'publico', name: 'Público', url: 'https://www.publico.es/rss/', active: false, category: 'General' },

  // --- ECONOMÍA (TOP 10) --- Solo 4 primeras activas por defecto
  { id: 'eleconomista', name: 'El Economista', url: 'https://www.eleconomista.es/rss/rss-portada.php', active: true, category: 'Economía' },
  { id: 'cincodias', name: 'Cinco Días', url: 'https://cincodias.elpais.com/seccion/rss/portada/', active: true, category: 'Economía' },
  { id: 'expansion', name: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/portada.xml', active: true, category: 'Economía' },
  { id: 'invertia', name: 'Invertia', url: 'https://www.elespanol.com/invertia/rss/', active: true, category: 'Economía' },
  { id: 'bolsamania', name: 'Bolsamanía', url: 'https://www.bolsamania.com/rss/rss_bolsamania.xml', active: false, category: 'Economía' },
  { id: 'capitalradio', name: 'Capital Radio', url: 'https://www.capitalradio.es/rss', active: false, category: 'Economía' },
  { id: 'lainformacion', name: 'La Información', url: 'https://www.lainformacion.com/rss/', active: false, category: 'Economía' },
  { id: 'merca2', name: 'Merca2', url: 'https://www.merca2.es/feed/', active: false, category: 'Economía' },
  { id: 'emprendedores', name: 'Emprendedores', url: 'https://www.emprendedores.es/feed/', active: false, category: 'Economía' },
  { id: 'businessinsider', name: 'Business Insider ES', url: 'https://www.businessinsider.es/rss', active: false, category: 'Economía' },

  // --- DEPORTES (TOP 10) --- Solo 4 primeras activas por defecto
  { id: 'marca', name: 'Marca', url: 'https://e00-marca.uecdn.es/rss/portada.xml', active: true, category: 'Deportes' },
  { id: 'as', name: 'Diario AS', url: 'https://as.com/rss/tikitakas/portada.xml', active: true, category: 'Deportes' },
  { id: 'mundodeportivo', name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/mvc/feed/rss/home', active: true, category: 'Deportes' },
  { id: 'sport', name: 'Diario Sport', url: 'https://www.sport.es/rss/last-news/news.xml', active: true, category: 'Deportes' },
  { id: 'estadiodeportivo', name: 'Estadio Deportivo', url: 'https://www.estadiodeportivo.com/rss/', active: false, category: 'Deportes' },
  { id: 'superdeporte', name: 'Superdeporte', url: 'https://www.superdeporte.es/rss/section/2', active: false, category: 'Deportes' },
  { id: 'defensacentral', name: 'Defensa Central', url: 'https://www.defensacentral.com/rss/', active: false, category: 'Deportes' },
  { id: 'palco23', name: 'Palco23', url: 'https://www.palco23.com/rss', active: false, category: 'Deportes' },
  { id: 'eurosport', name: 'Eurosport ES', url: 'https://espanol.eurosport.com/rss.xml', active: false, category: 'Deportes' },
  { id: 'besoccer', name: 'BeSoccer', url: 'https://es.besoccer.com/rss/noticias', active: false, category: 'Deportes' },

  // --- TECNOLOGÍA (TOP 10) --- Solo 4 primeras activas por defecto
  { id: 'xataka', name: 'Xataka', url: 'https://www.xataka.com/feed/index.xml', active: true, category: 'Tecnología' },
  { id: 'genbeta', name: 'Genbeta', url: 'https://www.genbeta.com/feed/index.xml', active: true, category: 'Tecnología' },
  { id: 'applesfera', name: 'Applesfera', url: 'https://www.applesfera.com/feed/index.xml', active: true, category: 'Tecnología' },
  { id: 'computerhoy', name: 'Computer Hoy', url: 'https://computerhoy.com/feed', active: true, category: 'Tecnología' },
  { id: 'gizmodo', name: 'Gizmodo ES', url: 'https://es.gizmodo.com/rss', active: false, category: 'Tecnología' },
  { id: 'microsiervos', name: 'Microsiervos', url: 'https://www.microsiervos.com/index.xml', active: false, category: 'Tecnología' },
  { id: 'hipertextual', name: 'Hipertextual', url: 'https://hipertextual.com/feed', active: false, category: 'Tecnología' },
  { id: 'elchapuzas', name: 'El Chapuzas Informático', url: 'https://elchapuzasinformatico.com/feed/', active: false, category: 'Tecnología' },
  { id: 'softonic', name: 'Softonic News', url: 'https://www.softonic.com/es/articulos/feed', active: false, category: 'Tecnología' },
  { id: 'muycomputer', name: 'MuyComputer', url: 'https://www.muycomputer.com/feed/', active: false, category: 'Tecnología' },

  // --- CIENCIA (TOP 8) --- Solo 4 primeras activas por defecto
  { id: 'agenciasinc', name: 'Agencia SINC', url: 'https://www.agenciasinc.es/var/ezflow_site/storage/rss/rss_portada.xml', active: true, category: 'Ciencia' },
  { id: 'muyinteresante', name: 'Muy Interesante', url: 'https://www.muyinteresante.es/rss', active: true, category: 'Ciencia' },
  { id: 'natgeo', name: 'National Geographic', url: 'https://www.nationalgeographic.com.es/feeds/rss/', active: true, category: 'Ciencia' },
  { id: 'investigacionyciencia', name: 'Investigación y Ciencia', url: 'https://www.investigacionyciencia.es/rss/noticias.xml', active: true, category: 'Ciencia' },
  { id: 'efeverde', name: 'EFE Verde', url: 'https://www.efeverde.com/feed/', active: false, category: 'Ciencia' },
  { id: 'naukas', name: 'Naukas', url: 'https://naukas.com/feed/', active: false, category: 'Ciencia' },
  { id: 'theconversation', name: 'The Conversation ES', url: 'https://theconversation.com/es/articles.atom', active: false, category: 'Ciencia' },
  { id: 'materia', name: 'Materia (El País)', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada', active: false, category: 'Ciencia' },

  // --- POLÍTICA (TOP 8) --- Solo 4 primeras activas por defecto
  { id: 'europapress_nac', name: 'Europa Press Nacional', url: 'https://www.europapress.es/rss/rss.aspx?ch=00066', active: true, category: 'Política' },
  { id: 'efe_pol', name: 'EFE Política', url: 'https://www.efe.com/efe/espana/politica/10002.xml', active: true, category: 'Política' },
  { id: 'eldiario_pol', name: 'Eldiario.es Política', url: 'https://www.eldiario.es/rss/politica/', active: true, category: 'Política' },
  { id: 'infolibre', name: 'InfoLibre', url: 'https://www.infolibre.es/rss/', active: true, category: 'Política' },
  { id: 'vozpopuli', name: 'VozPópuli', url: 'https://www.vozpopuli.com/rss', active: false, category: 'Política' },
  { id: 'theobjective', name: 'The Objective', url: 'https://theobjective.com/feed/', active: false, category: 'Política' },
  { id: 'moncloa', name: 'Moncloa.com', url: 'https://www.moncloa.com/feed/', active: false, category: 'Política' },
  { id: 'elplural', name: 'El Plural', url: 'https://www.elplural.com/rss', active: false, category: 'Política' },

  // --- LOCAL (Diarios Regionales - TOP 12) --- Solo 4 primeras activas por defecto
  { id: 'vozgalicia', name: 'La Voz de Galicia', url: 'https://www.lavozdegalicia.es/rss/portada.xml', active: true, category: 'Local', region: 'Galicia' },
  { id: 'elcorreo', name: 'El Correo (País Vasco)', url: 'https://www.elcorreo.com/rss/2.0/?section=portada', active: true, category: 'Local', region: 'País Vasco' },
  { id: 'heraldo', name: 'Heraldo de Aragón', url: 'https://www.heraldo.es/rss/seccion/portada/', active: true, category: 'Local', region: 'Aragón' },
  { id: 'levante', name: 'Levante-EMV (Valencia)', url: 'https://www.levante-emv.com/rss/2.0/?section=portada', active: true, category: 'Local', region: 'Valencia' },
  { id: 'diariosur', name: 'Diario Sur (Málaga)', url: 'https://www.diariosur.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Málaga' },
  { id: 'diariodesevilla', name: 'Diario de Sevilla', url: 'https://www.diariodesevilla.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Sevilla' },
  { id: 'laopinion', name: 'La Opinión de Murcia', url: 'https://www.laopiniondemurcia.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Murcia' },
  { id: 'lasnuevecr', name: 'Las Provincias (Valencia)', url: 'https://www.lasprovincias.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Valencia' },
  { id: 'diariovasco', name: 'El Diario Vasco', url: 'https://www.diariovasco.com/rss/2.0/?section=portada', active: false, category: 'Local', region: 'País Vasco' },
  { id: 'farodevigo', name: 'Faro de Vigo', url: 'https://www.farodevigo.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Galicia' },
  { id: 'ideal', name: 'Ideal Granada', url: 'https://www.ideal.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Granada' },
  { id: 'diaridebarcelona', name: 'Diari de Barcelona', url: 'https://www.diaridegirona.cat/rss/', active: false, category: 'Local', region: 'Cataluña' },
];

interface SourcesDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Sprint 32: Componente auxiliar para renderizar una fuente RSS
 */
interface SourceItemProps {
  source: RssSource;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function SourceItem({ source, onToggle, onDelete }: SourceItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <button
        onClick={() => onToggle(source.id)}
        className="shrink-0"
        title={source.active ? 'Desactivar' : 'Activar'}
      >
        {source.active ? (
          <ToggleRight className="size-5 text-primary" />
        ) : (
          <ToggleLeft className="size-5 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{source.name}</p>
          <Badge variant="secondary" className="text-xs">
            {source.category}
          </Badge>
          {source.region && (
            <Badge variant="outline" className="text-xs gap-1">
              <MapPin className="size-3" />
              {source.region}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {source.url}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(source.id)}
        title="Eliminar"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

export function SourcesDrawer({ isOpen, onOpenChange }: SourcesDrawerProps) {
  const { user, loading: authLoading, getToken } = useAuth();
  const { profile } = useProfile(user, authLoading, getToken);

  const [sources, setSources] = useState<RssSource[]>([]);
  const [newName, setNewName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAllLocalSources, setShowAllLocalSources] = useState(false);

  // Cargar fuentes desde localStorage al montar + migración automática de nuevas fuentes
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const storedSources: RssSource[] = JSON.parse(stored);

        // Sprint 32: Auto-migration - Detectar nuevas fuentes en DEFAULT_SOURCES
        // y añadirlas automáticamente al localStorage existente
        const storedIds = new Set(storedSources.map(s => s.id));
        const newSources = DEFAULT_SOURCES.filter(defaultSource => !storedIds.has(defaultSource.id));

        if (newSources.length > 0) {
          console.log(`[SourcesDrawer] 🔄 Añadiendo ${newSources.length} nuevas fuentes: ${newSources.map(s => s.name).join(', ')}`);
          const mergedSources = [...storedSources, ...newSources];
          setSources(mergedSources);
          // El useEffect de guardado automático se encargará de persistir los cambios
        } else {
          setSources(storedSources);
        }
      } catch {
        setSources(DEFAULT_SOURCES);
      }
    } else {
      setSources(DEFAULT_SOURCES);
    }
  }, []);

  // Guardar fuentes en localStorage cuando cambien
  useEffect(() => {
    if (sources.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
    }
  }, [sources]);

  /**
   * Auto-descubre la URL del RSS usando IA (Gemini) y añade la fuente automáticamente
   */
  const handleAutoDiscover = async () => {
    if (!newName.trim()) {
      alert('Por favor, introduce el nombre del medio');
      return;
    }

    setIsSearching(true);

    try {
      const rssUrl = await discoverRssSource(newName.trim());
      
      // Añadir automáticamente la fuente encontrada
      const newSource: RssSource = {
        id: newName.toLowerCase().replace(/\s+/g, '-'),
        name: newName.trim(),
        url: rssUrl,
        category: 'General',
        active: true,
      };

      setSources([...sources, newSource]);
      alert(`✅ Fuente añadida: ${newSource.name}`);
      
      // Reset
      setNewName('');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsSearching(false);
    }
  };



  /**
   * Toggle activo/inactivo de una fuente
   */
  const toggleSource = (id: string) => {
    setSources(sources.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  /**
   * Elimina una fuente
   */
  const deleteSource = (id: string) => {
    if (confirm('¿Eliminar esta fuente?')) {
      setSources(sources.filter(s => s.id !== id));
      // toast.success('Fuente eliminada');
    }
  };

  /**
   * Sprint 32: Obtener IDs de fuentes recomendadas según ubicación del usuario
   */
  const getRecommendedSourceIds = (): string[] => {
    if (!profile?.location) return [];

    const locationParts = profile.location.split(',').map(p => p.trim());
    const recommendedIds = new Set<string>();

    // Buscar coincidencias en REGION_TO_SOURCES
    locationParts.forEach(part => {
      const matchingRegion = Object.keys(REGION_TO_SOURCES).find(
        region => region.toLowerCase() === part.toLowerCase()
      );

      if (matchingRegion) {
        REGION_TO_SOURCES[matchingRegion].forEach(id => recommendedIds.add(id));
      }
    });

    return Array.from(recommendedIds);
  };

  /**
   * Seleccionar/Deseleccionar todas las fuentes
   */
  const toggleAllSources = () => {
    const allActive = sources.every(s => s.active);
    setSources(sources.map(s => ({ ...s, active: !allActive })));
  };

  /**
   * Restaurar fuentes por defecto
   */
  const resetToDefaults = () => {
    if (confirm('¿Restaurar fuentes por defecto? Se perderán tus cambios.')) {
      setSources(DEFAULT_SOURCES);
      alert('Fuentes restauradas');
    }
  };

  // Filtrar por categoría
  const filteredSources = selectedCategory === 'all' 
    ? sources 
    : sources.filter(s => s.category === selectedCategory);

  const categories = ['all', ...Array.from(new Set(sources.map(s => s.category)))];
  const activeCount = sources.filter(s => s.active).length;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <div className="p-6 border-b shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Rss className="size-5" />
              Gestionar Fuentes RSS
            </SheetTitle>
            <SheetDescription>
              {activeCount} de {sources.length} fuentes activas · Auto-discovery con IA
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Sección: Buscador de Fuentes con IA */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Buscar Nueva Fuente con IA</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={toggleAllSources}>
                    {sources.every(s => s.active) ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetToDefaults}>
                    Restaurar defaults
                  </Button>
                </div>
              </div>

              {/* Buscador con IA */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: El País, BBC News, The Guardian..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSearching && newName.trim()) {
                        handleAutoDiscover();
                      }
                    }}
                    disabled={isSearching}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAutoDiscover}
                    disabled={isSearching || !newName.trim()}
                    className="gap-2"
                  >
                    {isSearching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Buscar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 La IA encontrará automáticamente el RSS y añadirá la fuente
                </p>
              </div>
            </div>

            {/* Filtros por categoría */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Filtrar por categoría</h3>
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'all' ? 'Todas' : cat}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sprint 32: Fuentes recomendadas según ubicación del usuario */}
            {selectedCategory === 'Local' && profile?.location && (() => {
              const recommendedIds = getRecommendedSourceIds();
              const recommendedSources = sources.filter(s => recommendedIds.includes(s.id));

              if (recommendedSources.length > 0) {
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-primary" />
                      <h3 className="font-semibold text-sm">
                        Recomendadas para {profile.location.split(',')[0]} ({recommendedSources.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {recommendedSources.map(source => (
                        <SourceItem
                          key={source.id}
                          source={source}
                          onToggle={toggleSource}
                          onDelete={deleteSource}
                        />
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Todas las fuentes (o fuentes filtradas por categoría) */}
            <div className="space-y-2">
              {selectedCategory === 'Local' && profile?.location && getRecommendedSourceIds().length > 0 ? (
                // Si hay fuentes recomendadas, mostrar toggle para ver todas
                <div>
                  <button
                    onClick={() => setShowAllLocalSources(!showAllLocalSources)}
                    className="flex items-center gap-2 w-full text-sm font-semibold hover:text-primary transition-colors"
                  >
                    {showAllLocalSources ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    Todas las fuentes locales ({filteredSources.length})
                  </button>
                  {showAllLocalSources && (
                    <div className="space-y-2 mt-2">
                      {filteredSources.map(source => (
                        <SourceItem
                          key={source.id}
                          source={source}
                          onToggle={toggleSource}
                          onDelete={deleteSource}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Comportamiento normal: mostrar todas las fuentes
                <>
                  <h3 className="font-semibold text-sm">
                    Fuentes ({filteredSources.length})
                  </h3>
                  <div className="space-y-2">
                    {filteredSources.map(source => (
                      <SourceItem
                        key={source.id}
                        source={source}
                        onToggle={toggleSource}
                        onDelete={deleteSource}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
