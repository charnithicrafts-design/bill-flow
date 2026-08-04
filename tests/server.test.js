import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer } from '../server.js';

describe('Bill Flow Backend (SCM Architecture)', () => {
  let app;
  let server;
  let db;

  // Setup in-memory DB and server before tests
  beforeAll(async () => {
    // :memory: creates a purely in-memory SQLite database for testing
    const instance = startServer(':memory:');
    app = instance.app;
    server = instance.server;
    db = instance.db;

    // Wait a brief moment for Express to bind
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  // Teardown after tests
  afterAll(() => {
    server.close();
    db.close();
  });

  describe('SCM Initialization', () => {
    it('should reject requests to protected routes before setup', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('NOT_CONFIGURED');
    });

    it('should successfully configure the TEXTILE domain', async () => {
      const res = await request(app)
        .post('/api/setup')
        .send({ domain: 'TEXTILE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.domain).toBe('TEXTILE');
    });

    it('should return health status once configured', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.domain).toBe('TEXTILE');
    });
  });

  describe('Transaction Safety (Checkout API)', () => {
    let skuIdToTest;

    it('should populate seed data and find a product', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      
      const skusRes = await request(app).get(`/api/products/${res.body[0].id}/skus`);
      expect(skusRes.status).toBe(200);
      expect(skusRes.body.length).toBeGreaterThan(0);
      
      skuIdToTest = skusRes.body[0].id; // We'll test against the first variation
    });

    it('should successfully complete an atomic checkout', async () => {
      const payload = {
        items: [{ sku_id: skuIdToTest, quantity: 1 }],
        customer_name: 'Test Consumer',
        is_igst: false,
        payment_method: 'CASH',
        counter_id: 'COUNTER-TEST'
      };

      const res = await request(app)
        .post('/api/checkout')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invoice_id).toBeDefined();
    });

    it('should block checkout if quantity exceeds stock', async () => {
      const payload = {
        items: [{ sku_id: skuIdToTest, quantity: 99999 }],
        customer_name: 'Greedy Consumer'
      };

      const res = await request(app)
        .post('/api/checkout')
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INSUFFICIENT_STOCK');
    });
  });
});
