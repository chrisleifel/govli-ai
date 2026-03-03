/**
 * Govli AI FOIA Module - RBAC Middleware
 * Role-based access control with role hierarchy
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { Role } from '@govli/foia-shared';

/**
 * Role Hierarchy (higher = more permissions)
 */
const ROLE_HIERARCHY: Record<string, number> = {
  platform_admin: 100,
  foia_admin: 90,
  foia_supervisor: 80,
  foia_coordinator: 70,
  foia_officer: 60,
  reviewer: 50,
  analyst: 40,
  clerk: 30,
  public: 10
};

/**
 * Check if user has required role or higher
 */
function hasRequiredRole(userRoles: string[], requiredRoles: string[]): boolean {
  // Get highest user role level
  const userLevel = Math.max(
    ...userRoles.map(role => ROLE_HIERARCHY[role.toLowerCase()] || 0)
  );

  // Get minimum required role level
  const requiredLevel = Math.min(
    ...requiredRoles.map(role => ROLE_HIERARCHY[role.toLowerCase()] || Infinity)
  );

  return userLevel >= requiredLevel;
}

/**
 * Require specific role(s)
 * User must have at least one of the required roles or a higher role in the hierarchy
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.roles) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        timestamp: new Date()
      });
    }

    const userRoles = req.auth.roles.map(r => r.toLowerCase());
    const requiredRoles = roles.map(r => r.toLowerCase());

    if (!hasRequiredRole(userRoles, requiredRoles)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'insufficient_permissions',
          message: `Access denied. Required roles: ${roles.join(', ')}`,
          required: roles,
          actual: req.auth.roles
        },
        timestamp: new Date()
      });
    }

    next();
  };
}

/**
 * Require ANY of the specified roles
 */
export function requireAnyRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.roles) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        timestamp: new Date()
      });
    }

    const userRoles = req.auth.roles.map(r => r.toLowerCase());
    const requiredRoles = roles.map(r => r.toLowerCase());

    const hasAnyRole = userRoles.some(userRole =>
      requiredRoles.includes(userRole) ||
      hasRequiredRole([userRole], requiredRoles)
    );

    if (!hasAnyRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'insufficient_permissions',
          message: `Access denied. Required one of: ${roles.join(', ')}`,
          required: roles,
          actual: req.auth.roles
        },
        timestamp: new Date()
      });
    }

    next();
  };
}

/**
 * Require ALL of the specified roles
 */
export function requireAllRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.roles) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        timestamp: new Date()
      });
    }

    const userRoles = req.auth.roles.map(r => r.toLowerCase());
    const requiredRoles = roles.map(r => r.toLowerCase());

    const hasAllRoles = requiredRoles.every(requiredRole =>
      userRoles.includes(requiredRole)
    );

    if (!hasAllRoles) {
      const missingRoles = requiredRoles.filter(r => !userRoles.includes(r));
      return res.status(403).json({
        success: false,
        error: {
          code: 'insufficient_permissions',
          message: `Access denied. Missing roles: ${missingRoles.join(', ')}`,
          required: roles,
          actual: req.auth.roles
        },
        timestamp: new Date()
      });
    }

    next();
  };
}