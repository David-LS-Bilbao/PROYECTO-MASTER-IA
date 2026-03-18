import { ManualCountrySeed } from './manualOutletSeedTypes';

export const franceManualCountrySeed: ManualCountrySeed = {
  country: {
    code: 'FR',
    name: 'Francia',
  },
  outlets: [
    {
      name: 'Le Monde',
      websiteUrl: 'https://www.lemonde.fr',
      description: 'Diario francés generalista con fuerte cobertura política e internacional.',
      feeds: [
        {
          label: 'Politique',
          category: 'politique',
          url: 'https://www.lemonde.fr/politique/rss_full.xml',
          rationale: 'Feed oficial de política de Le Monde.',
        },
        {
          label: 'International',
          category: 'international',
          url: 'https://www.lemonde.fr/international/rss_full.xml',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'Le Figaro',
      websiteUrl: 'https://www.lefigaro.fr',
      description: 'Diario francés generalista con secciones estables de política e internacional.',
      feeds: [
        {
          label: 'Politique',
          category: 'politique',
          url: 'https://www.lefigaro.fr/rss/figaro_politique.xml',
          rationale: 'Feed oficial de política de Le Figaro.',
        },
        {
          label: 'International',
          category: 'international',
          url: 'https://www.lefigaro.fr/rss/figaro_international.xml',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'France 24',
      websiteUrl: 'https://www.france24.com/fr/',
      description: 'Canal internacional francés con cobertura de Francia y Europa.',
      feeds: [
        {
          label: 'France',
          category: 'france',
          url: 'https://www.france24.com/fr/france/rss',
          rationale: 'Feed oficial de actualidad francesa.',
        },
        {
          label: 'Europe',
          category: 'europe',
          url: 'https://www.france24.com/fr/europe/rss',
          rationale: 'Feed oficial europeo como alternativa estable al internacional general.',
        },
      ],
    },
    {
      name: '20 Minutes France',
      websiteUrl: 'https://www.20minutes.fr',
      description: 'Diario digital francés con alta cadencia y feed específico de política.',
      feeds: [
        {
          label: 'Politique',
          category: 'politique',
          url: 'https://www.20minutes.fr/feeds/rss-politique.xml',
          rationale: 'Feed oficial de política.',
        },
        {
          label: 'Une',
          category: 'une',
          url: 'https://www.20minutes.fr/feeds/rss-une.xml',
          rationale: 'Feed principal útil para mantener una capa mínima de actualidad nacional.',
        },
      ],
    },
    {
      name: 'Le Parisien',
      websiteUrl: 'https://www.leparisien.fr',
      description: 'Diario francés con feeds claros de política e internacional.',
      feeds: [
        {
          label: 'Politique',
          category: 'politique',
          url: 'https://feeds.leparisien.fr/leparisien/rss/politique',
          rationale: 'Feed oficial de política.',
        },
        {
          label: 'International',
          category: 'international',
          url: 'https://feeds.leparisien.fr/leparisien/rss/international',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'franceinfo',
      websiteUrl: 'https://www.francetvinfo.fr',
      description: 'Servicio informativo francés con buena segmentación política y mundial.',
      feeds: [
        {
          label: 'Politique',
          category: 'politique',
          url: 'https://www.francetvinfo.fr/politique.rss',
          rationale: 'Feed oficial de política de franceinfo.',
        },
        {
          label: 'Monde',
          category: 'monde',
          url: 'https://www.francetvinfo.fr/monde.rss',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'RFI',
      websiteUrl: 'https://www.rfi.fr/fr',
      description: 'Medio francés de radio e internacional con feeds estables de Francia y mundo.',
      feeds: [
        {
          label: 'France',
          category: 'france',
          url: 'https://www.rfi.fr/fr/france/rss',
          rationale: 'Feed oficial de actualidad francesa.',
        },
        {
          label: 'Monde',
          category: 'monde',
          url: 'https://www.rfi.fr/fr/monde/rss',
          rationale: 'Feed oficial de actualidad internacional.',
        },
      ],
    },
    {
      name: 'Libération',
      websiteUrl: 'https://www.liberation.fr',
      description: 'Diario francés con feeds RSS válidos vía Arc para política e internacional.',
      feeds: [
        {
          label: 'Politique',
          category: 'politique',
          url: 'https://www.liberation.fr/arc/outboundfeeds/rss/category/politique/?outputType=xml',
          rationale: 'Feed oficial de política servido por la infraestructura RSS del medio.',
        },
        {
          label: 'International',
          category: 'international',
          url: 'https://www.liberation.fr/arc/outboundfeeds/rss/category/international/?outputType=xml',
          rationale: 'Feed oficial de internacional servido por la misma infraestructura.',
        },
      ],
    },
  ],
  pending: [
    {
      name: 'Ouest-France',
      reason: 'Los feeds probados devuelven 404/403 y no ofrecen una URL reproducible en esta fase.',
    },
    {
      name: 'Les Echos',
      reason: 'Los feeds probados devuelven 403 en la validación automática.',
    },
    {
      name: 'BFMTV',
      reason: 'Los endpoints RSS probados devuelven 400 y no se consideran estables por ahora.',
    },
    {
      name: 'Challenges',
      reason: 'El feed de política probado devuelve 404.',
    },
    {
      name: 'La Tribune',
      reason: 'El feed económico probado devuelve 404 y se deja fuera.',
    },
  ],
};
