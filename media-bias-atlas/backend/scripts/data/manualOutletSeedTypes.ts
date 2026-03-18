export interface ManualRssFeedSeed {
  label: string;
  category: string;
  url: string;
  rationale: string;
}

export interface ManualOutletSeed {
  name: string;
  websiteUrl: string;
  description: string;
  feeds: ManualRssFeedSeed[];
}

export interface PendingManualOutletSeed {
  name: string;
  reason: string;
}

export interface ManualCountrySeed {
  country: {
    code: string;
    name: string;
  };
  outlets: ManualOutletSeed[];
  pending: PendingManualOutletSeed[];
}
