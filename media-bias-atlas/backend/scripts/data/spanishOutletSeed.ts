import { ManualCountrySeed, ManualOutletSeed } from './manualOutletSeedTypes';

export const SPAIN_COUNTRY_SEED = {
  code: 'ES',
  name: 'España',
} as const;

export const spanishOutletSeeds: ManualOutletSeed[] = [
  {
    name: 'El País',
    websiteUrl: 'https://elpais.com',
    description: 'Diario generalista español con cobertura nacional e internacional.',
    feeds: [
      {
        label: 'Portada',
        category: 'portada',
        url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
        rationale: 'Feed oficial de portada desde la página RSS de EL PAÍS.',
      },
      {
        label: 'España',
        category: 'espana',
        url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada',
        rationale: 'Feed oficial de la sección España, útil para política y actualidad nacional.',
      },
    ],
  },
  {
    name: 'El Mundo',
    websiteUrl: 'https://www.elmundo.es',
    description: 'Diario generalista español con foco en actualidad, política y España.',
    feeds: [
      {
        label: 'Portada',
        category: 'portada',
        url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml',
        rationale: 'Feed de portada estable servido por la infraestructura oficial de El Mundo.',
      },
      {
        label: 'España',
        category: 'espana',
        url: 'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml',
        rationale: 'Feed estable de la sección España para actualidad política y nacional.',
      },
    ],
  },
  {
    name: 'ABC',
    websiteUrl: 'https://www.abc.es',
    description: 'Diario generalista español con cobertura nacional, política e internacional.',
    feeds: [
      {
        label: 'Últimas',
        category: 'ultimas',
        url: 'https://www.abc.es/rss/feeds/abc_ultima.xml',
        rationale: 'Feed oficial de última hora desde la página RSS de ABC.',
      },
      {
        label: 'España',
        category: 'espana',
        url: 'https://www.abc.es/rss/feeds/abc_EspanaEspana.xml',
        rationale: 'Feed oficial de España para reforzar cobertura política y nacional.',
      },
    ],
  },
  {
    name: 'La Vanguardia',
    websiteUrl: 'https://www.lavanguardia.com',
    description: 'Diario generalista español con cobertura de actualidad, política y sociedad.',
    feeds: [
      {
        label: 'Portada',
        category: 'portada',
        url: 'https://www.lavanguardia.com/rss/home.xml',
        rationale: 'Feed oficial de portada.',
      },
      {
        label: 'Política',
        category: 'politica',
        url: 'https://www.lavanguardia.com/rss/politica.xml',
        rationale: 'Feed oficial de política para reforzar artículos ideológicos relevantes.',
      },
    ],
  },
  {
    name: '20 Minutos',
    websiteUrl: 'https://www.20minutos.es',
    description: 'Diario digital generalista con fuerte volumen de última hora.',
    feeds: [
      {
        label: 'Lo último',
        category: 'ultimas',
        url: 'https://www.20minutos.es/rss/',
        rationale: 'Feed principal de últimas noticias, estable y con alta cadencia.',
      },
      {
        label: 'Nacional',
        category: 'nacional',
        url: 'https://www.20minutos.es/rss/nacional/',
        rationale: 'Feed nacional para centrar la carga inicial en actualidad española.',
      },
    ],
  },
  {
    name: 'elDiario.es',
    websiteUrl: 'https://www.eldiario.es',
    description: 'Diario digital español con cobertura política y social.',
    feeds: [
      {
        label: 'Portada',
        category: 'portada',
        url: 'https://www.eldiario.es/rss/',
        rationale: 'Feed principal oficial de portada.',
      },
      {
        label: 'Política',
        category: 'politica',
        url: 'https://www.eldiario.es/rss/politica/',
        rationale: 'Feed oficial de política para reforzar el análisis ideológico.',
      },
    ],
  },
  {
    name: 'El Confidencial',
    websiteUrl: 'https://www.elconfidencial.com',
    description: 'Diario digital español con cobertura de España, mundo y economía.',
    feeds: [
      {
        label: 'España',
        category: 'espana',
        url: 'https://rss.elconfidencial.com/espana/',
        rationale: 'Feed oficial desde la página RSS de El Confidencial.',
      },
      {
        label: 'Mundo',
        category: 'mundo',
        url: 'https://rss.elconfidencial.com/mundo/',
        rationale: 'Feed oficial de actualidad internacional.',
      },
    ],
  },
  {
    name: 'Europa Press',
    websiteUrl: 'https://www.europapress.es',
    description: 'Agencia de noticias española con cobertura continua de actualidad.',
    feeds: [
      {
        label: 'Portada',
        category: 'portada',
        url: 'https://www.europapress.es/rss/rss.aspx',
        rationale: 'Feed general estable de portada.',
      },
      {
        label: 'Nacional',
        category: 'nacional',
        url: 'https://www.europapress.es/rss/rss.aspx?ch=00066',
        rationale: 'Feed nacional estable y útil para actualidad española.',
      },
    ],
  },
  {
    name: 'Cinco Días',
    websiteUrl: 'https://cincodias.elpais.com',
    description: 'Medio económico español del grupo PRISA.',
    feeds: [
      {
        label: 'Últimas',
        category: 'ultimas',
        url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/section/ultimas-noticias/portada',
        rationale: 'Feed oficial de últimas noticias desde la página RSS de Cinco Días.',
      },
      {
        label: 'Economía',
        category: 'economia',
        url: 'https://feeds.elpais.com/mrss-s/list/ep/site/cincodias.elpais.com/section/economia',
        rationale: 'Feed estable de economía para una demo con mayor densidad temática.',
      },
    ],
  },
];

export const pendingSpanishOutletSeeds = [
  {
    name: 'Público',
    reason:
      'No se ha encontrado un feed RSS oficial o estable verificable en esta fase. Se deja pendiente de revisión manual.',
  },
];

export const spainManualCountrySeed: ManualCountrySeed = {
  country: SPAIN_COUNTRY_SEED,
  outlets: spanishOutletSeeds,
  pending: pendingSpanishOutletSeeds,
};
