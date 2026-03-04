/**
 * FOIA Litigation Hold Service
 * Manages litigation holds on FOIA requests
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { emit } from '@govli/foia-shared';
import { LitigationHold } from '../types';

/**
 * Litigation Hold Service
 */
export class LitigationHoldService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Create litigation hold
   */
  async createLitigationHold(
    tenant_id: string,
    foia_request_id: string,
    reason: string,
    case_number: string | undefined,
    created_by: string
  ): Promise<LitigationHold> {
    const holdId = crypto.randomUUID();

    const result = await this.db.query(
      `INSERT INTO foia_litigation_holds (
        id, tenant_id, foia_request_id, reason, case_number,
        start_date, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, NOW(), NOW())
      RETURNING *`,
      [holdId, tenant_id, foia_request_id, reason, case_number, 'ACTIVE', created_by]
    );

    const hold = result.rows[0] as LitigationHold;

    // Emit event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.litigation_hold.created',
      entity_id: foia_request_id,
      entity_type: 'foia_request',
      user_id: created_by,
      metadata: {
        hold_id: holdId,
        reason,
        case_number
      },
      timestamp: new Date()
    });

    console.log(`[LitigationHold] Created hold for request ${foia_request_id}`);

    return hold;
  }

  /**
   * Release litigation hold
   */
  async releaseLitigationHold(
    tenant_id: string,
    foia_request_id: string,
    released_by: string
  ): Promise<LitigationHold> {
    // Find active hold
    const findResult = await this.db.query(
      `SELECT * FROM foia_litigation_holds
       WHERE tenant_id = $1
         AND foia_request_id = $2
         AND status = 'ACTIVE'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenant_id, foia_request_id]
    );

    if (findResult.rows.length === 0) {
      throw new Error('No active litigation hold found');
    }

    const hold = findResult.rows[0];

    // Release hold
    const result = await this.db.query(
      `UPDATE foia_litigation_holds
       SET status = 'RELEASED',
           end_date = NOW(),
           released_by = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [released_by, hold.id]
    );

    const updatedHold = result.rows[0] as LitigationHold;

    // Emit event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.litigation_hold.released',
      entity_id: foia_request_id,
      entity_type: 'foia_request',
      user_id: released_by,
      metadata: {
        hold_id: hold.id
      },
      timestamp: new Date()
    });

    console.log(`[LitigationHold] Released hold for request ${foia_request_id}`);

    return updatedHold;
  }

  /**
   * Get active holds for a request
   */
  async getActiveHolds(tenant_id: string, foia_request_id: string): Promise<LitigationHold[]> {
    const result = await this.db.query(
      `SELECT * FROM foia_litigation_holds
       WHERE tenant_id = $1
         AND foia_request_id = $2
         AND status = 'ACTIVE'
       ORDER BY created_at DESC`,
      [tenant_id, foia_request_id]
    );

    return result.rows as LitigationHold[];
  }

  /**
   * Get all holds for a request (active and released)
   */
  async getAllHolds(tenant_id: string, foia_request_id: string): Promise<LitigationHold[]> {
    const result = await this.db.query(
      `SELECT * FROM foia_litigation_holds
       WHERE tenant_id = $1
         AND foia_request_id = $2
       ORDER BY created_at DESC`,
      [tenant_id, foia_request_id]
    );

    return result.rows as LitigationHold[];
  }

  /**
   * Check if request has active hold
   */
  async hasActiveHold(tenant_id: string, foia_request_id: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count
       FROM foia_litigation_holds
       WHERE tenant_id = $1
         AND foia_request_id = $2
         AND status = 'ACTIVE'`,
      [tenant_id, foia_request_id]
    );

    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get all active holds for tenant
   */
  async getTenantActiveHolds(tenant_id: string): Promise<LitigationHold[]> {
    const result = await this.db.query(
      `SELECT * FROM foia_litigation_holds
       WHERE tenant_id = $1
         AND status = 'ACTIVE'
       ORDER BY created_at DESC`,
      [tenant_id]
    );

    return result.rows as LitigationHold[];
  }
}
