import { describe, it, expect } from 'vitest';
import { friendlyRunErrorMessage, friendlyStreamErrorMessage } from '@/lib/agentErrors';

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

describe('friendlyStreamErrorMessage', () => {
  it('maps HTTP 429 errors to a rate-limit explanation', () => {
    const err = Object.assign(new Error('HTTP 429: {"detail":"Rate limit exceeded."}'), {
      status: 429,
      payload: { detail: 'Rate limit exceeded.' },
    });
    const msg = friendlyStreamErrorMessage(err);
    expect(msg).toContain('messages for this hour');
    expect(msg).not.toContain('HTTP 429');
  });

  it('maps message-only 429 errors to the same explanation', () => {
    const msg = friendlyStreamErrorMessage(new Error('HTTP 429: Rate limit exceeded'));
    expect(msg).toContain('messages for this hour');
  });

  it('passes other stream errors through with an Error prefix', () => {
    expect(friendlyStreamErrorMessage(new Error('Connection refused'))).toBe(
      'Error: Connection refused'
    );
  });
});
