import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/infrastructure/http/server';
import { prisma } from '../../src/infrastructure/database/prismaClient';

const app = createServer();

describe('Media Bias Atlas - Integration Tests', () => {
  beforeAll(async () => {
    // Limpiar BD de test antes de empezar
    await prisma.rssFeed.deleteMany();
    await prisma.outlet.deleteMany();
    await prisma.country.deleteMany();

    // Insertar un país de prueba para las validaciones
    await prisma.country.create({
      data: {
        code: 'XX',
        name: 'Testlandia',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. GET /api/countries -> should list available test countries', async () => {
    const res = await request(app).get('/api/countries');
    
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].code).toBe('XX');
  });

  it('2. POST /api/outlets -> should create a new outlet for the existing country', async () => {
    const payload = {
      countryCode: 'XX',
      name: 'The Test Times',
      websiteUrl: 'https://thetesttimes.example.com',
    };

    const res = await request(app).post('/api/outlets').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('The Test Times');
  });

  it('3. GET /api/countries/:code/outlets -> should list the newly created outlet', async () => {
    const res = await request(app).get('/api/countries/XX/outlets');

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    // There should be exactly 1, the one we just created
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('The Test Times');
  });

  it('4. POST /api/outlets -> should return 400 for invalid properties', async () => {
    const invalidPayload = {
      countryCode: 'X', // Invalid, must be 2 chars
      name: 'T', // Invalid, must be at least 2 chars
      websiteUrl: 'not-a-url', // Invalid
    };

    const res = await request(app).post('/api/outlets').send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('5. POST /api/outlets -> should return 404 if Country does not exist', async () => {
    const payload = {
      countryCode: 'ZZ', // Does not exist
      name: 'Non Existent Times',
    };

    const res = await request(app).post('/api/outlets').send(payload);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('not found');
  });
});
