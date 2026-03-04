/**
 * FOIA Audit Log Service
 * INSERT-ONLY audit logging with AES-256 encryption
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { EncryptionService } from './encryptionService';
import { AuditLogEntry, AuditLogFilters, DecryptedAuditPayload } from '../types';

/**
 * Audit Log Service
 * CRITICAL: This service ONLY performs INSERT operations
 * UPDATE and DELETE are prohibited by design and database constraints
 */
export class AuditLogService {
  private db: Pool;
  private encryption: EncryptionService;

  constructor(db: Pool) {
    this.db = db;
    this.encryption = new EncryptionService();
  }

  /**
   * Log an audit event (INSERT-ONLY)
   * This is the ONLY write operation allowed
   */
  async logEvent(
    tenant_id: string,
    event: {
      event_id: string;
      event_type: string;
      entity_id: string;
      entity_type: string;
      user_id?: string;
      metadata: Record<string, any>;
      timestamp: Date;
    }
  ): Promise<AuditLogEntry> {
    try {
      // Check if request has active litigation hold
      const hold_flag = await this.checkLitigationHold(tenant_id, event.entity_id);

      // Encrypt the event payload
      const payload = {
        event_id: event.event_id,
        event_type: event.event_type,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        user_id: event.user_id,
        metadata: event.metadata,
        timestamp: event.timestamp
      };

      const { encrypted, iv } = this.encryption.encrypt(payload);

      // INSERT the audit log entry
      const auditId = crypto.randomUUID();

      const result = await this.db.query(
        `INSERT INTO foia_audit_log (
          id, tenant_id, event_id, event_type, entity_id, entity_type,
          user_id, encrypted_payload, encryption_iv, hold_flag,
          archived, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
        [
          auditId,
          tenant_id,
          event.event_id,
          event.event_type,
          event.entity_id,
          event.entity_type,
          event.user_id || null,
          encrypted,
          iv,
          hold_flag,
          false // not archived by default
        ]
      );

      return result.rows[0] as AuditLogEntry;
    } catch (error) {
      console.error('[AuditLogService] Log event error:', error);
      throw error;
    }
  }

  /**
   * Check if entity has active litigation hold
   */
  private async checkLitigationHold(tenant_id: string, entity_id: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) as count
         FROM foia_litigation_holds
         WHERE tenant_id = $1
           AND foia_request_id = $2
           AND status = 'ACTIVE'`,
        [tenant_id, entity_id]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      // If table doesn't exist or query fails, assume no hold
      return false;
    }
  }

  /**
   * Query audit logs with filters and pagination
   * READ-ONLY operation
   */
  async queryAuditLogs(filters: AuditLogFilters): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [filters.tenant_id];
    let paramIndex = 2;

    if (filters.entity_id) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(filters.entity_id);
    }

    if (filters.entity_type) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(filters.entity_type);
    }

    if (filters.event_type) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(filters.event_type);
    }

    if (filters.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.end_date);
    }

    if (filters.hold_flag !== undefined) {
      conditions.push(`hold_flag = $${paramIndex++}`);
      params.push(filters.hold_flag);
    }

    if (filters.archived !== undefined) {
      conditions.push(`archived = $${paramIndex++}`);
      params.push(filters.archived);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM foia_audit_log WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await this.db.query(
      `SELECT * FROM foia_audit_log
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      logs: result.rows as AuditLogEntry[],
      total,
      page,
      limit
    };
  }

  /**
   * Decrypt a single audit log entry
   * READ-ONLY operation
   */
  decryptAuditLog(entry: AuditLogEntry): DecryptedAuditPayload {
    return this.encryption.decryptJSON<DecryptedAuditPayload>(
      entry.encrypted_payload,
      entry.encryption_iv
    );
  }

  /**
   * Export audit logs for a date range
   * READ-ONLY operation
   */
  async exportAuditLogs(
    tenant_id: string,
    start_date: Date,
    end_date: Date,
    include_encrypted: boolean = false
  ): Promise<AuditLogEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM foia_audit_log
       WHERE tenant_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at ASC`,
      [tenant_id, start_date, end_date]
    );

    const logs = result.rows as AuditLogEntry[];

    if (!include_encrypted) {
      // Remove encrypted payload from export for security
      return logs.map(log => ({
        ...log,
        encrypted_payload: '[REDACTED]',
        encryption_iv: '[REDACTED]'
      }));
    }

    return logs;
  }

  /**
   * Mark audit logs as archived (7-year retention)
   * This is the ONLY update operation allowed, and only sets archived flag
   * NEVER deletes records
   */
  async markAsArchived(tenant_id: string, before_date: Date): Promise<number> {
    const result = await this.db.query(
      `UPDATE foia_audit_log
       SET archived = true
       WHERE tenant_id = $1
         AND created_at < $2
         AND archived = false
       RETURNING id`,
      [tenant_id, before_date]
    );

    return result.rowCount || 0;
  }

  /**
   * Get audit log statistics
   * READ-ONLY operation
   */
  async getStatistics(tenant_id: string, start_date?: Date, end_date?: Date): Promise<{
    total_events: number;
    by_event_type: Record<string, number>;
    with_holds: number;
    archived: number;
  }> {
    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenant_id];

    if (start_date) {
      whereClause += ' AND created_at >= $2';
      params.push(start_date);
      if (end_date) {
        whereClause += ' AND created_at <= $3';
        params.push(end_date);
      }
    } else if (end_date) {
      whereClause += ' AND created_at <= $2';
      params.push(end_date);
    }

    // Get total events
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM foia_audit_log ${whereClause}`,
      params
    );

    // Get events by type
    const typeResult = await this.db.query(
      `SELECT event_type, COUNT(*) as count
       FROM foia_audit_log ${whereClause}
       GROUP BY event_type`,
      params
    );

    const by_event_type: Record<string, number> = {};
    typeResult.rows.forEach(row => {
      by_event_type[row.event_type] = parseInt(row.count);
    });

    // Get holds count
    const holdsResult = await this.db.query(
      `SELECT COUNT(*) as count FROM foia_audit_log ${whereClause} AND hold_flag = true`,
      params
    );

    // Get archived count
    const archivedResult = await this.db.query(
      `SELECT COUNT(*) as count FROM foia_audit_log ${whereClause} AND archived = true`,
      params
    );

    return {
      total_events: parseInt(totalResult.rows[0].count),
      by_event_type,
      with_holds: parseInt(holdsResult.rows[0].count),
      archived: parseInt(archivedResult.rows[0].count)
    };
  }

  /**
   * NO UPDATE OPERATIONS ALLOWED EXCEPT markAsArchived
   * NO DELETE OPERATIONS ALLOWED
   *
   * These methods are intentionally not implemented to enforce INSERT-ONLY
   * Database constraints should also prevent these operations
   */

  // updateAuditLog() - PROHIBITED
  // deleteAuditLog() - PROHIBITED
}
