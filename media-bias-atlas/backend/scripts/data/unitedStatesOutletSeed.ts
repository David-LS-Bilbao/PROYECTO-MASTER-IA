import { ManualCountrySeed } from './manualOutletSeedTypes';

export const unitedStatesManualCountrySeed: ManualCountrySeed = {
  country: {
    code: 'US',
    name: 'Estados Unidos',
  },
  outlets: [
    {
      name: 'The New York Times',
      websiteUrl: 'https://www.nytimes.com',
      description: 'Diario estadounidense generalista con feeds oficiales de política y noticias nacionales.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
          rationale: 'Feed oficial de política de The New York Times.',
        },
        {
          label: 'U.S.',
          category: 'us',
          url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
          rationale: 'Feed oficial de noticias nacionales de EE. UU.',
        },
      ],
    },
    {
      name: 'The Washington Post',
      websiteUrl: 'https://www.washingtonpost.com',
      description: 'Diario estadounidense con feeds oficiales de política y nacional.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://feeds.washingtonpost.com/rss/politics',
          rationale: 'Feed oficial de política de The Washington Post.',
        },
        {
          label: 'National',
          category: 'national',
          url: 'https://feeds.washingtonpost.com/rss/national',
          rationale: 'Feed oficial de noticias nacionales.',
        },
      ],
    },
    {
      name: 'NPR',
      websiteUrl: 'https://www.npr.org',
      description: 'Servicio público estadounidense con cobertura política y nacional muy estable.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://feeds.npr.org/1014/rss.xml',
          rationale: 'Feed oficial de Politics de NPR.',
        },
        {
          label: 'National',
          category: 'national',
          url: 'https://feeds.npr.org/1003/rss.xml',
          rationale: 'Feed oficial de National de NPR.',
        },
      ],
    },
    {
      name: 'Fox News',
      websiteUrl: 'https://www.foxnews.com',
      description: 'Canal estadounidense con feeds públicos estables de política y noticias de EE. UU.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://moxie.foxnews.com/google-publisher/politics.xml',
          rationale: 'Feed público de política de Fox News.',
        },
        {
          label: 'U.S.',
          category: 'us',
          url: 'https://moxie.foxnews.com/google-publisher/us.xml',
          rationale: 'Feed público de noticias nacionales de EE. UU.',
        },
      ],
    },
    {
      name: 'CNN',
      websiteUrl: 'https://www.cnn.com',
      description: 'Canal estadounidense con feeds RSS clásicos de política y noticias nacionales.',
      feeds: [
        {
          label: 'All Politics',
          category: 'politics',
          url: 'http://rss.cnn.com/rss/cnn_allpolitics.rss',
          rationale: 'Feed RSS clásico de política de CNN.',
        },
        {
          label: 'U.S.',
          category: 'us',
          url: 'http://rss.cnn.com/rss/cnn_us.rss',
          rationale: 'Feed RSS clásico de noticias de EE. UU.',
        },
      ],
    },
    {
      name: 'ABC News',
      websiteUrl: 'https://abcnews.go.com',
      description: 'Servicio informativo estadounidense con página oficial de RSS y feeds públicos por sección.',
      feeds: [
        {
          label: 'Politics Headlines',
          category: 'politics',
          url: 'https://feeds.abcnews.com/abcnews/politicsheadlines',
          rationale: 'Feed oficial de política indicado en la página RSS de ABC News.',
        },
        {
          label: 'U.S. Headlines',
          category: 'us',
          url: 'https://feeds.abcnews.com/abcnews/usheadlines',
          rationale: 'Feed oficial de U.S. indicado en la misma página RSS.',
        },
      ],
    },
    {
      name: 'CBS News',
      websiteUrl: 'https://www.cbsnews.com',
      description: 'Medio estadounidense con feeds RSS públicos de política y noticias nacionales.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://www.cbsnews.com/latest/rss/politics',
          rationale: 'Feed RSS público de política de CBS News.',
        },
        {
          label: 'U.S.',
          category: 'us',
          url: 'https://www.cbsnews.com/latest/rss/us',
          rationale: 'Feed RSS público de noticias nacionales de CBS News.',
        },
      ],
    },
    {
      name: 'Politico',
      websiteUrl: 'https://www.politico.com',
      description: 'Medio político estadounidense con feeds estables de política y Congreso.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://rss.politico.com/politics-news.xml',
          rationale: 'Feed público y validado de Politics de Politico.',
        },
        {
          label: 'Congress',
          category: 'congress',
          url: 'https://rss.politico.com/congress.xml',
          rationale: 'Feed público y validado de Congress, útil para reforzar la capa institucional del atlas.',
        },
      ],
    },
    {
      name: 'NBC News',
      websiteUrl: 'https://www.nbcnews.com',
      description: 'Servicio informativo estadounidense con feeds validados de política y noticias nacionales.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://feeds.nbcnews.com/nbcnews/public/politics',
          rationale: 'Feed público y validado de política de NBC News.',
        },
        {
          label: 'U.S.',
          category: 'us',
          url: 'https://feeds.nbcnews.com/nbcnews/public/us-news',
          rationale: 'Feed público y validado de noticias nacionales de NBC News.',
        },
      ],
    },
  ],
  pending: [
    {
      name: 'The Wall Street Journal',
      reason: 'El feed de política validado devuelve 403; se deja fuera por ahora para no meter una configuración parcial o inestable.',
    },
    {
      name: 'Associated Press',
      reason: 'No se ha fijado aún un feed RSS oficial y estable de política o nacional verificable para una seed reproducible.',
    },
    {
      name: 'USA Today',
      reason: 'Los feeds generales son demasiado amplios para esta fase y no se ha fijado aún una combinación política/nacional suficientemente fiable.',
    },
    {
      name: 'Reuters',
      reason: 'Los feeds públicos candidatos no se han incorporado aún porque conviene validar mejor su estabilidad y segmentación temática.',
    },
  ],
};
