/** Maps raw agent-run error messages to user-facing text. */
export function friendlyRunErrorMessage(raw: string): string {
  if (raw.includes('request_limit')) {
    return 'The agent reached its exploration budget for this message before answering. Ask a more specific question, or retry to give it a fresh budget.';
  }
  return `Error: ${raw}`;
}

/** Maps a thrown AG-UI stream error (e.g. HTTP 429 from the backend) to user-facing text. */
export function friendlyStreamErrorMessage(err: unknown): string {
  const e = err as Error & { status?: number };
  if (e?.status === 429 || (e instanceof Error && e.message.startsWith('HTTP 429'))) {
    return 'You have used all your messages for this hour. The limit resets automatically — please try again later.';
  }
  return `Error: ${e instanceof Error ? e.message : String(err)}`;
}
