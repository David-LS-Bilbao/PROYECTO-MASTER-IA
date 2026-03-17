import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/infrastructure/http/server';
import { prisma } from '../../src/infrastructure/database/prismaClient';

const app = createServer();

describe('Media Bias Atlas - Get Outlet Bias Profile Integration', () => {
  let countryId: string;
  let outletId: string;

  beforeAll(async () => {
    // Clean
    await prisma.rssFeed.deleteMany();
    await prisma.outlet.deleteMany();
    await prisma.country.deleteMany();

    // Setup basic country and outlet
    const country = await prisma.country.create({
      data: { code: 'YY', name: 'Bias Test Country' },
    });
    countryId = country.id;

    const outlet = await prisma.outlet.create({
      data: { countryId, name: 'The Bias Times', websiteUrl: 'https://biastimes.example.com' },
    });
    outletId = outlet.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. GET /api/outlets/:outletId/bias-profile -> should return INSUFFICIENT_DATA baseline when no articles exist', async () => {
    const res = await request(app).get(`/api/outlets/${outletId}/bias-profile`);
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      outletId,
      status: 'INSUFFICIENT_DATA',
      totalPoliticalArticles: 0,
      totalCompletedAnalyses: 0,
      minimumSampleRequired: 5,
      dominantLabel: null,
      distribution: {
        LEFT: 0,
        CENTER_LEFT: 0,
        CENTER: 0,
        CENTER_RIGHT: 0,
        RIGHT: 0,
        UNCLEAR: 0
      }
    }));
  });

  it('2. GET /api/outlets/:outletId/bias-profile -> should return 404 for non-existent outlet', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/outlets/${fakeId}/bias-profile`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('no encontrado');
  });
});
