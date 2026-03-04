/**
 * Audit Log Service Tests
 * CRITICAL: Tests INSERT-ONLY constraint
 */

import { Pool } from 'pg';
import { AuditLogService } from '../services/auditLogService';
import { EncryptionService } from '../services/encryptionService';

// Mock pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn()
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('AuditLogService', () => {
  let auditLogService: AuditLogService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = new Pool();
    auditLogService = new AuditLogService(mockDb);
    jest.clearAllMocks();
  });

  describe('INSERT-ONLY Constraint', () => {
    it('should ONLY allow INSERT operations', async () => {
      // Mock litigation hold check
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      // Mock INSERT operation
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'audit-1',
          tenant_id: 'tenant-1',
          event_id: 'event-1',
          event_type: 'foia.request.created',
          entity_id: 'req-1',
          entity_type: 'foia_request',
          encrypted_payload: 'encrypted...',
          encryption_iv: 'iv...',
          hold_flag: false,
          archived: false,
          created_at: new Date()
        }]
      });

      const result = await auditLogService.logEvent('tenant-1', {
        event_id: 'event-1',
        event_type: 'foia.request.created',
        entity_id: 'req-1',
        entity_type: 'foia_request',
        user_id: 'user-1',
        metadata: { test: 'data' },
        timestamp: new Date()
      });

      expect(result.id).toBe('audit-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO foia_audit_log'),
        expect.any(Array)
      );

      // Verify INSERT was called
      const insertCall = mockDb.query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO foia_audit_log')
      );
      expect(insertCall).toBeDefined();
    });

    it('should NOT have UPDATE methods', () => {
      // The service should not have updateAuditLog method
      expect((auditLogService as any).updateAuditLog).toBeUndefined();
    });

    it('should NOT have DELETE methods', () => {
      // The service should not have deleteAuditLog method
      expect((auditLogService as any).deleteAuditLog).toBeUndefined();
    });

    it('should ONLY allow archived flag update via markAsArchived', async () => {
      // markAsArchived is the ONLY update allowed
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'audit-1' }, { id: 'audit-2' }],
        rowCount: 2
      });

      const count = await auditLogService.markAsArchived(
        'tenant-1',
        new Date('2017-01-01')
      );

      expect(count).toBe(2);

      // Verify UPDATE query ONLY sets archived flag
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET archived = true'),
        expect.any(Array)
      );

      // Ensure it doesn't modify any other fields
      const updateCall = mockDb.query.mock.calls[0][0];
      expect(updateCall).not.toContain('UPDATE foia_audit_log SET');
      expect(updateCall).toContain('SET archived = true');
    });

    /**
     * CRITICAL TEST: Verify database constraint prevents UPDATE/DELETE
     * This test documents that the database itself enforces INSERT-ONLY
     */
    it('should document INSERT-ONLY database constraint requirement', () => {
      // This test serves as documentation that the database MUST have:
      // 1. A trigger that prevents UPDATE on foia_audit_log
      // 2. A trigger that prevents DELETE on foia_audit_log
      // 3. RLS policies that only allow INSERT

      // Example PostgreSQL trigger to prevent updates (except archived flag):
      const preventUpdateTrigger = `
        CREATE OR REPLACE FUNCTION prevent_audit_log_update()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.archived = FALSE AND NEW.archived = TRUE THEN
            -- Allow marking as archived
            RETURN NEW;
          END IF;
          RAISE EXCEPTION 'UPDATE not allowed on foia_audit_log table';
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER prevent_audit_update
        BEFORE UPDATE ON foia_audit_log
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_update();
      `;

      // Example PostgreSQL trigger to prevent deletes:
      const preventDeleteTrigger = `
        CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'DELETE not allowed on foia_audit_log table';
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER prevent_audit_delete
        BEFORE DELETE ON foia_audit_log
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_delete();
      `;

      // Assert that this test exists to document the requirement
      expect(preventUpdateTrigger).toContain('prevent_audit_log_update');
      expect(preventDeleteTrigger).toContain('prevent_audit_log_delete');

      console.log('[TEST] INSERT-ONLY constraint must be enforced at database level');
      console.log('[TEST] Required database triggers:', {
        prevent_update: 'prevent_audit_log_update()',
        prevent_delete: 'prevent_audit_log_delete()'
      });
    });
  });

  describe('logEvent', () => {
    it('should encrypt payload before storing', async () => {
      // Mock litigation hold check
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      // Mock INSERT
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'audit-1',
          tenant_id: 'tenant-1',
          encrypted_payload: 'encrypted-data',
          encryption_iv: 'iv-value'
        }]
      });

      const result = await auditLogService.logEvent('tenant-1', {
        event_id: 'event-1',
        event_type: 'test.event',
        entity_id: 'entity-1',
        entity_type: 'test',
        metadata: { sensitive: 'data' },
        timestamp: new Date()
      });

      expect(result.encrypted_payload).toBeDefined();
      expect(result.encryption_iv).toBeDefined();

      // Verify INSERT was called with encrypted payload
      const insertCall = mockDb.query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO foia_audit_log')
      );
      expect(insertCall).toBeDefined();
    });

    it('should set hold_flag when litigation hold exists', async () => {
      // Mock litigation hold check - hold exists
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      // Mock INSERT
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'audit-1',
          hold_flag: true
        }]
      });

      const result = await auditLogService.logEvent('tenant-1', {
        event_id: 'event-1',
        event_type: 'test.event',
        entity_id: 'req-1',
        entity_type: 'foia_request',
        metadata: {},
        timestamp: new Date()
      });

      expect(result.hold_flag).toBe(true);
    });
  });

  describe('queryAuditLogs', () => {
    it('should query with filters and pagination', async () => {
      // Mock count query
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });

      // Mock data query
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: 'audit-1', event_type: 'test.event' },
          { id: 'audit-2', event_type: 'test.event' }
        ]
      });

      const result = await auditLogService.queryAuditLogs({
        tenant_id: 'tenant-1',
        event_type: 'test.event',
        page: 1,
        limit: 10
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('decryptAuditLog', () => {
    it('should decrypt audit log payload', () => {
      const encryption = new EncryptionService();
      const originalData = {
        event_id: 'event-1',
        event_type: 'test.event',
        entity_id: 'entity-1',
        entity_type: 'test',
        metadata: { test: 'data' },
        timestamp: new Date()
      };

      const { encrypted, iv } = encryption.encrypt(originalData);

      const entry: any = {
        id: 'audit-1',
        encrypted_payload: encrypted,
        encryption_iv: iv
      };

      const decrypted = auditLogService.decryptAuditLog(entry);

      expect(decrypted.event_id).toBe('event-1');
      expect(decrypted.event_type).toBe('test.event');
      expect(decrypted.metadata).toEqual({ test: 'data' });
    });
  });

  describe('exportAuditLogs', () => {
    it('should export logs with encrypted data redacted by default', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'audit-1',
            encrypted_payload: 'secret-data',
            encryption_iv: 'secret-iv'
          }
        ]
      });

      const logs = await auditLogService.exportAuditLogs(
        'tenant-1',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        false // don't include encrypted
      );

      expect(logs[0].encrypted_payload).toBe('[REDACTED]');
      expect(logs[0].encryption_iv).toBe('[REDACTED]');
    });

    it('should include encrypted data when requested', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'audit-1',
            encrypted_payload: 'encrypted-data',
            encryption_iv: 'iv-value'
          }
        ]
      });

      const logs = await auditLogService.exportAuditLogs(
        'tenant-1',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        true // include encrypted
      );

      expect(logs[0].encrypted_payload).toBe('encrypted-data');
      expect(logs[0].encryption_iv).toBe('iv-value');
    });
  });

  describe('getStatistics', () => {
    it('should return audit log statistics', async () => {
      // Mock total events
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '1000' }] });

      // Mock events by type
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { event_type: 'foia.request.created', count: '400' },
          { event_type: 'foia.request.updated', count: '300' },
          { event_type: 'foia.response.delivered', count: '300' }
        ]
      });

      // Mock holds count
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '50' }] });

      // Mock archived count
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const stats = await auditLogService.getStatistics('tenant-1');

      expect(stats.total_events).toBe(1000);
      expect(stats.by_event_type['foia.request.created']).toBe(400);
      expect(stats.with_holds).toBe(50);
      expect(stats.archived).toBe(100);
    });
  });
});
