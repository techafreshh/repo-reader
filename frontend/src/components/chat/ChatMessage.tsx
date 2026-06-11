import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import { AlertCircle, RotateCcw, Clipboard, Check, ThumbsUp, ThumbsDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useState } from 'react';
import { LoadingDots } from './LoadingDots';

interface ChatMessageProps {
  message: Message;
  onRetry?: () => void;
}

export function ChatMessage({ message, onRetry }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [thumbUpActive, setThumbUpActive] = useState(false);
  const [thumbDownActive, setThumbDownActive] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  const handleThumbUp = () => {
    setThumbUpActive(!thumbUpActive);
    setThumbDownActive(false);
  };

  const handleThumbDown = () => {
    setThumbDownActive(!thumbDownActive);
    setThumbUpActive(false);
  };

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={cn(
        'message-enter flex w-full gap-3 px-4 py-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'relative max-w-[85%] md:max-w-[70%] rounded-3xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-transparent border-transparent',
          isError && 'border-destructive/50 bg-destructive/10'
        )}
      >
        {/* Tool Calls */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {message.toolCalls.map((tc) => (
              <div
                key={tc.id}
                className="rounded-xl border border-border/60 bg-card/50 overflow-hidden"
              >
                <button
                  onClick={() => toggleTool(tc.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                      expandedTools.has(tc.id) && 'rotate-90'
                    )}
                  />
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      tc.status === 'running'
                        ? 'bg-amber-400 animate-pulse'
                        : tc.status === 'done'
                          ? 'bg-emerald-500'
                          : 'bg-red-500'
                    )}
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {tc.name}
                  </span>
                  <span className="ml-auto shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                        tc.status === 'running'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : tc.status === 'done'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {tc.status === 'running' ? 'Running' : tc.status === 'done' ? 'Done' : 'Error'}
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {isUser ? (
          <div
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap break-words'
            )}
          >
            {message.content}
          </div>
        ) : (
          <div
            className={cn(
              'prose dark:prose-invert prose-sm max-w-none'
            )}
          >
            {message.content ? (
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        {...props}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : isStreaming ? (
              <LoadingDots />
            ) : null}
          </div>
        )}

        {/* Error state with retry */}
        {isError && onRetry && (
          <div className="mt-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          </div>
        )}

        {/* Action buttons for AI messages */}
        {!isUser && !isStreaming && !isError && (
          <div className="mt-2 flex items-center justify-start gap-1">
            {message.content && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className="h-7 w-7 text-xs text-muted-foreground opacity-50 hover:opacity-100 transition-opacity"
                  >
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleThumbUp}
                  className={cn(
                    "h-7 w-7 text-xs opacity-50 hover:opacity-100 transition-opacity",
                    thumbUpActive ? "text-accent" : "text-muted-foreground"
                  )}
                >
                  <ThumbsUp className={cn("h-4 w-4", thumbUpActive && "fill-accent")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Good response</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleThumbDown}
                  className={cn(
                    "h-7 w-7 text-xs opacity-50 hover:opacity-100 transition-opacity",
                    thumbDownActive ? "text-accent" : "text-muted-foreground"
                  )}
                >
                  <ThumbsDown className={cn("h-4 w-4", thumbDownActive && "fill-accent")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bad response</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
