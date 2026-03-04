/**
 * Compliance Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createComplianceRoutes } from '../routes/complianceRoutes';
import { authMiddleware } from '../middleware/authMiddleware';
import jwt from 'jsonwebtoken';

// Mock pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn()
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock shared emit
jest.mock('@govli/foia-shared', () => ({
  emit: jest.fn()
}));

describe('Compliance Routes', () => {
  let app: express.Application;
  let mockDb: any;
  let authToken: string;
  let adminToken: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = new Pool();

    // Create regular auth token
    authToken = jwt.sign(
      {
        id: 'user-1',
        tenant_id: 'tenant-1',
        email: 'test@example.com',
        role: 'user'
      },
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    );

    // Create admin token
    adminToken = jwt.sign(
      {
        id: 'admin-1',
        tenant_id: 'tenant-1',
        email: 'admin@example.com',
        role: 'foia_admin'
      },
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    );

    // Mount routes with auth
    app.use('/compliance', authMiddleware, createComplianceRoutes(mockDb));

    jest.clearAllMocks();
  });

  describe('GET /compliance/audit-log', () => {
    it('should query audit logs with filters', async () => {
      // Mock count query
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '50' }] });

      // Mock data query
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'audit-1',
            event_type: 'foia.request.created',
            entity_id: 'req-1'
          }
        ]
      });

      const response = await request(app)
        .get('/compliance/audit-log')
        .query({ event_type: 'foia.request.created', page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toHaveLength(1);
      expect(response.body.data.total).toBe(50);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .get('/compliance/audit-log');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /compliance/requests/:id/litigation-hold', () => {
    it('should create litigation hold', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'hold-1',
          foia_request_id: 'req-1',
          reason: 'Pending litigation',
          status: 'ACTIVE'
        }]
      });

      const response = await request(app)
        .post('/compliance/requests/req-1/litigation-hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Pending litigation',
          case_number: 'CASE-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('should return 400 when reason is missing', async () => {
      const response = await request(app)
        .post('/compliance/requests/req-1/litigation-hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('DELETE /compliance/requests/:id/litigation-hold', () => {
    it('should release litigation hold', async () => {
      // Mock find active hold
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'hold-1',
          status: 'ACTIVE'
        }]
      });

      // Mock update to released
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'hold-1',
          status: 'RELEASED',
          end_date: new Date()
        }]
      });

      const response = await request(app)
        .delete('/compliance/requests/req-1/litigation-hold')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('RELEASED');
    });
  });

  describe('GET /compliance/annual-report', () => {
    it('should generate DOJ annual report', async () => {
      // Mock all the queries for annual report
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // received
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }) // carried forward
        .mockResolvedValueOnce({ rows: [{ processed: '80', granted_full: '60', denied_full: '10' }] }) // processed
        .mockResolvedValueOnce({ rows: [{ partial_grant: '5', no_records: '5' }] }) // responses
        .mockResolvedValueOnce({ rows: [{ simple_median: 10, complex_median: 30, expedited_median: 5 }] }) // timeliness
        .mockResolvedValueOnce({ rows: [{ count: '40' }] }) // backlog
        .mockResolvedValueOnce({ rows: [{ received: '10', processed: '8', granted: '3', denied: '5' }] }) // appeals
        .mockResolvedValueOnce({ rows: [{ total_fees: '5000', fee_waivers: '15' }] }) // fees
        .mockResolvedValueOnce({ rows: [] }); // exemptions

      const response = await request(app)
        .get('/compliance/annual-report')
        .query({ year: 2024 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.year).toBe(2024);
      expect(response.body.data.requests_received).toBe(100);
    });
  });

  describe('GET /compliance/sla-summary', () => {
    it('should generate SLA summary', async () => {
      // Mock queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // total
        .mockResolvedValueOnce({ rows: [{ on_time: '80', overdue: '20', avg_days: '15' }] }) // completion
        .mockResolvedValueOnce({ rows: [] }); // by complexity

      const response = await request(app)
        .get('/compliance/sla-summary')
        .query({ year: 2024 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_requests).toBe(100);
      expect(response.body.data.compliance_rate).toBeDefined();
    });
  });

  describe('GET /compliance/audit-log/export', () => {
    it('should allow admin to export audit logs', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'audit-1',
            event_type: 'test.event',
            encrypted_payload: 'encrypted',
            encryption_iv: 'iv'
          }
        ]
      });

      const response = await request(app)
        .get('/compliance/audit-log/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toHaveLength(1);
    });

    it('should deny non-admin users', async () => {
      const response = await request(app)
        .get('/compliance/audit-log/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /compliance/audit-log/statistics', () => {
    it('should return audit log statistics', async () => {
      // Mock statistics queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1000' }] }) // total
        .mockResolvedValueOnce({ rows: [{ event_type: 'test.event', count: '500' }] }) // by type
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // holds
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }); // archived

      const response = await request(app)
        .get('/compliance/audit-log/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_events).toBe(1000);
    });
  });

  describe('GET /compliance/requests/:id/litigation-holds', () => {
    it('should get all litigation holds for a request', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: 'hold-1', status: 'ACTIVE' },
          { id: 'hold-2', status: 'RELEASED' }
        ]
      });

      const response = await request(app)
        .get('/compliance/requests/req-1/litigation-holds')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });
});
