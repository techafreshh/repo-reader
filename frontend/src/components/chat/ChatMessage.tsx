import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import { AlertCircle, RotateCcw, Clipboard, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from 'react-markdown';
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
    console.log('Thumbs Up clicked. Active:', !thumbUpActive);
  };

  const handleThumbDown = () => {
    setThumbDownActive(!thumbDownActive);
    setThumbUpActive(false);
    console.log('Thumbs Down clicked. Active:', !thumbDownActive);
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
              <ReactMarkdown>{message.content}</ReactMarkdown>
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