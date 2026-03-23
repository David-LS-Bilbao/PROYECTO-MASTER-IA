import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { createModuleLogger } from '../logger/logger';

const logger = createModuleLogger('PromptRegistryService');

export interface RegisterPromptVersionInput {
  module: string;
  promptKey: string;
  version: string;
  template: string;
  sourceFile: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export class PromptRegistryService {
  private readonly cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaClient) {}

  async registerPromptVersion(input: RegisterPromptVersionInput): Promise<{
    id: string;
    templateHash: string;
  }> {
    const templateHash = this.computeTemplateHash(input.template);
    const cacheKey = this.buildCacheKey(input.module, input.promptKey, input.version, templateHash);
    const cachedPromptVersionId = this.cache.get(cacheKey);

    if (cachedPromptVersionId) {
      return {
        id: cachedPromptVersionId,
        templateHash,
      };
    }

    const isActive = input.isActive ?? true;
    const existingPromptVersion = await this.prisma.aiPromptVersion.findFirst({
      where: {
        module: input.module,
        promptKey: input.promptKey,
        version: input.version,
      },
    });

    if (existingPromptVersion) {
      const needsUpdate =
        existingPromptVersion.templateHash !== templateHash ||
        existingPromptVersion.sourceFile !== input.sourceFile ||
        existingPromptVersion.isActive !== isActive;

      if (needsUpdate) {
        const updatedPromptVersion = await this.prisma.aiPromptVersion.update({
          where: { id: existingPromptVersion.id },
          data: {
            templateHash,
            sourceFile: input.sourceFile,
            isActive,
            metadataJson: this.normalizeMetadata(input.metadata),
          },
        });

        this.cache.set(cacheKey, updatedPromptVersion.id);
        return {
          id: updatedPromptVersion.id,
          templateHash: updatedPromptVersion.templateHash,
        };
      }

      this.cache.set(cacheKey, existingPromptVersion.id);
      return {
        id: existingPromptVersion.id,
        templateHash: existingPromptVersion.templateHash,
      };
    }

    try {
      const createdPromptVersion = await this.prisma.aiPromptVersion.create({
        data: {
          module: input.module,
          promptKey: input.promptKey,
          version: input.version,
          templateHash,
          sourceFile: input.sourceFile,
          isActive,
          metadataJson: this.normalizeMetadata(input.metadata),
        },
      });

      this.cache.set(cacheKey, createdPromptVersion.id);
      return {
        id: createdPromptVersion.id,
        templateHash: createdPromptVersion.templateHash,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingByTemplateHash = await this.prisma.aiPromptVersion.findUnique({
          where: { templateHash },
        });

        if (existingByTemplateHash) {
          logger.warn(
            {
              module: input.module,
              promptKey: input.promptKey,
              version: input.version,
              templateHash,
            },
            'Prompt version already registered with same template hash. Reusing existing row.'
          );

          this.cache.set(cacheKey, existingByTemplateHash.id);
          return {
            id: existingByTemplateHash.id,
            templateHash: existingByTemplateHash.templateHash,
          };
        }
      }

      throw error;
    }
  }

  private computeTemplateHash(template: string): string {
    return createHash('sha256').update(template).digest('hex');
  }

  private buildCacheKey(
    module: string,
    promptKey: string,
    version: string,
    templateHash: string
  ): string {
    return `${module}:${promptKey}:${version}:${templateHash}`;
  }

  private normalizeMetadata(
    metadata: Record<string, unknown> | undefined
  ): Prisma.InputJsonValue | undefined {
    if (!metadata) {
      return undefined;
    }

    return metadata as Prisma.InputJsonValue;
  }
}
