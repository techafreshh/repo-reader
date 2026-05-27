import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Link, FolderTree, Loader2 } from 'lucide-react';
import { WebhookConfig } from '@/types/chat';
import { FileTree, TreeNode } from './FileTree';

interface SidebarProps {
  onNewChat: () => void;
  webhookConfig: WebhookConfig;
  sessionId: string;
  treeVersion?: number;
  onFileClick?: (path: string) => void;
}

export function Sidebar({ onNewChat, webhookConfig, sessionId, treeVersion, onFileClick }: SidebarProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Fetch the file tree whenever the session or webhook URL changes
  useEffect(() => {
    if (!webhookConfig.url || !sessionId) {
      setTree([]);
      return;
    }

    const fetchTree = async () => {
      setIsLoadingTree(true);
      setTreeError(null);
      try {
        // Derive the base API URL from the webhook URL (e.g. http://host:port/chat -> http://host:port)
        const baseUrl = webhookConfig.url.replace(/\/chat\/?$/, '');
        const response = await fetch(`${baseUrl}/tree/${sessionId}`);
        if (!response.ok) {
          // Session may not be initialized yet — that's fine
          if (response.status === 404) {
            setTree([]);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setTree(data.tree || []);
      } catch (err) {
        console.warn('[Sidebar] Failed to load file tree:', err);
        setTreeError('Could not load tree');
        setTree([]);
      } finally {
        setIsLoadingTree(false);
      }
    };

    fetchTree();
  }, [webhookConfig.url, sessionId, treeVersion]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground p-3">
      {/* New Chat */}
      <div className="mb-4">
        <Button onClick={onNewChat} className="w-full justify-start gap-2">
          <PlusCircle className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* File Tree Explorer */}
      <div className="flex-1 overflow-y-auto">
        {webhookConfig.url && (
          <div>
            <h2 className="mb-2 px-2 text-xs font-semibold tracking-tight text-sidebar-primary flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5" />
              File Explorer
            </h2>

            {isLoadingTree ? (
              <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-muted-foreground font-mono">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading tree...
              </div>
            ) : treeError ? (
              <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono italic">
                {treeError}
              </div>
            ) : tree.length > 0 ? (
              <FileTree tree={tree} onFileClick={onFileClick} />
            ) : (
              <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono italic">
                Send a repo URL to load the tree.
              </div>
            )}
          </div>
        )}

        {/* Active Connection */}
        {webhookConfig.url && (
          <div className="mt-4">
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
