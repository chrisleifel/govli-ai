/**
 * Govli AI FOIA Module - Validation Middleware
 * Zod schema validation with RFC 7807 error format
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation source type
 */
export type ValidationSource = 'body' | 'params' | 'query';

/**
 * RFC 7807 Problem Details
 */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  timestamp: Date;
}

/**
 * Format Zod errors to field-level errors
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }));
}

/**
 * Validate request data against Zod schema
 */
export function validate(schema: ZodSchema, source: ValidationSource = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Replace request data with validated data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const problemDetails: ProblemDetails = {
          type: 'validation_error',
          title: 'Invalid Request',
          status: 400,
          detail: 'Validation failed',
          errors: formatZodErrors(error),
          timestamp: new Date()
        };

        return res.status(400).json(problemDetails);
      }

      // Unknown error
      return res.status(500).json({
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred during validation',
        timestamp: new Date()
      });
    }
  };
}

/**
 * Validate multiple sources
 */
export function validateMultiple(schemas: Partial<Record<ValidationSource, ZodSchema>>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string }> = [];

    for (const [source, schema] of Object.entries(schemas)) {
      try {
        const data = req[source as ValidationSource];
        const validated = schema.parse(data);
        req[source as ValidationSource] = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(...formatZodErrors(error).map(e => ({
            ...e,
            field: `${source}.${e.field}`
          })));
        }
      }
    }

    if (errors.length > 0) {
      const problemDetails: ProblemDetails = {
        type: 'validation_error',
        title: 'Invalid Request',
        status: 400,
        detail: 'Validation failed',
        errors,
        timestamp: new Date()
      };

      return res.status(400).json(problemDetails);
    }

    next();
  };
}