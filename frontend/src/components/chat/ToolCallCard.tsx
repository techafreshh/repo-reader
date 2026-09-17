import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  FolderTree,
  FileText,
  Search,
  ListTree,
  GitBranch,
  Braces,
  Download,
  Wrench,
  Copy,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolCall } from '@/types/chat';

const TOOL_ICONS: Record<string, LucideIcon> = {
  initialize_repo: Download,
  list_files: FolderTree,
  read_file: FileText,
  search_code: Search,
  get_file_structure: ListTree,
  find_references: GitBranch,
  analyze_python_ast: Braces,
};

const TOOL_LABELS: Record<string, string> = {
  initialize_repo: 'Initializing repository',
  list_files: 'Listing files',
  read_file: 'Reading file',
  search_code: 'Searching code',
  get_file_structure: 'Mapping structure',
  find_references: 'Tracing references',
  analyze_python_ast: 'Analyzing Python AST',
};

function getToolIcon(name: string): LucideIcon {
  return TOOL_ICONS[name] ?? Wrench;
}

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}

function prettyJson(raw?: string): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function formatArgsSummary(raw?: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      if (entries.length === 0) return null;
      return entries
        .map(([key, value]) => {
          const val = typeof value === 'string' ? value : JSON.stringify(value);
          const short = val.length > 56 ? `${val.slice(0, 53)}…` : val;
          return `${key}: ${short}`;
        })
        .join('  ·  ');
    }
  } catch {
    /* fall through to raw */
  }
  const trimmed = raw.trim();
  return trimmed.length > 70 ? `${trimmed.slice(0, 67)}…` : trimmed || null;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
  isOpen: boolean;
  onToggle: (id: string) => void;
  index: number;
}

export function ToolCallCard({ toolCall, isOpen, onToggle, index }: ToolCallCardProps) {
  const isRunning = toolCall.status === 'running';
  const isError = toolCall.status === 'error';
  const Icon = getToolIcon(toolCall.name);
  const label = getToolLabel(toolCall.name);

  const [copiedSection, setCopiedSection] = useState<'args' | 'result' | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      const timer = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);
      return () => clearInterval(timer);
    } else if (startTimeRef.current && elapsedSeconds === null) {
      setElapsedSeconds(Math.max(0.1, (Date.now() - startTimeRef.current) / 1000));
    }
  }, [isRunning, elapsedSeconds]);

  const handleCopy = (text: string, section: 'args' | 'result', e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 1800);
  };

  const argsSummary = useMemo(() => formatArgsSummary(toolCall.args), [toolCall.args]);
  const prettyArgs = useMemo(() => prettyJson(toolCall.args), [toolCall.args]);
  const prettyResult = useMemo(() => prettyJson(toolCall.result), [toolCall.result]);

  return (
    <div
      style={{ '--stagger-index': index } as React.CSSProperties}
      className={cn(
        'tool-card-enter group relative w-full rounded-xl border overflow-hidden',
        'transition-all duration-300 shadow-sm',
        isRunning
          ? 'tool-card-running border-primary/50 bg-card/85 shadow-primary/10'
          : isError
            ? 'border-destructive/40 bg-destructive/5'
            : 'border-border/60 bg-card/60 hover:border-border hover:shadow-md'
      )}
    >
      {/* Animated left indicator spine */}
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-colors duration-500 z-10',
          isRunning
            ? 'tool-spine bg-gradient-to-b from-primary via-primary/80 to-primary'
            : isError
              ? 'bg-destructive'
              : 'bg-emerald-500/80'
        )}
      />

      {/* Shimmer sweep animation while running */}
      {isRunning && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="tool-shimmer-sweep absolute inset-y-0 -left-full w-2/3 bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        </span>
      )}

      {/* Card Header button spanning full width */}
      <button
        type="button"
        onClick={() => onToggle(toolCall.id)}
        aria-expanded={isOpen}
        className="relative flex w-full items-center gap-3 py-2.5 pr-4 pl-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
            isOpen && 'rotate-90 text-foreground'
          )}
        />

        {/* Tool icon with running breathing/pulse */}
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
            isRunning
              ? 'bg-primary/20 text-primary shadow-sm ring-1 ring-primary/30 animate-pulse'
              : isError
                ? 'bg-destructive/15 text-destructive ring-1 ring-destructive/30'
                : 'bg-muted/70 text-muted-foreground group-hover:text-foreground'
          )}
        >
          <Icon className={cn('h-4 w-4 transition-transform duration-200', isRunning && 'scale-110')} />
        </span>

        {/* Label and inline argument preview */}
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground tracking-tight">
              {label}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground/70 hidden sm:inline">
              ({toolCall.name})
            </span>
          </div>

          {!isOpen && argsSummary && (
            <span className="truncate font-mono text-[11px] text-muted-foreground/90 mt-0.5">
              {argsSummary}
            </span>
          )}
        </span>

        {/* Right side status badges & live duration */}
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          {/* Elapsed execution time badge */}
          {elapsedSeconds !== null && (
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground bg-muted/40">
              <Clock className="h-2.5 w-2.5" />
              {elapsedSeconds.toFixed(1)}s
            </span>
          )}

          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-300 shadow-2xs',
              isRunning
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : isError
                  ? 'bg-destructive/15 text-destructive ring-1 ring-destructive/30'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
            )}
          >
            {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
            {!isRunning && !isError && <Check className="status-pop h-3 w-3 text-emerald-500" />}
            {isError && <AlertCircle className="h-3 w-3 text-destructive" />}
            <span>{isRunning ? 'Running' : isError ? 'Error' : 'Done'}</span>
          </span>
        </span>
      </button>

      {/* Collapsible accordion details */}
      <div
        className={cn(
          'relative grid transition-[grid-template-rows] duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-border/40 bg-muted/20 p-3.5 sm:px-6 font-mono text-xs">
            {prettyArgs && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Parameters
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(prettyArgs, 'args', e)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    {copiedSection === 'args' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border/50 bg-zinc-950/90 p-2.5 leading-relaxed text-zinc-200 shadow-inner">
                  {prettyArgs}
                </pre>
              </div>
            )}

            {prettyResult ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Response
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(prettyResult, 'result', e)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    {copiedSection === 'result' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border/50 bg-zinc-950/90 p-2.5 leading-relaxed text-zinc-200 shadow-inner">
                  {prettyResult}
                </pre>
              </div>
            ) : isRunning ? (
              <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Waiting for result…</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}