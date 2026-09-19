import { describe, it, expect } from 'vitest';
import { parseQuotaHeaders } from '@/lib/quota';

describe('parseQuotaHeaders', () => {
  it('parses limit and remaining from valid headers', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': '20',
      'X-RateLimit-Remaining': '13',
    });
    expect(parseQuotaHeaders(headers)).toEqual({ limit: 20, remaining: 13 });
  });

  it('returns null when headers are missing', () => {
    expect(parseQuotaHeaders(new Headers())).toBeNull();
  });

  it('returns null when only one header is present', () => {
    const headers = new Headers({ 'X-RateLimit-Remaining': '5' });
    expect(parseQuotaHeaders(headers)).toBeNull();
  });

  it('returns null for non-numeric values', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': 'twenty',
      'X-RateLimit-Remaining': '5',
    });
    expect(parseQuotaHeaders(headers)).toBeNull();
  });

  it('returns null for a non-positive limit', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': '0',
    });
    expect(parseQuotaHeaders(headers)).toBeNull();
  });

  it('clamps a negative remaining count to zero', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': '20',
      'X-RateLimit-Remaining': '-1',
    });
    expect(parseQuotaHeaders(headers)).toEqual({ limit: 20, remaining: 0 });
  });
});
