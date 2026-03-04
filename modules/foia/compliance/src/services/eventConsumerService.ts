/**
 * FOIA Event Consumer Service
 * Subscribes to Redis Streams and processes GovliEvent messages
 */

import Redis from 'ioredis';
import { Pool } from 'pg';
import { AuditLogService } from './auditLogService';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const STREAM_NAME = 'govli:events';
const CONSUMER_GROUP = 'compliance.foia';
const CONSUMER_NAME = `compliance-${process.pid}`;

/**
 * GovliEvent structure from shared
 */
interface GovliEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  entity_id: string;
  entity_type: string;
  user_id?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Event Consumer Service
 */
export class EventConsumerService {
  private redis: Redis;
  private auditLogService: AuditLogService;
  private running: boolean = false;

  constructor(db: Pool) {
    this.redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.auditLogService = new AuditLogService(db);
  }

  /**
   * Start consuming events from Redis Streams
   */
  async start(): Promise<void> {
    try {
      // Create consumer group if it doesn't exist
      try {
        await this.redis.xgroup(
          'CREATE',
          STREAM_NAME,
          CONSUMER_GROUP,
          '0',
          'MKSTREAM'
        );
        console.log(`[EventConsumer] Created consumer group: ${CONSUMER_GROUP}`);
      } catch (error: any) {
        if (error.message && error.message.includes('BUSYGROUP')) {
          console.log(`[EventConsumer] Consumer group already exists: ${CONSUMER_GROUP}`);
        } else {
          throw error;
        }
      }

      this.running = true;
      console.log(`[EventConsumer] Starting event consumer: ${CONSUMER_NAME}`);

      // Start consuming loop
      await this.consumeLoop();
    } catch (error) {
      console.error('[EventConsumer] Start error:', error);
      throw error;
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    console.log('[EventConsumer] Stopped event consumer');
  }

  /**
   * Main consume loop
   */
  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        // Read from stream with consumer group
        // Block for 5 seconds waiting for new messages
        const results = await this.redis.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          CONSUMER_NAME,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          STREAM_NAME,
          '>'
        ) as any;

        if (!results) {
          // No messages, continue
          continue;
        }

        // Process each message
        for (const [stream, messages] of results as any) {
          for (const [id, fields] of messages as any) {
            await this.processMessage(id, fields);
          }
        }
      } catch (error) {
        if (this.running) {
          console.error('[EventConsumer] Consume loop error:', error);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(messageId: string, fields: string[]): Promise<void> {
    try {
      // Parse Redis fields (key-value pairs)
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }

      // Parse event data
      const event: GovliEvent = {
        id: data.id || messageId,
        tenant_id: data.tenant_id,
        event_type: data.event_type,
        entity_id: data.entity_id,
        entity_type: data.entity_type,
        user_id: data.user_id,
        metadata: data.metadata ? JSON.parse(data.metadata) : {},
        timestamp: new Date(data.timestamp || Date.now())
      };

      // Validate event
      if (!event.tenant_id || !event.event_type || !event.entity_id) {
        console.warn('[EventConsumer] Invalid event, skipping:', messageId);
        await this.ackMessage(messageId);
        return;
      }

      // Log to audit log (INSERT-ONLY operation)
      await this.auditLogService.logEvent(event.tenant_id, {
        event_id: event.id,
        event_type: event.event_type,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        user_id: event.user_id,
        metadata: event.metadata || {},
        timestamp: event.timestamp
      });

      console.log(`[EventConsumer] Processed event: ${event.event_type} for ${event.entity_id}`);

      // Acknowledge message
      await this.ackMessage(messageId);
    } catch (error) {
      console.error('[EventConsumer] Process message error:', error);
      // Don't ack failed messages - they'll be retried
    }
  }

  /**
   * Acknowledge message as processed
   */
  private async ackMessage(messageId: string): Promise<void> {
    try {
      await this.redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
    } catch (error) {
      console.error('[EventConsumer] Ack error:', error);
    }
  }

  /**
   * Get pending messages count
   */
  async getPendingCount(): Promise<number> {
    try {
      const result = await this.redis.xpending(
        STREAM_NAME,
        CONSUMER_GROUP,
        '-',
        '+',
        1
      );

      if (!result || result.length === 0) {
        return 0;
      }

      return parseInt(result[0] as string);
    } catch (error) {
      console.error('[EventConsumer] Get pending count error:', error);
      return 0;
    }
  }

  /**
   * Check if consumer is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
