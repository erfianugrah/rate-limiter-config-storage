import { describe, it, expect } from 'vitest';
import { validateRule } from '../../src-ts/utils/validation/enhanced-validation';

describe('Short form operators validation', () => {
  it('should accept the eq operator (short form of equals)', () => {
    const rule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Test rule for short form operators',
      rateLimit: {
        limit: 10,
        period: 60
      },
      fingerprint: {
        parameters: ['ip']
      },
      initialMatch: {
        conditions: [
          {
            field: 'url.pathname',
            operator: 'eq', // Short form
            value: '/api/test'
          }
        ],
        action: {
          type: 'block'
        }
      },
      elseIfActions: []
    };

    const result = validateRule(rule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept multiple short form operators', () => {
    const rule = {
      id: 'test-rule-2',
      name: 'Test Rule 2',
      description: 'Test rule for multiple short form operators',
      rateLimit: {
        limit: 10,
        period: 60
      },
      fingerprint: {
        parameters: ['ip']
      },
      initialMatch: {
        conditions: [
          {
            field: 'url.pathname',
            operator: 'eq', // Short form for equals
            value: '/api/test'
          }
        ],
        action: {
          type: 'block'
        }
      },
      elseIfActions: [
        {
          conditions: [
            {
              field: 'headers.content-type',
              operator: 'contains', // Already normalized
              value: 'json'
            }
          ],
          action: {
            type: 'allow'
          }
        },
        {
          conditions: [
            {
              field: 'method',
              operator: 'ne', // Short form for notEquals
              value: 'GET'
            }
          ],
          action: {
            type: 'log'
          }
        }
      ]
    };

    const result = validateRule(rule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});