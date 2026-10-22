import { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolCall } from '@/types/chat';
import {
  AgentActivity,
  type AgentActivityItem,
} from '@/components/agents/agent-activity';

interface ToolCallListProps {
  toolCalls: ToolCall[];
  /** True while the agent run is still streaming (tools or text). */
  isRunActive?: boolean;
}

/** Extract the interesting argument as the row's target, tolerating
 * partially-streamed JSON (empty until the args parse). */
function toolTarget(toolCall: ToolCall): string {
  const raw = toolCall.args;
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const value =
      parsed.subdir ?? parsed.filepath ?? parsed.repo_target ?? parsed.pattern ?? parsed.symbol_name;
    return typeof value === 'string' && value.length > 0
      ? value === '.'
        ? 'repository root'
        : value
      : '';
  } catch {
    return '';
  }
}

/** Turn each tool call into one beUI activity row, mirroring the
 * agent-activity "Tool calls" style: read/search events with monospace
 * targets, and never the raw input/output payloads. */
function toActivityItem(toolCall: ToolCall): AgentActivityItem {
  const target = toolTarget(toolCall);

  switch (toolCall.name) {
    case 'initialize_repo':
      return {
        id: toolCall.id,
        type: 'step',
        label: 'Initializing repository',
        status: toolCall.status === 'running' ? 'active' : 'complete',
      };
    case 'search_code':
      return { id: toolCall.id, type: 'search', query: target || '…' };
    case 'find_references':
      return {
        id: toolCall.id,
        type: 'search',
        query: target ? `references of ${target}` : '…',
      };
    default:
      return {
        id: toolCall.id,
        type: 'tool',
        action: 'read',
        target:
          target ||
          (toolCall.name === 'list_files'
            ? 'repository root'
            : toolCall.name === 'get_file_structure'
              ? 'repository tree'
              : '…'),
      };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function ToolCallList({ toolCalls, isRunActive = false }: ToolCallListProps) {
  const hasRunning = toolCalls.some((tc) => tc.status === 'running');
  const working = isRunActive || hasRunning;
  const [open, setOpen] = useState(false);

  // Run duration: starts with the first streamed tool (or run start) and
  // freezes when the run completes.
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!working) return;
    if (startRef.current === null) {
      startRef.current = Date.now();
    }
    const timer = setInterval(() => {
      setElapsed((Date.now() - (startRef.current ?? Date.now())) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, [working]);

  const items = useMemo(() => toolCalls.map(toActivityItem), [toolCalls]);

  const toolCount = toolCalls.length;
  const summary = (
    <>
      Ran {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
      {elapsed > 0.05 && (
        <span className="ml-1.5 tabular-nums text-muted-foreground/70">
          · {formatDuration(elapsed)}
        </span>
      )}
    </>
  );

  return (
    <div className="mb-4 w-full">
      <AgentActivity
        items={items}
        status={working ? 'working' : 'complete'}
        duration={elapsed}
        activeLabel="Exploring the repository…"
        summary={summary}
        collapseOnComplete
        open={open}
        onOpenChange={setOpen}
        maxHeight={176}
      />
    </div>
  );
}
