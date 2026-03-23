import { prisma } from '../database/prismaClient';
import { createModuleLogger } from '../logger/logger';
import { AIObservabilityService } from './ai-observability.service';
import { PromptRegistryService } from './prompt-registry.service';
import { TokenAndCostService } from './token-and-cost.service';

const logger = createModuleLogger('MBAObservabilityBootstrap');

export const aiObservabilityService = new AIObservabilityService(prisma);
export const promptRegistryService = new PromptRegistryService(prisma);
export const tokenAndCostService = new TokenAndCostService(prisma);

void tokenAndCostService.ensureDefaultPricingCatalog().catch((error) => {
  logger.warn(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    'Could not ensure default AI pricing catalog for MBA'
  );
});
