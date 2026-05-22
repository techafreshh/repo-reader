import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, StopCircle, Plus, Paperclip, Scan, Camera, Image, Lightbulb, Telescope, Globe, MoreHorizontal, ChevronRight, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Message } from '@/types/chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  isConnected: boolean;
  messages: Message[];
  isStreamingEnabled: boolean;
  onStopStreaming: () => void;
  onUpload?: (file: File) => Promise<{ success: boolean; message?: string }>;
  hasUploadConfig?: boolean;
  transparent?: boolean;
}

export function ChatInput({
  onSend,
  isLoading,
  isConnected,
  messages,
  isStreamingEnabled,
  onStopStreaming,
  onUpload,
  hasUploadConfig,
  transparent,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userMessages = messages.filter((m) => m.role === 'user').reverse();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
      setHistoryIndex(-1);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      await onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      if (userMessages.length > 0 && historyIndex < userMessages.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(userMessages[newIndex].content);
        e.preventDefault();
        moveCursorToEnd();
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(userMessages[newIndex].content);
        e.preventDefault();
        moveCursorToEnd();
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        e.preventDefault();
      }
    }
  };

  useEffect(() => {
    if (input === '') {
      setHistoryIndex(-1);
    }
  }, [input]);
  
  const moveCursorToEnd = () => {
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(
          textareaRef.current.value.length,
          textareaRef.current.value.length
        );
      }
    }, 0);
  };

  return (
    <div className={cn(
      "px-4 py-4",
      !transparent && "bg-background/80 backdrop-blur-sm"
    )}>
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            'relative flex items-center gap-2 rounded-full bg-secondary/70 p-1.5 transition-all duration-200 border border-border/40',
            isLoading && 'opacity-70'
          )}
        >
          {hasUploadConfig && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={isLoading}
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56 mb-2">
                  <DropdownMenuItem onClick={handleFileClick} className="cursor-pointer">
                    <Paperclip className="mr-2 h-4 w-4" />
                    <span>Upload photos & files</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Scan className="mr-2 h-4 w-4" />
                    <span>Take screenshot</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Camera className="mr-2 h-4 w-4" />
                    <span>Take photo</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Image className="mr-2 h-4 w-4" />
                    <span>Create image</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Lightbulb className="mr-2 h-4 w-4" />
                    <span>Thinking</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Telescope className="mr-2 h-4 w-4" />
                    <span>Deep research</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>Web search</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="flex justify-between items-center">
                    <div className="flex items-center">
                      <MoreHorizontal className="mr-2 h-4 w-4" />
                      <span>More</span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? 'Send a message...' : 'Demo mode — configure webhook to connect'}
            disabled={isLoading && !isStreamingEnabled}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent px-3 py-2.5 text-sm',
              'placeholder:text-muted-foreground/60',
              'focus:outline-none disabled:cursor-not-allowed',
              'max-h-[200px] min-h-[44px]'
            )}
          />
          {isLoading && isStreamingEnabled ? (
            <Button
              onClick={onStopStreaming}
              size="icon"
              variant="destructive"
              className="h-8 w-8 shrink-0 rounded-full"
            >
              <StopCircle className="h-4 w-4" />
              <span className="sr-only">Stop generating</span>
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 rounded-full transition-all duration-150',
                'bg-primary text-primary-foreground hover:bg-[#a9583e]',
                'disabled:bg-primary/20 disabled:text-primary-foreground/40 disabled:cursor-not-allowed'
              )}
            >
              <ArrowUp className="h-5 w-5 stroke-[3]" />
              <span className="sr-only">Send message</span>
            </Button>
          )}
        </div>

        {/* Keyboard hint */}
        <div className="mt-2 flex items-center justify-between gap-1 text-[10px] text-muted-foreground/50 font-mono">
          <div>
            <span className="font-bold">↑↓</span> to browse history
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold">Enter</span>
            <span>to send</span>
            <span className="mx-1">•</span>
            <span className="font-bold">Shift+Enter</span>
            <span>for newline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
