/** Maps raw agent-run error messages to user-facing text. */
export function friendlyRunErrorMessage(raw: string): string {
  if (raw.includes('request_limit')) {
    return 'The agent reached its exploration budget for this message before answering. Ask a more specific question, or retry to give it a fresh budget.';
  }
  return `Error: ${raw}`;
}
