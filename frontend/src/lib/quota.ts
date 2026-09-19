import type { QuotaState } from '@/types/chat';

/**
 * Reads the per-IP message quota headers the backend sets on every /agui
 * response (and on 429). Returns null when the headers are absent or invalid.
 */
export function parseQuotaHeaders(headers: Headers): QuotaState | null {
  const limit = Number(headers.get('X-RateLimit-Limit'));
  const remaining = Number(headers.get('X-RateLimit-Remaining'));
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) {
    return null;
  }
  return {
    limit: Math.round(limit),
    remaining: Math.max(0, Math.round(remaining)),
  };
}
