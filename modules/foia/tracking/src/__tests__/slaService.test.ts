/**
 * SLA Service Tests
 */

import { Pool } from 'pg';
import { SLAService } from '../services/slaService';

// Mock pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn()
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock emit
jest.mock('@govli/foia-shared', () => ({
  emit: jest.fn(),
  FoiaRequestStatus: {}
}));

describe('SLAService', () => {
  let slaService: SLAService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = new Pool();
    slaService = new SLAService(mockDb);
    jest.clearAllMocks();
  });

  describe('calculateSLAStatus', () => {
    it('should calculate SLA for request with due date', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      const receivedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-1',
          tenant_id: 'tenant-1',
          status: 'IN_PROGRESS',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const result = await slaService.calculateSLAStatus('tenant-1', 'req-1');

      expect(result.foia_request_id).toBe('req-1');
      expect(result.days_remaining).toBeGreaterThanOrEqual(9);
      expect(result.days_remaining).toBeLessThanOrEqual(10);
      expect(result.days_elapsed).toBeGreaterThanOrEqual(9);
      expect(result.days_elapsed).toBeLessThanOrEqual(10);
      expect(result.total_days).toBeGreaterThanOrEqual(19);
      expect(result.total_days).toBeLessThanOrEqual(20);
      expect(result.is_overdue).toBe(false);
      expect(result.breach_risk_score).toBeGreaterThan(0);
      expect(result.breach_risk_score).toBeLessThan(100);
    });

    it('should return risk 100 for overdue requests', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const receivedAt = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000); // 25 days ago

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-2',
          tenant_id: 'tenant-1',
          status: 'IN_PROGRESS',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const result = await slaService.calculateSLAStatus('tenant-1', 'req-2');

      expect(result.is_overdue).toBe(true);
      expect(result.breach_risk_score).toBe(100);
      expect(result.sla_tier).toBe('RED');
      expect(result.days_remaining).toBeLessThan(0);
    });

    it('should return risk 0 for completed requests', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const receivedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-3',
          tenant_id: 'tenant-1',
          status: 'COMPLETED',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const result = await slaService.calculateSLAStatus('tenant-1', 'req-3');

      expect(result.breach_risk_score).toBe(0);
      expect(result.sla_tier).toBe('GREEN');
    });

    it('should handle requests without due date', async () => {
      const now = new Date();

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-4',
          tenant_id: 'tenant-1',
          status: 'PENDING',
          received_at: now,
          due_date: null
        }]
      });

      const result = await slaService.calculateSLAStatus('tenant-1', 'req-4');

      expect(result.breach_risk_score).toBe(0);
      expect(result.sla_tier).toBe('GREEN');
      expect(result.days_remaining).toBe(0);
    });

    it('should throw error for non-existent request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        slaService.calculateSLAStatus('tenant-1', 'req-999')
      ).rejects.toThrow('FOIA request not found');
    });
  });

  describe('Breach Risk Calculation', () => {
    it('should calculate higher risk for AWAITING_RESPONSE status', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const receivedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Test AWAITING_RESPONSE (velocity 0.3)
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-5',
          tenant_id: 'tenant-1',
          status: 'AWAITING_RESPONSE',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const awaitingResult = await slaService.calculateSLAStatus('tenant-1', 'req-5');

      // Test IN_PROGRESS (velocity 1.0)
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-6',
          tenant_id: 'tenant-1',
          status: 'IN_PROGRESS',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const inProgressResult = await slaService.calculateSLAStatus('tenant-1', 'req-6');

      // AWAITING_RESPONSE should have higher risk than IN_PROGRESS
      expect(awaitingResult.breach_risk_score).toBeGreaterThan(inProgressResult.breach_risk_score);
    });
  });

  describe('SLA Tier Classification', () => {
    it('should classify risk 0-30 as GREEN', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days away
      const receivedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-7',
          tenant_id: 'tenant-1',
          status: 'IN_PROGRESS',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const result = await slaService.calculateSLAStatus('tenant-1', 'req-7');
      expect(result.sla_tier).toBe('GREEN');
    });

    it('should classify overdue as RED', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const receivedAt = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'req-8',
          tenant_id: 'tenant-1',
          status: 'IN_PROGRESS',
          received_at: receivedAt,
          due_date: dueDate
        }]
      });

      const result = await slaService.calculateSLAStatus('tenant-1', 'req-8');
      expect(result.sla_tier).toBe('RED');
      expect(result.is_overdue).toBe(true);
    });
  });

  describe('getSLADashboard', () => {
    it('should aggregate SLA metrics correctly', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const receivedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-1',
            tenant_id: 'tenant-1',
            status: 'IN_PROGRESS',
            received_at: receivedAt,
            due_date: dueDate
          },
          {
            id: 'req-2',
            tenant_id: 'tenant-1',
            status: 'AWAITING_RESPONSE',
            received_at: receivedAt,
            due_date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) // Overdue
          }
        ]
      });

      const dashboard = await slaService.getSLADashboard('tenant-1');

      expect(dashboard.total_requests).toBe(2);
      expect(dashboard.overdue).toBeGreaterThan(0);
      expect(dashboard.average_breach_risk).toBeGreaterThan(0);
      expect(dashboard.requests).toHaveLength(2);
    });

    it('should handle empty results', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const dashboard = await slaService.getSLADashboard('tenant-1');

      expect(dashboard.total_requests).toBe(0);
      expect(dashboard.on_track).toBe(0);
      expect(dashboard.at_risk).toBe(0);
      expect(dashboard.overdue).toBe(0);
      expect(dashboard.average_breach_risk).toBe(0);
    });
  });

  describe('getOverdueAlerts', () => {
    it('should return overdue requests', async () => {
      const now = new Date();
      const overdueDueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            foia_request_id: 'req-1',
            tenant_id: 'tenant-1',
            requester_name: 'John Doe',
            subject: 'Test Request',
            due_date: overdueDueDate,
            assigned_to: 'user-1',
            status: 'IN_PROGRESS',
            received_at: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000)
          }
        ]
      });

      const alerts = await slaService.getOverdueAlerts('tenant-1');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].days_overdue).toBeGreaterThan(0);
      expect(alerts[0].breach_risk_score).toBe(100);
    });

    it('should return empty array when no overdue requests', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const alerts = await slaService.getOverdueAlerts('tenant-1');
      expect(alerts).toHaveLength(0);
    });
  });

  describe('checkSLAThresholds', () => {
    it('should emit warning events for high-risk requests', async () => {
      const { emit } = require('@govli/foia-shared');
      const now = new Date();
      const dueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days away
      const receivedAt = new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000); // 18 days ago

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-1',
            tenant_id: 'tenant-1',
            status: 'AWAITING_RESPONSE',
            received_at: receivedAt,
            due_date: dueDate
          }
        ]
      });

      await slaService.checkSLAThresholds('tenant-1');

      expect(emit).toHaveBeenCalled();
    });

    it('should emit overdue alert when overdue requests exist', async () => {
      const { emit } = require('@govli/foia-shared');
      const now = new Date();
      const overdueDueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-1',
            tenant_id: 'tenant-1',
            status: 'IN_PROGRESS',
            received_at: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
            due_date: overdueDueDate
          }
        ]
      });

      await slaService.checkSLAThresholds('tenant-1');

      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'foia.sla.overdue.alert'
        })
      );
    });
  });
});
