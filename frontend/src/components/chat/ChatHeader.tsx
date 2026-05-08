import { Zap, Settings, Trash2, PanelLeft, PanelLeftClose, Sun, Moon, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ChatHeaderProps {
  isConnected: boolean;
  onOpenSettings: () => void;
  onClearChat: () => void;
  messagesCount: number;
  isStreamingEnabled: boolean;
  onToggleStreaming: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  theme: string;
  onToggleTheme: () => void;
  isExternal?: boolean;
  appName: string;
  appLogoUrl?: string;
}

export function ChatHeader({
  isConnected,
  onOpenSettings,
  onClearChat,
  messagesCount,
  isStreamingEnabled,
  onToggleStreaming,
  onToggleSidebar,
  isSidebarOpen,
  theme,
  onToggleTheme,
  isExternal,
  appName,
  appLogoUrl,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between bg-background/80 backdrop-blur-sm px-4">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8 w-8 text-muted-foreground"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          </TooltipContent>
        </Tooltip>

        {/* Logo / Title */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md overflow-hidden',
              'bg-primary/10 text-primary',
              appLogoUrl && "p-0 bg-transparent"
            )}
          >
            {appLogoUrl ? (
              <img src={appLogoUrl} alt={appName} className="h-full w-full object-cover" />
            ) : (
              <Zap className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">{appName}</h1>
            <p className="font-mono text-[10px] text-muted-foreground">
              {isConnected ? (
                <span className="text-success">Connected. Ready.</span>
              ) : (
                <span>Demo mode</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">

        <div className="flex items-center space-x-2">
          <Switch
            id="streaming-toggle"
            checked={isStreamingEnabled}
            onCheckedChange={onToggleStreaming}
          />
          <Label htmlFor="streaming-toggle" className="text-xs text-muted-foreground font-mono">
            Stream
          </Label>
        </div>

        {messagesCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearChat}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear conversation</TooltipContent>
          </Tooltip>
        )}

        {!isExternal && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className={cn(
                  'h-8 w-8',
                  isConnected
                    ? 'text-primary hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Webhook settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Webhook settings</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
