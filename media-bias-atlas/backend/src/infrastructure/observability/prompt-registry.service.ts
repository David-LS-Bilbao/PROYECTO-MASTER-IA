import { createHash, randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../logger/logger';

const logger = createModuleLogger('PromptRegistryService');

interface PromptVersionRow {
  id: string;
  templateHash: string;
  sourceFile: string;
  isActive: boolean;
}

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
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    const existingPromptVersion = await this.prisma.$queryRaw<PromptVersionRow[]>(
      Prisma.sql`
        SELECT
          "id" AS "id",
          "template_hash" AS "templateHash",
          "source_file" AS "sourceFile",
          "is_active" AS "isActive"
        FROM "ai_prompt_versions"
        WHERE
          "module" = ${input.module}
          AND "prompt_key" = ${input.promptKey}
          AND "version" = ${input.version}
        LIMIT 1
      `
    );

    if (existingPromptVersion[0]) {
      const current = existingPromptVersion[0];
      const needsUpdate =
        current.templateHash !== templateHash ||
        current.sourceFile !== input.sourceFile ||
        current.isActive !== isActive;

      if (needsUpdate) {
        await this.prisma.$executeRaw(
          Prisma.sql`
            UPDATE "ai_prompt_versions"
            SET
              "template_hash" = ${templateHash},
              "source_file" = ${input.sourceFile},
              "is_active" = ${isActive},
              "metadata_json" = ${metadataJson}::jsonb,
              "updated_at" = NOW()
            WHERE "id" = ${current.id}
          `
        );
      }

      this.cache.set(cacheKey, current.id);
      return {
        id: current.id,
        templateHash,
      };
    }

    const promptId = randomUUID();

    try {
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "ai_prompt_versions" (
            "id",
            "module",
            "prompt_key",
            "version",
            "template_hash",
            "source_file",
            "is_active",
            "metadata_json",
            "created_at",
            "updated_at"
          ) VALUES (
            ${promptId},
            ${input.module},
            ${input.promptKey},
            ${input.version},
            ${templateHash},
            ${input.sourceFile},
            ${isActive},
            ${metadataJson}::jsonb,
            NOW(),
            NOW()
          )
        `
      );

      this.cache.set(cacheKey, promptId);
      return {
        id: promptId,
        templateHash,
      };
    } catch (error) {
      const existingByTemplateHash = await this.prisma.$queryRaw<Array<{ id: string; templateHash: string }>>(
        Prisma.sql`
          SELECT
            "id" AS "id",
            "template_hash" AS "templateHash"
          FROM "ai_prompt_versions"
          WHERE "template_hash" = ${templateHash}
          LIMIT 1
        `
      );

      if (existingByTemplateHash[0]) {
        logger.warn(
          {
            module: input.module,
            promptKey: input.promptKey,
            version: input.version,
            templateHash,
          },
          'Prompt version already registered with same template hash. Reusing existing row.'
        );

        this.cache.set(cacheKey, existingByTemplateHash[0].id);
        return {
          id: existingByTemplateHash[0].id,
          templateHash: existingByTemplateHash[0].templateHash,
        };
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
}
