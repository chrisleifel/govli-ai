/**
 * State Machine Tests
 */

import { StateMachine, InvalidTransitionError } from '../services/stateMachine';

describe('StateMachine', () => {
  let stateMachine: StateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine();
  });

  describe('Valid Transitions', () => {
    it('should allow PENDING -> IN_REVIEW', () => {
      expect(stateMachine.isValidTransition('PENDING', 'IN_REVIEW')).toBe(true);
    });

    it('should allow IN_REVIEW -> ASSIGNED', () => {
      expect(stateMachine.isValidTransition('IN_REVIEW', 'ASSIGNED')).toBe(true);
    });

    it('should allow ASSIGNED -> IN_PROGRESS', () => {
      expect(stateMachine.isValidTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    });

    it('should allow IN_PROGRESS -> AWAITING_RESPONSE', () => {
      expect(stateMachine.isValidTransition('IN_PROGRESS', 'AWAITING_RESPONSE')).toBe(true);
    });

    it('should allow IN_PROGRESS -> COMPLETED', () => {
      expect(stateMachine.isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('should allow COMPLETED -> APPEALED', () => {
      expect(stateMachine.isValidTransition('COMPLETED', 'APPEALED')).toBe(true);
    });

    it('should allow DENIED -> APPEALED', () => {
      expect(stateMachine.isValidTransition('DENIED', 'APPEALED')).toBe(true);
    });

    it('should allow APPEALED -> IN_REVIEW', () => {
      expect(stateMachine.isValidTransition('APPEALED', 'IN_REVIEW')).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    it('should reject PENDING -> COMPLETED (skipping steps)', () => {
      expect(stateMachine.isValidTransition('PENDING', 'COMPLETED')).toBe(false);
    });

    it('should reject COMPLETED -> IN_PROGRESS (backwards)', () => {
      expect(stateMachine.isValidTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    });

    it('should reject IN_REVIEW -> IN_PROGRESS (skipping ASSIGNED)', () => {
      expect(stateMachine.isValidTransition('IN_REVIEW', 'IN_PROGRESS')).toBe(false);
    });

    it('should reject PENDING -> APPEALED (invalid path)', () => {
      expect(stateMachine.isValidTransition('PENDING', 'APPEALED')).toBe(false);
    });

    it('should reject ASSIGNED -> AWAITING_RESPONSE (skipping IN_PROGRESS)', () => {
      expect(stateMachine.isValidTransition('ASSIGNED', 'AWAITING_RESPONSE')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should throw InvalidTransitionError for invalid transitions', () => {
      expect(() => {
        stateMachine.validateTransition('PENDING', 'COMPLETED');
      }).toThrow(InvalidTransitionError);
    });

    it('should include allowed transitions in error message', () => {
      try {
        stateMachine.validateTransition('PENDING', 'COMPLETED');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidTransitionError);
        expect((error as Error).message).toContain('Invalid state transition from PENDING to COMPLETED');
        expect((error as Error).message).toContain('Allowed transitions: IN_REVIEW, DENIED');
      }
    });

    it('should not throw for valid transitions', () => {
      expect(() => {
        stateMachine.validateTransition('PENDING', 'IN_REVIEW');
      }).not.toThrow();
    });
  });

  describe('getValidNextStates', () => {
    it('should return correct next states for PENDING', () => {
      const nextStates = stateMachine.getValidNextStates('PENDING');
      expect(nextStates).toEqual(['IN_REVIEW', 'DENIED']);
    });

    it('should return correct next states for IN_PROGRESS', () => {
      const nextStates = stateMachine.getValidNextStates('IN_PROGRESS');
      expect(nextStates).toEqual(['AWAITING_RESPONSE', 'COMPLETED', 'DENIED']);
    });

    it('should return single next state for COMPLETED', () => {
      const nextStates = stateMachine.getValidNextStates('COMPLETED');
      expect(nextStates).toEqual(['APPEALED']);
    });
  });

  describe('isTerminalState', () => {
    it('should return false for non-terminal states', () => {
      expect(stateMachine.isTerminalState('PENDING')).toBe(false);
      expect(stateMachine.isTerminalState('IN_PROGRESS')).toBe(false);
    });

    it('should return true for states with only appeal option', () => {
      // COMPLETED and DENIED have APPEALED as next state, so not truly terminal
      expect(stateMachine.isTerminalState('COMPLETED')).toBe(false);
      expect(stateMachine.isTerminalState('DENIED')).toBe(false);
    });
  });

  describe('getTransitionDescription', () => {
    it('should return description for known transitions', () => {
      const desc = stateMachine.getTransitionDescription('PENDING', 'IN_REVIEW');
      expect(desc).toBe('Request under initial review');
    });

    it('should return generic description for unknown transitions', () => {
      const desc = stateMachine.getTransitionDescription('PENDING', 'COMPLETED');
      expect(desc).toBe('Transition from PENDING to COMPLETED');
    });
  });

  describe('getTransitionPaths', () => {
    it('should return valid transition paths', () => {
      const paths = stateMachine.getTransitionPaths('PENDING', 2);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0][0]).toBe('PENDING');
    });

    it('should respect max depth', () => {
      const paths = stateMachine.getTransitionPaths('PENDING', 1);
      paths.forEach(path => {
        expect(path.length).toBeLessThanOrEqual(2); // Initial state + 1 transition
      });
    });
  });
});
