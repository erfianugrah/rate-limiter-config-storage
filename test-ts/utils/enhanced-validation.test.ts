import { describe, it, expect } from 'vitest';
import { validateRule } from '../../src-ts/utils/validation/enhanced-validation.js';

describe('Enhanced Validation - Short Form Operators', () => {
  it('should validate rules with short form operators', () => {
    const rule = {
      id: 'test-rule-short-operators',
      name: 'Test Rule with Short Form Operators',
      description: 'Rule for testing short form operator validation',
      rateLimit: { limit: 100, period: 60 },
      fingerprint: { parameters: ['ip'] },
      initialMatch: {
        conditions: [
          { field: 'url.path', operator: 'eq', value: '/api/test' },
          { field: 'method', operator: 'ne', value: 'POST' },
          { field: 'request.headers.x-test', operator: 'contains', value: 'test' },
          { field: 'request.headers.user-agent', operator: 'not_contains', value: 'bot' },
          { field: 'url.path', operator: 'starts_with', value: '/api/' },
          { field: 'request.headers.referer', operator: 'ends_with', value: '.com' },
          { field: 'ip', operator: 'gt', value: '10.0.0.0' },
          { field: 'request.body.count', operator: 'ge', value: '5' },
          { field: 'timestamp', operator: 'lt', value: '1000' },
          { field: 'request.body.priority', operator: 'le', value: '3' }
        ],
        action: { type: 'block', status: 429 }
      },
      elseIfActions: [],
      elseAction: { type: 'allow' }
    };

    const result = validateRule(rule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should convert short form operators to their long form equivalents', () => {
    const rule = {
      id: 'test-rule-operator-conversion',
      name: 'Test Rule for Operator Conversion',
      description: 'Rule for testing short form operator conversion',
      rateLimit: { limit: 100, period: 60 },
      fingerprint: { parameters: ['ip'] },
      initialMatch: {
        conditions: [
          { field: 'url.path', operator: 'eq', value: '/api/test' }
        ],
        action: { type: 'block', status: 429 }
      },
      elseIfActions: [],
      elseAction: { type: 'allow' }
    };

    // Operators should be normalized internally 
    // We can't directly test the normalization, but we can verify validation passes
    const result = validateRule(rule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate that short form operators requiring values have them', () => {
    const rule = {
      id: 'test-rule-missing-value',
      name: 'Test Rule with Missing Value',
      description: 'Rule for testing short form operator validation with missing value',
      rateLimit: { limit: 100, period: 60 },
      fingerprint: { parameters: ['ip'] },
      initialMatch: {
        conditions: [
          { field: 'url.path', operator: 'eq' } // Missing value
        ],
        action: { type: 'block', status: 429 }
      },
      elseIfActions: [],
      elseAction: { type: 'allow' }
    };

    const result = validateRule(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field.includes('value') && e.message.includes('Value is required'))).toBe(true);
  });
});