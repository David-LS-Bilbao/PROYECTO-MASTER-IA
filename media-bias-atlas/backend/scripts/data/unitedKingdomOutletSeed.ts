import { ManualCountrySeed } from './manualOutletSeedTypes';

export const unitedKingdomManualCountrySeed: ManualCountrySeed = {
  country: {
    code: 'GB',
    name: 'Reino Unido',
  },
  outlets: [
    {
      name: 'BBC News',
      websiteUrl: 'https://www.bbc.co.uk/news',
      description: 'Servicio informativo generalista de la BBC con fuerte cobertura política y nacional.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
          rationale: 'Feed oficial de política de BBC News.',
        },
        {
          label: 'UK',
          category: 'uk',
          url: 'https://feeds.bbci.co.uk/news/uk/rss.xml',
          rationale: 'Feed oficial de actualidad nacional del Reino Unido.',
        },
      ],
    },
    {
      name: 'The Guardian',
      websiteUrl: 'https://www.theguardian.com',
      description: 'Diario británico con cobertura política, nacional e internacional.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://www.theguardian.com/politics/rss',
          rationale: 'Feed oficial de política de The Guardian.',
        },
        {
          label: 'World',
          category: 'world',
          url: 'https://www.theguardian.com/world/rss',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'Sky News',
      websiteUrl: 'https://news.sky.com',
      description: 'Canal británico de noticias con cobertura de política y Reino Unido.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://feeds.skynews.com/feeds/rss/politics.xml',
          rationale: 'Feed oficial de política de Sky News.',
        },
        {
          label: 'UK',
          category: 'uk',
          url: 'https://feeds.skynews.com/feeds/rss/uk.xml',
          rationale: 'Feed oficial de noticias del Reino Unido.',
        },
      ],
    },
    {
      name: 'The Independent',
      websiteUrl: 'https://www.independent.co.uk',
      description: 'Diario digital británico con cobertura de política y actualidad nacional.',
      feeds: [
        {
          label: 'UK Politics',
          category: 'uk-politics',
          url: 'https://www.independent.co.uk/news/uk/politics/rss',
          rationale: 'Feed oficial de UK Politics.',
        },
        {
          label: 'UK',
          category: 'uk',
          url: 'https://www.independent.co.uk/news/uk/rss',
          rationale: 'Feed oficial de actualidad nacional.',
        },
      ],
    },
    {
      name: 'Financial Times',
      websiteUrl: 'https://www.ft.com',
      description: 'Diario británico de información económica y política internacional.',
      feeds: [
        {
          label: 'UK',
          category: 'uk',
          url: 'https://www.ft.com/uk?format=rss',
          rationale: 'Feed oficial de la sección UK.',
        },
        {
          label: 'World',
          category: 'world',
          url: 'https://www.ft.com/world?format=rss',
          rationale: 'Feed oficial de la sección World.',
        },
      ],
    },
    {
      name: 'Metro',
      websiteUrl: 'https://metro.co.uk',
      description: 'Medio británico digital con cobertura política y nacional de alta cadencia.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://metro.co.uk/news/politics/feed/',
          rationale: 'Feed oficial de política de Metro.',
        },
        {
          label: 'UK',
          category: 'uk',
          url: 'https://metro.co.uk/news/uk/feed/',
          rationale: 'Feed oficial de noticias UK.',
        },
      ],
    },
    {
      name: 'Daily Mirror',
      websiteUrl: 'https://www.mirror.co.uk',
      description: 'Tabloide británico con secciones claras de política y UK news.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://www.mirror.co.uk/news/politics/rss.xml',
          rationale: 'Feed oficial de política de Mirror.',
        },
        {
          label: 'UK News',
          category: 'uk',
          url: 'https://www.mirror.co.uk/news/uk-news/rss.xml',
          rationale: 'Feed oficial de UK News.',
        },
      ],
    },
    {
      name: 'The Standard',
      websiteUrl: 'https://www.standard.co.uk',
      description: 'Medio británico con cobertura política y de noticias nacionales.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://www.standard.co.uk/news/politics/rss',
          rationale: 'Feed oficial de política de The Standard.',
        },
        {
          label: 'News',
          category: 'news',
          url: 'https://www.standard.co.uk/news/rss',
          rationale: 'Feed oficial de noticias generales, útil para el tramo nacional.',
        },
      ],
    },
    {
      name: 'The i Paper',
      websiteUrl: 'https://inews.co.uk',
      description: 'Diario digital británico con cobertura política y de actualidad.',
      feeds: [
        {
          label: 'Politics',
          category: 'politics',
          url: 'https://inews.co.uk/category/news/politics/feed',
          rationale: 'Feed oficial de política.',
        },
        {
          label: 'News',
          category: 'news',
          url: 'https://inews.co.uk/category/news/feed',
          rationale: 'Feed oficial de noticias nacionales.',
        },
      ],
    },
  ],
  pending: [
    {
      name: 'The Telegraph',
      reason: 'Los feeds devuelven 403 y no son estables para una carga reproducible desde local.',
    },
    {
      name: 'Reuters',
      reason: 'Los feeds clásicos en feeds.reuters.com no resuelven correctamente en la validación actual.',
    },
    {
      name: 'Express',
      reason: 'La URL de política validada devuelve un feed etiquetado como celebrity news; se descarta por inconsistencia.',
    },
    {
      name: 'New Statesman',
      reason: 'El feed general responde, pero se deja fuera en esta fase por ser demasiado amplio frente a opciones más específicas.',
    },
  ],
};
