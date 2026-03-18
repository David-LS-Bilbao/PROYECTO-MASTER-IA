import { ManualCountrySeed } from './manualOutletSeedTypes';

export const germanyManualCountrySeed: ManualCountrySeed = {
  country: {
    code: 'DE',
    name: 'Alemania',
  },
  outlets: [
    {
      name: 'DER SPIEGEL',
      websiteUrl: 'https://www.spiegel.de',
      description: 'Medio alemán generalista con feeds claros de política y extranjero.',
      feeds: [
        {
          label: 'Politik',
          category: 'politik',
          url: 'https://www.spiegel.de/politik/index.rss',
          rationale: 'Feed oficial de política de DER SPIEGEL.',
        },
        {
          label: 'Ausland',
          category: 'ausland',
          url: 'https://www.spiegel.de/ausland/index.rss',
          rationale: 'Feed oficial de internacional/extranjero.',
        },
      ],
    },
    {
      name: 'FAZ',
      websiteUrl: 'https://www.faz.net',
      description: 'Diario alemán con RSS estables de política y exterior.',
      feeds: [
        {
          label: 'Politik',
          category: 'politik',
          url: 'https://www.faz.net/rss/aktuell/politik/',
          rationale: 'Feed oficial de política.',
        },
        {
          label: 'Ausland',
          category: 'ausland',
          url: 'https://www.faz.net/rss/aktuell/politik/ausland/',
          rationale: 'Feed oficial de política exterior.',
        },
      ],
    },
    {
      name: 'WELT',
      websiteUrl: 'https://www.welt.de',
      description: 'Diario alemán con feeds válidos de política y extranjero.',
      feeds: [
        {
          label: 'Politik',
          category: 'politik',
          url: 'https://www.welt.de/politik/?service=Rss',
          rationale: 'Feed oficial de política de WELT.',
        },
        {
          label: 'Ausland',
          category: 'ausland',
          url: 'https://www.welt.de/politik/ausland/?service=Rss',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'Sueddeutsche Zeitung',
      websiteUrl: 'https://www.sueddeutsche.de',
      description: 'Diario alemán con cobertura política y feed general de top temas.',
      feeds: [
        {
          label: 'Politik',
          category: 'politik',
          url: 'https://rss.sueddeutsche.de/rss/Politik',
          rationale: 'Feed oficial de política.',
        },
        {
          label: 'Topthemen',
          category: 'topthemen',
          url: 'https://rss.sueddeutsche.de/rss/Topthemen',
          rationale: 'Feed oficial de top temas, elegido al no disponer de un segundo feed político/internacional claro y válido.',
        },
      ],
    },
    {
      name: 'tagesschau',
      websiteUrl: 'https://www.tagesschau.de',
      description: 'Servicio informativo alemán con feeds claros de interior y exterior.',
      feeds: [
        {
          label: 'Inland',
          category: 'inland',
          url: 'https://www.tagesschau.de/xml/rss2',
          rationale: 'Feed oficial principal de noticias alemanas.',
        },
        {
          label: 'Ausland',
          category: 'ausland',
          url: 'https://www.tagesschau.de/ausland/index~rss2.xml',
          rationale: 'Feed oficial de internacional.',
        },
      ],
    },
    {
      name: 'ZEIT ONLINE',
      websiteUrl: 'https://www.zeit.de',
      description: 'Diario digital alemán con feeds válidos de política y Alemania.',
      feeds: [
        {
          label: 'Politik',
          category: 'politik',
          url: 'https://newsfeed.zeit.de/politik/index',
          rationale: 'Feed oficial de política.',
        },
        {
          label: 'Deutschland',
          category: 'deutschland',
          url: 'https://newsfeed.zeit.de/index',
          rationale: 'Feed general del medio, aceptado como cobertura nacional cuando no hay un segundo feed más específico validado.',
        },
      ],
    },
    {
      name: 'Deutsche Welle',
      websiteUrl: 'https://www.dw.com/de/',
      description: 'Medio internacional alemán con feeds válidos de portada y Alemania.',
      feeds: [
        {
          label: 'Top',
          category: 'top',
          url: 'https://rss.dw.com/rdf/rss-de-top',
          rationale: 'Feed oficial principal en alemán.',
        },
        {
          label: 'Deutschland',
          category: 'deutschland',
          url: 'https://rss.dw.com/rdf/rss-de-deutschland',
          rationale: 'Feed oficial de Alemania, válido y más específico que otras URLs probadas.',
        },
      ],
    },
    {
      name: 'n-tv',
      websiteUrl: 'https://www.n-tv.de',
      description: 'Canal alemán de noticias con feed válido y temáticamente político.',
      feeds: [
        {
          label: 'Politik',
          category: 'politik',
          url: 'https://www.n-tv.de/politik/rss',
          rationale: 'Feed oficial de política de n-tv.',
        },
      ],
    },
  ],
  pending: [
    {
      name: 'Handelsblatt',
      reason: 'El feed general valida, pero los feeds políticos probados no son consistentes ni claramente parseables. Se deja fuera por ahora.',
    },
    {
      name: 'taz',
      reason: 'Las URLs probadas responden, pero los títulos/categorías resultantes no son suficientemente claros para una seed fiable.',
    },
    {
      name: 'Frankfurter Rundschau',
      reason: 'Los feeds probados devuelven 404.',
    },
    {
      name: 'Focus',
      reason: 'El feed probado devuelve 404.',
    },
  ],
};
