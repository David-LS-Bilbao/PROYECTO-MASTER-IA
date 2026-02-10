/**
 * TopicController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { TopicController } from '../../../../src/infrastructure/http/controllers/topic.controller';

// ============================================================================
// HELPERS
// ============================================================================

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('TopicController', () => {
  let controller: TopicController;
  let repository: { findAll: ReturnType<typeof vi.fn>; findBySlug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findAll: vi.fn(),
      findBySlug: vi.fn(),
    };
    controller = new TopicController(repository as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getAllTopics retorna lista', async () => {
    const { res, jsonMock } = createRes();
    repository.findAll.mockResolvedValueOnce([{ id: 't1', slug: 'general' }]);

    await controller.getAllTopics({} as Request, res as Response);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });

  it('getAllTopics 500 si error', async () => {
    const { res, statusMock } = createRes();
    repository.findAll.mockRejectedValueOnce(new Error('DB error'));

    await controller.getAllTopics({} as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('getTopicBySlug 400 si falta slug', async () => {
    const { res, statusMock } = createRes();
    const req = { params: {} } as Request;

    await controller.getTopicBySlug(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('getTopicBySlug 404 si no existe', async () => {
    const { res, statusMock } = createRes();
    const req = { params: { slug: 'general' } } as Request;

    repository.findBySlug.mockResolvedValueOnce(null);

    await controller.getTopicBySlug(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('getTopicBySlug retorna tema', async () => {
    const { res, jsonMock } = createRes();
    const req = { params: { slug: 'general' } } as Request;

    repository.findBySlug.mockResolvedValueOnce({ id: 't1', slug: 'general' });

    await controller.getTopicBySlug(req, res as Response);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ slug: 'general' }) })
    );
  });

  it('getTopicBySlug 500 si error', async () => {
    const { res, statusMock } = createRes();
    const req = { params: { slug: 'general' } } as Request;

    repository.findBySlug.mockRejectedValueOnce(new Error('DB error'));

    await controller.getTopicBySlug(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
