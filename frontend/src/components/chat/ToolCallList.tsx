import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ToolCall } from '@/types/chat';
import { ToolCallCard } from './ToolCallCard';

interface ToolCallListProps {
  toolCalls: ToolCall[];
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  const runningTools = useMemo(
    () => toolCalls.filter((tc) => tc.status === 'running'),
    [toolCalls]
  );

  // Keep running tools and the most recent calls visible while collapsed.
  const { visibleToolCalls, hiddenCount } = useMemo(() => {
    if (toolCalls.length <= 3 || isExpanded) {
      return { visibleToolCalls: toolCalls, hiddenCount: 0 };
    }
    const keep = new Set<string>();
    runningTools.forEach((tc) => keep.add(tc.id));
    toolCalls.slice(-2).forEach((tc) => keep.add(tc.id));
    keep.add(toolCalls[0].id);
    const visible = toolCalls.filter((tc) => keep.has(tc.id));
    return { visibleToolCalls: visible, hiddenCount: toolCalls.length - visible.length };
  }, [toolCalls, runningTools, isExpanded]);

  const toggleTool = (id: string) => {
    setOverrides((prev) => {
      const current = prev[id] ?? false;
      return { ...prev, [id]: !current };
    });
  };

  return (
    <div className="mb-4 w-full space-y-2">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/20"
        >
          <ChevronDown className="h-3 w-3" />
          Show {hiddenCount} earlier tool call{hiddenCount === 1 ? '' : 's'}
        </button>
      )}

      <div className="w-full space-y-2">
        {visibleToolCalls.map((tc, index) => (
          <ToolCallCard
            key={tc.id}
            toolCall={tc}
            index={index}
            isOpen={overrides[tc.id] ?? tc.status === 'running'}
            onToggle={toggleTool}
          />
        ))}
      </div>

      {toolCalls.length > 3 && isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/20"
        >
          Show less
        </button>
      )}
    </div>
  );
}