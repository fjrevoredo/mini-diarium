import { describe, it, expect } from 'vitest';
import { getTodayString, formatDate, isValidDate, addDays, addMonths } from './dates';

describe('dates utility functions', () => {
  describe('getTodayString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = getTodayString();

      // Should match YYYY-MM-DD format
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return current date', () => {
      const today = getTodayString();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const expected = `${year}-${month}-${day}`;

      expect(today).toBe(expected);
    });
  });

  describe('formatDate', () => {
    it('should format date for display', () => {
      const formatted = formatDate('2024-01-15');

      // Should include day, month, and year
      expect(formatted).toContain('2024');
      expect(formatted).toContain('15');
      expect(formatted).toContain('January');
    });

    it('should handle different months', () => {
      const jan = formatDate('2024-01-01');
      const dec = formatDate('2024-12-31');

      expect(jan).toContain('January');
      expect(dec).toContain('December');
    });
  });

  describe('isValidDate', () => {
    it('should validate correct date strings', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate('2024-02-29')).toBe(true); // Leap year
    });

    it('should reject invalid date strings', () => {
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDate('2024-01-32')).toBe(false); // Invalid day
    });
  });

  describe('addDays', () => {
    it('should add days correctly', () => {
      expect(addDays('2024-01-15', 1)).toBe('2024-01-16');
      expect(addDays('2024-01-15', 7)).toBe('2024-01-22');
      expect(addDays('2024-01-31', 1)).toBe('2024-02-01'); // Month boundary
    });

    it('should subtract days with negative values', () => {
      expect(addDays('2024-01-15', -1)).toBe('2024-01-14');
      expect(addDays('2024-02-01', -1)).toBe('2024-01-31'); // Month boundary
    });
  });

  describe('addMonths', () => {
    it('should add months correctly', () => {
      expect(addMonths('2024-01-15', 1)).toBe('2024-02-15');
      expect(addMonths('2024-01-15', 12)).toBe('2025-01-15'); // Year boundary
    });

    it('should subtract months with negative values', () => {
      expect(addMonths('2024-02-15', -1)).toBe('2024-01-15');
      expect(addMonths('2024-01-15', -1)).toBe('2023-12-15'); // Year boundary
    });
  });
});
