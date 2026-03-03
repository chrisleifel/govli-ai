/**
 * FOIA Routing Service
 * Manages department routing and assignment
 */

import { Pool } from 'pg';
import { RoutingRecord } from '../types';
import { emit } from '@govli/foia-shared';
import crypto from 'crypto';

/**
 * Routing Service
 */
export class RoutingService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Route request to department
   */
  async routeRequest(
    tenant_id: string,
    foia_request_id: string,
    department_id: string,
    department_name: string,
    notes: string | undefined,
    created_by: string
  ): Promise<RoutingRecord> {
    const routingId = crypto.randomUUID();

    const result = await this.db.query(
      `INSERT INTO foia_routing (
        id, tenant_id, foia_request_id, department_id, department_name,
        status, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        routingId,
        tenant_id,
        foia_request_id,
        department_id,
        department_name,
        'PENDING',
        notes,
        created_by
      ]
    );

    const routing = result.rows[0] as RoutingRecord;

    // Emit routing event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.request.routed',
      entity_id: foia_request_id,
      entity_type: 'foia_request',
      user_id: created_by,
      metadata: {
        routing_id: routingId,
        department_id,
        department_name
      },
      timestamp: new Date()
    });

    return routing;
  }

  /**
   * Assign routing to user
   */
  async assignRouting(
    tenant_id: string,
    routing_id: string,
    assigned_to: string,
    assigned_by: string
  ): Promise<RoutingRecord> {
    // Verify routing exists and belongs to tenant
    const checkResult = await this.db.query(
      `SELECT r.id, fr.tenant_id
       FROM foia_routing r
       JOIN foia_requests fr ON fr.id = r.foia_request_id
       WHERE r.id = $1 AND fr.tenant_id = $2`,
      [routing_id, tenant_id]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Routing record not found or access denied');
    }

    // Update assignment
    const result = await this.db.query(
      `UPDATE foia_routing
       SET assigned_to = $1, assigned_at = NOW(), status = 'ASSIGNED', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [assigned_to, routing_id]
    );

    const routing = result.rows[0] as RoutingRecord;

    // Update FOIA request assigned_to
    await this.db.query(
      `UPDATE foia_requests
       SET assigned_to = $1, updated_at = NOW()
       WHERE id = $2`,
      [assigned_to, routing.foia_request_id]
    );

    // Emit assignment event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.request.assigned',
      entity_id: routing.foia_request_id,
      entity_type: 'foia_request',
      user_id: assigned_by,
      metadata: {
        routing_id,
        assigned_to
      },
      timestamp: new Date()
    });

    return routing;
  }

  /**
   * Get routing records for a request
   */
  async getRoutingRecords(
    tenant_id: string,
    foia_request_id: string
  ): Promise<RoutingRecord[]> {
    const result = await this.db.query(
      `SELECT r.*
       FROM foia_routing r
       JOIN foia_requests fr ON fr.id = r.foia_request_id
       WHERE fr.tenant_id = $1 AND r.foia_request_id = $2
       ORDER BY r.created_at DESC`,
      [tenant_id, foia_request_id]
    );

    return result.rows as RoutingRecord[];
  }

  /**
   * Update routing status
   */
  async updateRoutingStatus(
    tenant_id: string,
    routing_id: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED',
    user_id: string
  ): Promise<RoutingRecord> {
    const result = await this.db.query(
      `UPDATE foia_routing r
       SET status = $1, updated_at = NOW()
       FROM foia_requests fr
       WHERE r.id = $2 AND fr.id = r.foia_request_id AND fr.tenant_id = $3
       RETURNING r.*`,
      [status, routing_id, tenant_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Routing record not found or access denied');
    }

    const routing = result.rows[0] as RoutingRecord;

    // Emit status update event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.routing.status.updated',
      entity_id: routing.foia_request_id,
      entity_type: 'foia_request',
      user_id,
      metadata: {
        routing_id,
        status
      },
      timestamp: new Date()
    });

    return routing;
  }
}
