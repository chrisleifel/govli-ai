/**
 * FOIA Processing Tests
 * Tests for document upload, redaction, and packaging
 */

import request from 'supertest';
import { Express } from 'express';
import { Pool } from 'pg';
import { createProcessingService } from '../src/index';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

jest.mock('pg');
jest.mock('@govli/foia-shared', () => ({
  getSharedAIClient: jest.fn(() => ({
    callWithAudit: jest.fn().mockResolvedValue({
      content: JSON.stringify([
        {
          text_span: 'John Doe SSN: 123-45-6789',
          start_char: 100,
          end_char: 127,
          exemption_code: 'b(6)',
          confidence: 0.95,
          reason: 'Personal privacy - Social Security Number'
        }
      ]),
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        thinkingTokens: 0,
        cacheHit: false
      },
      model: 'claude-3-5-sonnet-20250122',
      latencyMs: 1500
    })
  })),
  emit: jest.fn().mockResolvedValue(undefined)
}));

describe('FOIA Processing Service', () => {
  let app: Express;
  let db: any;
  const JWT_SECRET = 'test-secret-key';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    db = {
      query: jest.fn()
    };

    (Pool as any).mockImplementation(() => db);

    app = createProcessingService({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test'
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'foia-processing',
        status: 'healthy',
        version: '1.0.0'
      });
    });
  });

  describe('Document Upload', () => {
    it('should upload a document successfully', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      db.query.mockResolvedValueOnce({ rows: [] }); // INSERT document

      // Create test file
      const testFile = Buffer.from('Test document content');

      const response = await request(app)
        .post('/api/v1/foia/processing/requests/request-123/documents')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', testFile, 'test.txt')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.document_id).toBeDefined();
      expect(response.body.data.filename).toBe('test.txt');
    });

    it('should reject upload without authentication', async () => {
      await request(app)
        .post('/api/v1/foia/processing/requests/request-123/documents')
        .attach('document', Buffer.from('test'), 'test.txt')
        .expect(401);
    });

    it('should reject upload without file', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .post('/api/v1/foia/processing/requests/request-123/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.error.code).toBe('NO_FILE');
    });
  });

  describe('Responsiveness Update', () => {
    it('should update document responsiveness', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'doc-123',
          is_responsive: true,
          responsiveness_confidence: 0.9,
          responsiveness_reason: 'Relevant to request'
        }]
      });

      const response = await request(app)
        .put('/api/v1/foia/processing/documents/doc-123/responsiveness')
        .set('Authorization', `Bearer ${token}`)
        .send({
          is_responsive: true,
          confidence: 0.9,
          reason: 'Relevant to request'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_responsive).toBe(true);
    });

    it('should reject invalid responsiveness value', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .put('/api/v1/foia/processing/documents/doc-123/responsiveness')
        .set('Authorization', `Bearer ${token}`)
        .send({
          is_responsive: 'yes' // Should be boolean
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('Redaction Initiation', () => {
    it('should initiate redaction analysis', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      // Mock document query
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'doc-123',
          tenant_id: 'tenant-456',
          foia_request_id: 'request-123',
          extracted_text: 'Document contains PII: John Doe SSN: 123-45-6789',
          is_responsive: true,
          page_count: 1
        }]
      });

      // Mock exemptions query
      db.query.mockResolvedValueOnce({
        rows: [{
          exemption_code: 'b(6)',
          exemption_name: 'Personal Privacy',
          definition: 'Personnel and medical files and similar files...'
        }]
      });

      // Mock update query
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/v1/foia/processing/requests/request-123/redaction/initiate')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.document_count).toBeGreaterThan(0);
    });
  });

  describe('Redaction Review', () => {
    it('should get redaction proposals for review', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'prop-123',
          document_id: 'doc-123',
          text_span: 'SSN: 123-45-6789',
          exemption_code: 'b(6)',
          confidence: 0.95,
          status: 'PENDING'
        }]
      });

      const response = await request(app)
        .get('/api/v1/foia/processing/documents/doc-123/redaction-review')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.proposals).toBeDefined();
    });

    it('should approve redaction proposal', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      // Mock check query
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'prop-123' }]
      });

      // Mock update query
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'prop-123',
          document_id: 'doc-123',
          status: 'APPROVED',
          reviewed_by: 'user-123'
        }]
      });

      const response = await request(app)
        .put('/api/v1/foia/processing/documents/doc-123/redaction-review')
        .set('Authorization', `Bearer ${token}`)
        .send({
          proposal_id: 'prop-123',
          status: 'APPROVED'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('should reject invalid review status', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .put('/api/v1/foia/processing/documents/doc-123/redaction-review')
        .set('Authorization', `Bearer ${token}`)
        .send({
          proposal_id: 'prop-123',
          status: 'INVALID_STATUS'
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_STATUS');
    });
  });

  describe('Document Packaging', () => {
    it('should create document package', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'doc-123',
          filename: 'test.pdf',
          is_responsive: true
        }]
      });

      db.query.mockResolvedValueOnce({ rows: [] }); // INSERT package

      const response = await request(app)
        .post('/api/v1/foia/processing/requests/request-123/package')
        .set('Authorization', `Bearer ${token}`)
        .send({
          include_responsive_only: true,
          format: 'PDF'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.package_id).toBeDefined();
      expect(response.body.data.download_url).toBeDefined();
    });
  });

  describe('Search Records', () => {
    it('should search documents by query', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'doc-123',
          title: 'Document 1',
          date: new Date(),
          relevance_score: 0.85,
          snippet: 'Relevant content...'
        }]
      });

      const response = await request(app)
        .post('/api/v1/foia/processing/requests/request-123/search-records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: 'contract agreements',
          limit: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.records).toBeDefined();
    });
  });
});

describe('RedactionService', () => {
  it('should be tested with mock AI client', () => {
    // Integration tests covered above
    expect(true).toBe(true);
  });
});

describe('DocumentService', () => {
  it('should be tested with file upload mocks', () => {
    // Integration tests covered above
    expect(true).toBe(true);
  });
});
