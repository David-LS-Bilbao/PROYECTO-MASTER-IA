import { Request, Response } from 'express';
import { z } from 'zod';
import {
  AIObservabilityService,
  AiRunFilters,
  AiRunStatus,
  ListAiPromptVersionsInput,
  ListAiRunsInput,
} from '../../observability/ai-observability.service';

const aiRunStatusSchema = z.enum([
  AiRunStatus.PENDING,
  AiRunStatus.COMPLETED,
  AiRunStatus.FAILED,
  AiRunStatus.TIMEOUT,
  AiRunStatus.CANCELLED,
]);

const baseFiltersSchema = z.object({
  module: z.string().trim().min(1).optional(),
  operationKey: z.string().trim().min(1).optional(),
  provider: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  status: aiRunStatusSchema.optional(),
  requestId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const runsQuerySchema = baseFiltersSchema.extend({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const promptQuerySchema = z.object({
  module: z.string().trim().min(1).optional(),
  promptKey: z.string().trim().min(1).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export class AdminAiUsageController {
  constructor(private readonly aiObservabilityService: AIObservabilityService) {}

  async getOverview(req: Request, res: Response): Promise<void> {
    const query = baseFiltersSchema.parse(req.query);
    const filters = this.toRunFilters(query);
    const overview = await this.aiObservabilityService.getOverview(filters);

    res.status(200).json({
      success: true,
      data: overview,
    });
  }

  async getRuns(req: Request, res: Response): Promise<void> {
    const query = runsQuerySchema.parse(req.query);
    const filters: ListAiRunsInput = {
      ...this.toRunFilters(query),
      page: query.page,
      pageSize: query.pageSize,
    };

    const runs = await this.aiObservabilityService.listRuns(filters);
    res.status(200).json({
      success: true,
      data: runs,
    });
  }

  async getPrompts(req: Request, res: Response): Promise<void> {
    const query = promptQuerySchema.parse(req.query);
    const filters: ListAiPromptVersionsInput = {
      module: query.module,
      promptKey: query.promptKey,
      isActive: query.isActive,
      page: query.page,
      pageSize: query.pageSize,
    };

    const promptVersions = await this.aiObservabilityService.listPromptVersions(filters);
    res.status(200).json({
      success: true,
      data: promptVersions,
    });
  }

  async getComparison(req: Request, res: Response): Promise<void> {
    const query = baseFiltersSchema.parse(req.query);
    const filters = this.toRunFilters(query);
    const comparison = await this.aiObservabilityService.getComparison(filters);

    res.status(200).json({
      success: true,
      data: comparison,
    });
  }

  private toRunFilters(
    query: z.infer<typeof baseFiltersSchema> | z.infer<typeof runsQuerySchema>
  ): AiRunFilters {
    return {
      module: query.module,
      operationKey: query.operationKey,
      provider: query.provider,
      model: query.model,
      status: query.status,
      requestId: query.requestId,
      correlationId: query.correlationId,
      entityType: query.entityType,
      entityId: query.entityId,
      from: query.from,
      to: query.to,
    };
  }
}
