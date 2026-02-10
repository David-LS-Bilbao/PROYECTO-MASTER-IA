/**
 * SourcesController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { SourcesController } from '../../../../src/infrastructure/http/controllers/sources.controller';

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

describe('SourcesController', () => {
  let controller: SourcesController;
  let geminiClient: { discoverRssUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    geminiClient = { discoverRssUrl: vi.fn() };
    controller = new SourcesController(geminiClient as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('400 si input invalido', async () => {
    const { res, statusMock } = createRes();
    const req = { body: { query: '' } } as Request;

    await controller.discover(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('404 si no encuentra RSS', async () => {
    const { res, statusMock } = createRes();
    const req = { body: { query: 'medio' } } as Request;

    geminiClient.discoverRssUrl.mockResolvedValueOnce(null);

    await controller.discover(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('200 si encuentra RSS', async () => {
    const { res, statusMock, jsonMock } = createRes();
    const req = { body: { query: 'medio' } } as Request;

    geminiClient.discoverRssUrl.mockResolvedValueOnce('https://example.com/rss');

    await controller.discover(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { query: 'medio', rssUrl: 'https://example.com/rss' },
      })
    );
  });

  it('500 si ocurre error', async () => {
    const { res, statusMock } = createRes();
    const req = { body: { query: 'medio' } } as Request;

    geminiClient.discoverRssUrl.mockRejectedValueOnce(new Error('Gemini error'));

    await controller.discover(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
