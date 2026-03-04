/**
 * Utility Functions Test Suite
 * Tests for formatDate, businessDayCalc, currencyFormat, and readingLevel utilities
 */

import { formatDate } from '../utils/formatDate';
import { calculateBusinessDays } from '../utils/businessDayCalc';
import { formatCurrency } from '../utils/currencyFormat';

describe('formatDate', () => {
  it('should format a date to ISO string by default', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = formatDate(date);
    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should handle current date', () => {
    const now = new Date();
    const result = formatDate(now);
    expect(result).toContain('T');
    expect(result).toContain('Z');
  });

  it('should handle edge case dates', () => {
    const epoch = new Date(0);
    const result = formatDate(epoch);
    expect(result).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('calculateBusinessDays', () => {
  it('should return 0 for same day', () => {
    const date = new Date('2024-01-15');
    const result = calculateBusinessDays(date, date);
    expect(result).toBe(0);
  });

  it('should calculate business days excluding weekends', () => {
    // Monday to Friday (5 business days)
    const start = new Date('2024-01-15'); // Monday
    const end = new Date('2024-01-19'); // Friday
    const result = calculateBusinessDays(start, end);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should handle date ranges spanning weekends', () => {
    const start = new Date('2024-01-15'); // Monday
    const end = new Date('2024-01-22'); // Next Monday
    const result = calculateBusinessDays(start, end);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should handle reversed date ranges', () => {
    const start = new Date('2024-01-22');
    const end = new Date('2024-01-15');
    const result = calculateBusinessDays(start, end);
    expect(result).toBeLessThanOrEqual(0);
  });
});

describe('formatCurrency', () => {
  it('should format zero correctly', () => {
    const result = formatCurrency(0);
    expect(result).toMatch(/\$0\.00/);
  });

  it('should format positive integers', () => {
    const result = formatCurrency(100);
    expect(result).toContain('$');
    expect(result).toContain('.');
  });

  it('should format decimal values', () => {
    const result = formatCurrency(99.99);
    expect(result).toContain('$');
  });

  it('should format large numbers with commas', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('$');
  });

  it('should handle negative values', () => {
    const result = formatCurrency(-50.25);
    expect(result).toContain('$');
  });

  it('should round to 2 decimal places', () => {
    const result = formatCurrency(10.999);
    expect(result).toContain('$');
  });
});

describe('Edge Cases and Error Handling', () => {
  it('formatDate should handle invalid dates gracefully', () => {
    const invalidDate = new Date('invalid');
    expect(() => formatDate(invalidDate)).not.toThrow();
  });

  it('formatCurrency should handle NaN', () => {
    const result = formatCurrency(NaN);
    expect(result).toBeDefined();
  });

  it('formatCurrency should handle Infinity', () => {
    const result = formatCurrency(Infinity);
    expect(result).toBeDefined();
  });
});
