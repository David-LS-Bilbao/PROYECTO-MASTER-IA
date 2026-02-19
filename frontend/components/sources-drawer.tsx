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
import { discoverRssSource, discoverLocalSources, type DiscoveredLocalSource } from '@/lib/api';
import { Sparkles, Loader2, Rss, Trash2, ToggleLeft, ToggleRight, MapPin, ChevronDown, ChevronUp, Search } from 'lucide-react';
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
  'A Coruña': ['vozgalicia', 'laopinioncoruna'],
  'La Coruña': ['vozgalicia', 'laopinioncoruna'],
  'Coruña': ['vozgalicia', 'laopinioncoruna'],
  'Lugo': ['vozgalicia', 'elprogreso'],
  'Ourense': ['vozgalicia'],
  'Orense': ['vozgalicia'],
  'Pontevedra': ['vozgalicia', 'farodevigo'],
  'Vigo': ['farodevigo'],
  'Galicia': ['vozgalicia', 'farodevigo', 'laopinioncoruna', 'elprogreso'],

  // País Vasco / Euskadi
  'Álava': ['elcorreo', 'diariovasco'],
  'Araba': ['elcorreo', 'diariovasco'],
  'Vizcaya': ['elcorreo', 'diariovasco'],
  'Bizkaia': ['elcorreo', 'diariovasco'],
  'Guipúzcoa': ['diariovasco', 'noticiasgipuzkoa'],
  'Gipuzkoa': ['diariovasco', 'noticiasgipuzkoa'],
  'Bilbao': ['elcorreo'],
  'San Sebastián': ['diariovasco', 'noticiasgipuzkoa'],
  'Donostia': ['diariovasco', 'noticiasgipuzkoa'],
  'Vitoria': ['elcorreo'],
  'País Vasco': ['elcorreo', 'diariovasco', 'noticiasgipuzkoa'],
  'Euskadi': ['elcorreo', 'diariovasco', 'noticiasgipuzkoa'],

  // Cataluña / Catalunya
  'Barcelona': ['diaridebarcelona', 'elperiodico', 'regio7'],
  'Girona': ['diaridebarcelona'],
  'Gerona': ['diaridebarcelona'],
  'Tarragona': ['diaritarragona'],
  'Lleida': ['diaridebarcelona'],
  'Lérida': ['diaridebarcelona'],
  'Cataluña': ['diaridebarcelona', 'elperiodico', 'regio7', 'diaritarragona'],
  'Catalunya': ['diaridebarcelona', 'elperiodico', 'regio7', 'diaritarragona'],

  // Madrid - Comunidad de Madrid (ampliado con fuentes regionales)
  'Madrid': ['telemadrid', 'madriddiario', 'somosmadrid', 'comunidad_madrid_news', 'el_espanol_madrid', 'abc_madrid'],
  'Mostoles': ['telemadrid', 'madriddiario', 'somosmadrid', 'comunidad_madrid_news', 'el_espanol_madrid'],
  'Móstoles': ['telemadrid', 'madriddiario', 'somosmadrid', 'comunidad_madrid_news', 'el_espanol_madrid'],
  'Alcalá de Henares': ['telemadrid', 'comunidad_madrid_news', 'el_espanol_madrid'],
  'Leganés': ['telemadrid', 'madriddiario', 'comunidad_madrid_news'],
  'Fuenlabrada': ['telemadrid', 'madriddiario', 'comunidad_madrid_news'],
  'Alcorcón': ['telemadrid', 'madriddiario', 'comunidad_madrid_news'],
  'Getafe': ['telemadrid', 'madriddiario', 'comunidad_madrid_news'],
  'Comunidad de Madrid': ['telemadrid', 'madriddiario', 'somosmadrid', 'comunidad_madrid_news', 'el_espanol_madrid', 'abc_madrid'],

  // Andalucía
  'Málaga': ['diariosur'],
  'Sevilla': ['diariodesevilla'],
  'Granada': ['ideal'],
  'Córdoba': ['diariocordoba'],
  'Jaén': ['diariojaen'],
  'Huelva': ['diariosur'],
  'Cádiz': ['diariosur'],
  'Almería': ['ideal'],
  'Andalucía': ['diariosur', 'diariodesevilla', 'ideal', 'diariocordoba', 'diariojaen'],

  // Comunidad Valenciana
  'Valencia': ['levante', 'lasprovincias'],
  'Alicante': ['informacion'],
  'Castellón': ['levante'],
  'Castelló': ['levante'],
  'Comunidad Valenciana': ['levante', 'lasprovincias', 'informacion'],
  'Comunitat Valenciana': ['levante', 'lasprovincias', 'informacion'],

  // Aragón
  'Zaragoza': ['heraldo'],
  'Huesca': ['heraldo', 'diarioaltoaragon'],
  'Teruel': ['heraldo'],
  'Aragón': ['heraldo', 'diarioaltoaragon'],

  // Murcia
  'Murcia': ['laopinionmurcia', 'laverdad'],

  // Asturias
  'Asturias': ['lne', 'elcomercio'],
  'Oviedo': ['lne'],
  'Gijón': ['elcomercio'],

  // Cantabria
  'Cantabria': ['eldiariomontanes'],
  'Santander': ['eldiariomontanes'],

  // Castilla y León
  'Valladolid': ['nortecastilla'],
  'León': ['diariodeleon'],
  'Burgos': ['diariodeburgos'],
  'Salamanca': ['nortecastilla'],
  'Ávila': ['nortecastilla'],
  'Segovia': ['nortecastilla'],
  'Soria': ['nortecastilla'],
  'Zamora': ['nortecastilla'],
  'Palencia': ['nortecastilla'],
  'Castilla y León': ['nortecastilla', 'diariodeleon', 'diariodeburgos'],

  // La Rioja
  'La Rioja': ['larioja'],
  'Logroño': ['larioja'],

  // Navarra
  'Navarra': ['diariodenavarra', 'noticiasnavarra'],
  'Pamplona': ['diariodenavarra', 'noticiasnavarra'],

  // Extremadura
  'Extremadura': ['hoy', 'elperiodicoextremadura'],
  'Badajoz': ['hoy'],
  'Cáceres': ['hoy'],

  // Islas Baleares
  'Baleares': ['ultimahora', 'diariodemallorca'],
  'Islas Baleares': ['ultimahora', 'diariodemallorca'],
  'Mallorca': ['ultimahora', 'diariodemallorca'],
  'Palma': ['ultimahora', 'diariodemallorca'],
  'Ibiza': ['ultimahora'],
  'Menorca': ['ultimahora'],

  // Islas Canarias
  'Canarias': ['canarias7', 'laprovincia'],
  'Islas Canarias': ['canarias7', 'laprovincia'],
  'Las Palmas': ['laprovincia'],
  'Gran Canaria': ['laprovincia'],
  'Tenerife': ['canarias7'],
  'Santa Cruz de Tenerife': ['canarias7'],
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

  // --- LOCAL (Diarios Regionales - 40 fuentes) --- Solo 4 primeras activas por defecto
  // Galicia (4 fuentes)
  { id: 'vozgalicia', name: 'La Voz de Galicia', url: 'https://www.lavozdegalicia.es/rss/portada.xml', active: true, category: 'Local', region: 'Galicia' },
  { id: 'farodevigo', name: 'Faro de Vigo', url: 'https://www.farodevigo.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Galicia' },
  { id: 'laopinioncoruna', name: 'La Opinión A Coruña', url: 'https://www.laopinioncoruna.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Galicia' },
  { id: 'elprogreso', name: 'El Progreso (Lugo)', url: 'https://www.elprogreso.es/rss/', active: false, category: 'Local', region: 'Galicia' },

  // País Vasco (3 fuentes)
  { id: 'elcorreo', name: 'El Correo', url: 'https://www.elcorreo.com/rss/2.0/?section=portada', active: true, category: 'Local', region: 'País Vasco' },
  { id: 'diariovasco', name: 'El Diario Vasco', url: 'https://www.diariovasco.com/rss/2.0/?section=portada', active: false, category: 'Local', region: 'País Vasco' },
  { id: 'noticiasgipuzkoa', name: 'Noticias de Gipuzkoa', url: 'https://www.noticiasdegipuzkoa.eus/rss/2.0/?section=portada', active: false, category: 'Local', region: 'País Vasco' },

  // Cataluña (4 fuentes)
  { id: 'diaridebarcelona', name: 'Diari de Girona', url: 'https://www.diaridegirona.cat/rss/', active: false, category: 'Local', region: 'Cataluña' },
  { id: 'elperiodico', name: 'El Periódico', url: 'https://www.elperiodico.com/es/rss/rss_portada.xml', active: false, category: 'Local', region: 'Cataluña' },
  { id: 'regio7', name: 'Regió7 (Barcelona)', url: 'https://www.regio7.cat/rss/', active: false, category: 'Local', region: 'Cataluña' },
  { id: 'diaritarragona', name: 'Diari de Tarragona', url: 'https://www.diaridetarragona.com/rss/', active: false, category: 'Local', region: 'Cataluña' },

  // Madrid - Comunidad de Madrid (6 fuentes)
  { id: 'telemadrid', name: 'Telemadrid', url: 'https://www.telemadrid.es/rss/', active: true, category: 'Local', region: 'Madrid' },
  { id: 'madriddiario', name: 'Madrid Diario', url: 'https://www.madriddiario.es/rss', active: true, category: 'Local', region: 'Madrid' },
  { id: 'somosmadrid', name: 'Somos Madrid', url: 'https://www.somosmalasana.com/feed/', active: true, category: 'Local', region: 'Madrid' },
  { id: 'comunidad_madrid_news', name: 'Comunidad de Madrid (Noticias)', url: 'https://www.comunidad.madrid/rss-noticias', active: true, category: 'Local', region: 'Madrid' },
  { id: 'el_espanol_madrid', name: 'El Español - Madrid', url: 'https://www.elespanol.com/rss/madrid', active: true, category: 'Local', region: 'Madrid' },
  { id: 'abc_madrid', name: 'ABC Madrid', url: 'https://www.abc.es/rss/2.0/madrid/', active: false, category: 'Local', region: 'Madrid' },

  // Andalucía (5 fuentes)
  { id: 'diariosur', name: 'Diario Sur (Málaga)', url: 'https://www.diariosur.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Andalucía' },
  { id: 'diariodesevilla', name: 'Diario de Sevilla', url: 'https://www.diariodesevilla.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Andalucía' },
  { id: 'ideal', name: 'Ideal Granada', url: 'https://www.ideal.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Andalucía' },
  { id: 'diariocordoba', name: 'Diario Córdoba', url: 'https://www.diariocordoba.com/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Andalucía' },
  { id: 'diariojaen', name: 'Diario Jaén', url: 'https://www.diariojaen.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Andalucía' },

  // Comunidad Valenciana (3 fuentes)
  { id: 'levante', name: 'Levante-EMV', url: 'https://www.levante-emv.com/rss/2.0/?section=portada', active: true, category: 'Local', region: 'Valencia' },
  { id: 'lasprovincias', name: 'Las Provincias', url: 'https://www.lasprovincias.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Valencia' },
  { id: 'informacion', name: 'Información (Alicante)', url: 'https://www.diarioinformacion.com/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Valencia' },

  // Aragón (2 fuentes)
  { id: 'heraldo', name: 'Heraldo de Aragón', url: 'https://www.heraldo.es/rss/seccion/portada/', active: true, category: 'Local', region: 'Aragón' },
  { id: 'diarioaltoaragon', name: 'Diario del AltoAragón', url: 'https://www.diariodelaltoaragon.es/rss/', active: false, category: 'Local', region: 'Aragón' },

  // Murcia (2 fuentes)
  { id: 'laopinionmurcia', name: 'La Opinión de Murcia', url: 'https://www.laopiniondemurcia.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Murcia' },
  { id: 'laverdad', name: 'La Verdad (Murcia)', url: 'https://www.laverdad.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Murcia' },

  // Asturias (2 fuentes)
  { id: 'lne', name: 'La Nueva España', url: 'https://www.lne.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Asturias' },
  { id: 'elcomercio', name: 'El Comercio (Asturias)', url: 'https://www.elcomercio.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Asturias' },

  // Cantabria (1 fuente)
  { id: 'eldiariomontanes', name: 'El Diario Montañés', url: 'https://www.eldiariomontanes.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Cantabria' },

  // Castilla y León (3 fuentes)
  { id: 'nortecastilla', name: 'El Norte de Castilla', url: 'https://www.elnortedecastilla.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Castilla y León' },
  { id: 'diariodeleon', name: 'Diario de León', url: 'https://www.diariodeleon.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Castilla y León' },
  { id: 'diariodeburgos', name: 'Diario de Burgos', url: 'https://www.diariodeburgos.es/rss/', active: false, category: 'Local', region: 'Castilla y León' },

  // La Rioja (1 fuente)
  { id: 'larioja', name: 'La Rioja', url: 'https://www.larioja.com/rss/2.0/?section=portada', active: false, category: 'Local', region: 'La Rioja' },

  // Navarra (2 fuentes)
  { id: 'diariodenavarra', name: 'Diario de Navarra', url: 'https://www.diariodenavarra.es/rss/', active: false, category: 'Local', region: 'Navarra' },
  { id: 'noticiasnavarra', name: 'Noticias de Navarra', url: 'https://www.noticiasdenavarra.com/rss/', active: false, category: 'Local', region: 'Navarra' },

  // Extremadura (2 fuentes)
  { id: 'hoy', name: 'Hoy (Extremadura)', url: 'https://www.hoy.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Extremadura' },
  { id: 'elperiodicoextremadura', name: 'El Periódico Extremadura', url: 'https://www.elperiodicoextremadura.com/rss/', active: false, category: 'Local', region: 'Extremadura' },

  // Islas Baleares (2 fuentes)
  { id: 'ultimahora', name: 'Última Hora (Mallorca)', url: 'https://www.ultimahora.es/rss/', active: false, category: 'Local', region: 'Baleares' },
  { id: 'diariodemallorca', name: 'Diario de Mallorca', url: 'https://www.diariodemallorca.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Baleares' },

  // Islas Canarias (2 fuentes)
  { id: 'canarias7', name: 'Canarias7', url: 'https://www.canarias7.es/rss/', active: false, category: 'Local', region: 'Canarias' },
  { id: 'laprovincia', name: 'La Provincia (Las Palmas)', url: 'https://www.laprovincia.es/rss/2.0/?section=portada', active: false, category: 'Local', region: 'Canarias' },
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

  // Sprint 32: Estado para descubrimiento automático de fuentes locales
  const [isDiscoveringLocal, setIsDiscoveringLocal] = useState(false);
  const [discoveredSources, setDiscoveredSources] = useState<DiscoveredLocalSource[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<number>>(new Set());

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

  /**
   * Sprint 32: Descubrir fuentes locales automáticamente con Gemini
   */
  const handleDiscoverLocal = async () => {
    if (!profile?.location) {
      alert('Configura tu ubicación en el perfil primero');
      return;
    }

    setIsDiscoveringLocal(true);
    setDiscoveredSources([]);
    setSelectedDiscovered(new Set());

    try {
      const locationParts = profile.location.split(',').map(p => p.trim());
      const city = locationParts[0]; // "Mostoles, Madrid" -> "Mostoles"
      const province = locationParts[1]; // "Mostoles, Madrid" -> "Madrid"

      console.log(`[SourcesDrawer] 🔍 Discovering local sources for "${city}" (province: "${province ?? 'none'}")`);

      // Buscar primero por ciudad específica
      let discovered = await discoverLocalSources(city, 10);

      // Si la ciudad devuelve pocos resultados (<3) y hay provincia, intentar por provincia
      if (discovered.length < 3 && province) {
        console.log(`[SourcesDrawer] ⚠️ Few results for "${city}" (${discovered.length}), falling back to province: "${province}"`);
        const provinceResults = await discoverLocalSources(province, 10);

        // Combinar resultados, evitando duplicados por nombre
        const existingNames = new Set(discovered.map(d => d.name.toLowerCase()));
        const uniqueProvince = provinceResults.filter(d => !existingNames.has(d.name.toLowerCase()));
        discovered = [...discovered, ...uniqueProvince];

        console.log(`[SourcesDrawer] ✅ Combined: ${discovered.length} sources (city + province)`);
      }

      console.log(`[SourcesDrawer] ✅ Found ${discovered.length} sources`);
      setDiscoveredSources(discovered);

      if (discovered.length === 0) {
        alert(`No se encontraron fuentes locales para ${city}${province ? ` ni para ${province}` : ''}. Intenta con el buscador manual.`);
      }
    } catch (error) {
      console.error('[SourcesDrawer] Error discovering local sources:', error);
      alert(`Error al buscar fuentes: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsDiscoveringLocal(false);
    }
  };

  /**
   * Sprint 32: Añadir fuentes descubiertas seleccionadas
   */
  const handleAddDiscovered = () => {
    const toAdd = Array.from(selectedDiscovered).map(index => {
      const discovered = discoveredSources[index];
      return {
        id: discovered.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name: discovered.name,
        url: discovered.rssUrl,
        category: 'Local',
        active: true,
        region: discovered.region,
      } as RssSource;
    });

    // Evitar duplicados
    const existingIds = new Set(sources.map(s => s.id));
    const newSources = toAdd.filter(s => !existingIds.has(s.id));

    if (newSources.length === 0) {
      alert('Todas las fuentes seleccionadas ya están añadidas');
      return;
    }

    setSources([...sources, ...newSources]);
    alert(`✅ ${newSources.length} fuentes añadidas correctamente`);

    // Reset discovery state
    setDiscoveredSources([]);
    setSelectedDiscovered(new Set());
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        <h3 className="font-semibold text-sm">
                          Recomendadas para {profile.location.split(',')[0]} ({recommendedSources.length})
                        </h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDiscoverLocal}
                        disabled={isDiscoveringLocal}
                        className="gap-1"
                      >
                        {isDiscoveringLocal ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          <>
                            <Search className="size-3" />
                            Buscar más
                          </>
                        )}
                      </Button>
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

            {/* Sprint 32: Resultados del descubrimiento automático */}
            {discoveredSources.length > 0 && selectedCategory === 'Local' && (
              <div className="space-y-2 border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    Fuentes encontradas ({discoveredSources.length})
                  </h3>
                  <Button
                    size="sm"
                    onClick={handleAddDiscovered}
                    disabled={selectedDiscovered.size === 0}
                  >
                    Añadir {selectedDiscovered.size > 0 ? `${selectedDiscovered.size} ` : ''}seleccionadas
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecciona las fuentes que deseas añadir a tu lista
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {discoveredSources.map((discovered, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 border rounded-lg bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      onClick={() => {
                        const newSelected = new Set(selectedDiscovered);
                        if (newSelected.has(index)) {
                          newSelected.delete(index);
                        } else {
                          newSelected.add(index);
                        }
                        setSelectedDiscovered(newSelected);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDiscovered.has(index)}
                        onChange={() => {}} // Handled by div onClick
                        className="mt-1 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{discovered.name}</p>
                          <Badge variant="secondary" className="text-xs">Local</Badge>
                          {discovered.verified && (
                            <Badge variant="outline" className="text-xs text-green-600">✓ Verificado</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{discovered.rssUrl}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
