import { describe, it, expect } from 'vitest';
import { friendlyRunErrorMessage } from '@/lib/agentErrors';

describe('friendlyRunErrorMessage', () => {
  it('maps request-limit errors to a budget explanation', () => {
    const msg = friendlyRunErrorMessage(
      'The next request would exceed the request_limit of 20'
    );
    expect(msg).toContain('exploration budget');
    expect(msg).not.toContain('request_limit');
  });

  it('passes other errors through with an Error prefix', () => {
    expect(friendlyRunErrorMessage('Something broke')).toBe(
      'Error: Something broke'
    );
  });
});
