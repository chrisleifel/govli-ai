/**
 * FOIA State Machine
 * Enforces valid state transitions for FOIA requests
 */

import { FoiaRequestStatus } from '@govli/foia-shared';

/**
 * Valid state transitions map
 * Key: current status, Value: array of allowed next statuses
 */
const VALID_TRANSITIONS: Record<FoiaRequestStatus, FoiaRequestStatus[]> = {
  PENDING: ['IN_REVIEW', 'DENIED'],
  IN_REVIEW: ['ASSIGNED', 'DENIED'],
  ASSIGNED: ['IN_PROGRESS', 'DENIED'],
  IN_PROGRESS: ['AWAITING_RESPONSE', 'COMPLETED', 'DENIED'],
  AWAITING_RESPONSE: ['IN_PROGRESS', 'COMPLETED', 'DENIED'],
  COMPLETED: ['APPEALED'], // Can only go to APPEALED from COMPLETED
  DENIED: ['APPEALED'], // Can only go to APPEALED from DENIED
  APPEALED: ['IN_REVIEW', 'COMPLETED', 'DENIED'] // Appeal sends back to review or resolves
};

/**
 * State Machine Service
 */
export class StateMachine {
  /**
   * Check if a state transition is valid
   */
  isValidTransition(from: FoiaRequestStatus, to: FoiaRequestStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from];

    if (!allowedTransitions) {
      return false;
    }

    return allowedTransitions.includes(to);
  }

  /**
   * Get all valid next states for a given status
   */
  getValidNextStates(from: FoiaRequestStatus): FoiaRequestStatus[] {
    return VALID_TRANSITIONS[from] || [];
  }

  /**
   * Validate transition and throw error if invalid
   */
  validateTransition(from: FoiaRequestStatus, to: FoiaRequestStatus): void {
    if (!this.isValidTransition(from, to)) {
      throw new InvalidTransitionError(
        `Invalid state transition from ${from} to ${to}. ` +
        `Allowed transitions: ${this.getValidNextStates(from).join(', ')}`
      );
    }
  }

  /**
   * Get transition description
   */
  getTransitionDescription(from: FoiaRequestStatus, to: FoiaRequestStatus): string {
    const descriptions: Record<string, string> = {
      'PENDING->IN_REVIEW': 'Request under initial review',
      'PENDING->DENIED': 'Request denied without review',
      'IN_REVIEW->ASSIGNED': 'Request assigned to officer',
      'IN_REVIEW->DENIED': 'Request denied after review',
      'ASSIGNED->IN_PROGRESS': 'Officer started processing',
      'ASSIGNED->DENIED': 'Request denied',
      'IN_PROGRESS->AWAITING_RESPONSE': 'Waiting for additional information',
      'IN_PROGRESS->COMPLETED': 'Request completed',
      'IN_PROGRESS->DENIED': 'Request denied during processing',
      'AWAITING_RESPONSE->IN_PROGRESS': 'Resumed processing',
      'AWAITING_RESPONSE->COMPLETED': 'Completed with available information',
      'AWAITING_RESPONSE->DENIED': 'Denied due to non-response',
      'COMPLETED->APPEALED': 'Requester filed appeal',
      'DENIED->APPEALED': 'Requester appealed denial',
      'APPEALED->IN_REVIEW': 'Appeal under review',
      'APPEALED->COMPLETED': 'Appeal granted',
      'APPEALED->DENIED': 'Appeal denied'
    };

    const key = `${from}->${to}`;
    return descriptions[key] || `Transition from ${from} to ${to}`;
  }

  /**
   * Check if status is terminal (no further transitions)
   */
  isTerminalState(status: FoiaRequestStatus): boolean {
    const nextStates = this.getValidNextStates(status);
    return nextStates.length === 0;
  }

  /**
   * Get all possible transition paths from a status
   */
  getTransitionPaths(from: FoiaRequestStatus, maxDepth: number = 3): string[][] {
    const paths: string[][] = [];

    const explore = (current: FoiaRequestStatus, path: string[], depth: number) => {
      if (depth >= maxDepth) {
        paths.push([...path]);
        return;
      }

      const nextStates = this.getValidNextStates(current);

      if (nextStates.length === 0) {
        paths.push([...path]);
        return;
      }

      for (const next of nextStates) {
        explore(next, [...path, next], depth + 1);
      }
    };

    explore(from, [from], 0);
    return paths;
  }
}

/**
 * Invalid Transition Error
 */
export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Singleton instance
 */
export const stateMachine = new StateMachine();
