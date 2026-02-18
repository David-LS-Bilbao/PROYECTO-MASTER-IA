/**
 * Chat Routes Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import type { Router } from 'express';
import { createChatRoutes } from '../../../../src/infrastructure/http/routes/chat.routes';
import { authenticate } from '../../../../src/infrastructure/http/middleware/auth.middleware';

describe('chat.routes', () => {
  const getRouteLayer = (router: Router, path: string) => {
    return (router as any).stack.find((item: any) => item.route?.path === path)?.route;
  };

  it('registra rutas de chat protegidas con authenticate', () => {
    const chatController = {
      chatWithArticle: vi.fn(),
      chatGeneral: vi.fn(),
    };

    const router = createChatRoutes(chatController as any);

    const articleRoute = getRouteLayer(router, '/article');
    const generalRoute = getRouteLayer(router, '/general');

    expect(articleRoute).toBeDefined();
    expect(generalRoute).toBeDefined();

    expect(articleRoute.stack[0].handle).toBe(authenticate);
    expect(generalRoute.stack[0].handle).toBe(authenticate);
  });

  it('invoca los handlers del controlador de chat', () => {
    const chatController = {
      chatWithArticle: vi.fn(),
      chatGeneral: vi.fn(),
    };

    const router = createChatRoutes(chatController as any);

    const articleRoute = getRouteLayer(router, '/article');
    const generalRoute = getRouteLayer(router, '/general');

    const req = {} as any;
    const res = {} as any;

    // Stack[0] = authenticate, Stack[1] = handler del controlador
    articleRoute.stack[1].handle(req, res);
    generalRoute.stack[1].handle(req, res);

    expect(chatController.chatWithArticle).toHaveBeenCalledWith(req, res);
    expect(chatController.chatGeneral).toHaveBeenCalledWith(req, res);
  });
});
