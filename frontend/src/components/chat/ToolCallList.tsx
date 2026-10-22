import { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolCall } from '@/types/chat';
import { ToolCallCard, TOOL_LABELS } from './ToolCallCard';
import {
  AgentActivity,
  type AgentActivityItem,
} from '@/components/agents/agent-activity';
import { ThinkingShimmer } from '@/components/agents/loading-states/thinking-shimmer';

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

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}

function formatDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function ToolCallList({ toolCalls, isRunActive = false }: ToolCallListProps) {
  const hasRunning = toolCalls.some((tc) => tc.status === 'running');
  const working = isRunActive || hasRunning;
  const [open, setOpen] = useState(false);
  const [cardOpens, setCardOpens] = useState<Record<string, boolean>>({});

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

  const items: AgentActivityItem[] = useMemo(
    () =>
      toolCalls.map((tc) => {
        const target = toolTarget(tc);
        return {
          id: tc.id,
          type: 'step' as const,
          status: tc.status === 'running' ? ('active' as const) : ('complete' as const),
          label: (
            <span className="block truncate">
              {getToolLabel(tc.name)}
              {target && (
                <span className="ml-1.5 inline-block max-w-[24rem] truncate align-baseline font-mono text-xs text-muted-foreground">
                  {target}
                </span>
              )}
            </span>
          ),
        };
      }),
    [toolCalls],
  );

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

      {/* Deep inspection: Parameters/Response JSON cards, lazily mounted when
          the completed activity is expanded (working shows the stream only). */}
      {!working && open && (
        <div className="mt-2 space-y-2">
          {toolCalls.map((tc, index) => (
            <ToolCallCard
              key={tc.id}
              toolCall={tc}
              index={index}
              isOpen={cardOpens[tc.id] ?? false}
              onToggle={(id) =>
                setCardOpens((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
