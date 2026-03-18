import { franceManualCountrySeed } from './franceOutletSeed';
import { germanyManualCountrySeed } from './germanyOutletSeed';
import { spainManualCountrySeed } from './spanishOutletSeed';
import { ManualCountrySeed } from './manualOutletSeedTypes';
import { unitedKingdomManualCountrySeed } from './unitedKingdomOutletSeed';
import { unitedStatesManualCountrySeed } from './unitedStatesOutletSeed';

export const manualOutletSeedCatalog: Record<string, ManualCountrySeed> = {
  [spainManualCountrySeed.country.code]: spainManualCountrySeed,
  [unitedKingdomManualCountrySeed.country.code]: unitedKingdomManualCountrySeed,
  [franceManualCountrySeed.country.code]: franceManualCountrySeed,
  [germanyManualCountrySeed.country.code]: germanyManualCountrySeed,
  [unitedStatesManualCountrySeed.country.code]: unitedStatesManualCountrySeed,
};
