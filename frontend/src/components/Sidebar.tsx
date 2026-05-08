import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Link } from 'lucide-react';
import { WebhookConfig } from '@/types/chat';

interface SidebarProps {
  onNewChat: () => void;
  webhookConfig: WebhookConfig;
}

export function Sidebar({ onNewChat, webhookConfig }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground p-3">
      {/* New Chat */}
      <div className="mb-4">
        <Button onClick={onNewChat} className="w-full justify-start gap-2">
          <PlusCircle className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Your Chats - Removed Dummy Data */}
      <div className="flex-1 overflow-y-auto">
        {/* Saved Webhooks */}
        {webhookConfig.url && (
          <div>
            <h2 className="mb-2 px-2 text-xs font-semibold tracking-tight text-sidebar-primary">
              Active Connection
            </h2>
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-sidebar-accent/50 rounded-md">
                <Link className="h-4 w-4" />
                <span className="truncate font-mono text-[10px]">{webhookConfig.url}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
