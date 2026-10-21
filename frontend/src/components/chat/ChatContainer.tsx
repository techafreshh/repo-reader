import { useState, useRef } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useChat } from '@/hooks/useChat';
import { useTheme } from '@/hooks/useTheme';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { WebhookSettings } from './WebhookSettings';
import { Sidebar } from '../Sidebar';
import { Zap, ArrowDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SPRING_PRESS, EASE_OUT } from '@/lib/ease';
import { cn } from '@/lib/utils';
import { useFileViewer } from '@/hooks/useFileViewer';
import { CodeViewerPane } from '@/components/viewer/CodeViewerPane';
import { MessageScroller } from '@/components/agents/message-scroller';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export function ChatContainer() {
  const {
    messages,
    isLoading,
    webhookConfig,
    isStreamingEnabled,
    sendMessage,
    updateWebhookUrl,
    toggleStreaming,
    clearMessages,
    retryLastMessage,
    stopStreaming,
    uploadFile,
    hasUploadConfig,
    appName,
    appDescription,
    appLogoUrl,
    sessionId,
    treeVersion,
    quota,
  } = useChat();
  const { theme, toggleTheme } = useTheme();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const viewportRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;

  const {
    tabs,
    activeTab,
    activeTabPath,
    isOpen: isViewerOpen,
    openFile,
    closeTab,
    closeAllTabs,
    setIsOpen: setIsViewerOpen,
    toggleOpen: toggleViewer,
  } = useFileViewer({
    apiUrl: webhookConfig.url,
    sessionId,
    cacheKey: treeVersion,
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const renderChatArea = () => (
    <div className="relative flex flex-1 flex-col h-full overflow-hidden">
      <ChatHeader
        isConnected={webhookConfig.isConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearChat={clearMessages}
        messagesCount={messages.length}
        isStreamingEnabled={isStreamingEnabled}
        onToggleStreaming={toggleStreaming}
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        isExternal={webhookConfig.isExternal}
        appName={appName}
        appLogoUrl={appLogoUrl}
        openTabsCount={tabs.length}
        isViewerOpen={isViewerOpen}
        onToggleViewer={toggleViewer}
      />

      {/* Messages area — reader-aware viewport that follows streamed output
          at the live edge and releases when the reader scrolls away */}
      {messages.length === 0 ? (
        <main className="flex-1 flex items-center justify-center pb-64 overflow-hidden">
          <div className="w-full max-w-3xl flex flex-col items-center px-4">
            <EmptyState
              onOpenSettings={() => setIsSettingsOpen(true)}
              isExternal={webhookConfig.isExternal}
              appName={appName}
              appDescription={appDescription}
              appLogoUrl={appLogoUrl}
            />
            <div className="w-full mt-4">
              <ChatInput
                onSend={sendMessage}
                isLoading={isLoading}
                isConnected={webhookConfig.isConnected}
                messages={messages}
                isStreamingEnabled={isStreamingEnabled}
                onStopStreaming={stopStreaming}
                onUpload={uploadFile}
                hasUploadConfig={hasUploadConfig}
                quota={quota}
                transparent
              />
            </div>
          </div>
        </main>
      ) : (
        <MessageScroller
          className="flex-1"
          viewportRef={viewportRef}
          viewportClassName="flex-1"
          contentClassName="mx-auto max-w-3xl py-4 px-4 pb-8"
          followOutput
          smooth
          busy={isLoading}
          label="Conversation"
          onFollowChange={setIsAtLiveEdge}
        >
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              onRetry={
                message.status === 'error' && index === messages.length - 1
                  ? retryLastMessage
                  : undefined
              }
            />
          ))}
        </MessageScroller>
      )}

      {/* Jump back to the live edge when the reader scrolled away */}
      <AnimatePresence>
        {!isAtLiveEdge && messages.length > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.9 }}
            transition={SPRING_PRESS}
            onClick={() => {
              const viewport = viewportRef.current;
              if (viewport) {
                viewport.scrollTo({
                  top: viewport.scrollHeight,
                  behavior: reduce ? 'auto' : 'smooth',
                });
              }
            }}
            className="absolute bottom-24 right-6 z-20 flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-muted"
          >
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
            Jump to latest
          </motion.button>
        )}
      </AnimatePresence>

      {messages.length > 0 && (
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          isConnected={webhookConfig.isConnected}
          messages={messages}
          isStreamingEnabled={isStreamingEnabled}
          onStopStreaming={stopStreaming}
          onUpload={uploadFile}
          hasUploadConfig={hasUploadConfig}
          quota={quota}
        />
      )}

      <WebhookSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        webhookUrl={webhookConfig.url}
        onUpdateUrl={updateWebhookUrl}
      />
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex h-screen bg-background"
        style={theme === 'deep-dark' ? { '--background': '60 2% 12%' } as React.CSSProperties : undefined}
      >
        <div
          className={cn(
            'border-r border-border transition-all duration-300 ease-in-out',
            isSidebarOpen ? 'w-72' : 'w-0 p-0'
          )}
        >
          <Sidebar
            onNewChat={clearMessages}
            webhookConfig={webhookConfig}
            sessionId={sessionId}
            treeVersion={treeVersion}
            onFileClick={openFile}
            activeFilePath={activeTabPath}
          />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* The panel group and chat panel must stay mounted regardless of the
              viewer state — swapping tree positions would remount the chat area
              and discard the input draft and scroll position. */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
            <ResizablePanel defaultSize={100} minSize={30} className="h-full">
              {renderChatArea()}
            </ResizablePanel>

            {isViewerOpen && tabs.length > 0 && <ResizableHandle withHandle />}

            {isViewerOpen && tabs.length > 0 && (
              <ResizablePanel defaultSize={50} minSize={25} maxSize={75} className="h-full">
                <CodeViewerPane
                  tabs={tabs}
                  activeTab={activeTab}
                  onSelectTab={openFile}
                  onCloseTab={closeTab}
                  onCloseAll={closeAllTabs}
                  onClosePane={() => setIsViewerOpen(false)}
                  onAskAi={(prompt) => sendMessage(prompt)}
                  onReloadTab={(path) => openFile(path)}
                />
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  );
}

function EmptyState({ onOpenSettings, isExternal, appName, appDescription, appLogoUrl }: {
  onOpenSettings: () => void;
  isExternal?: boolean;
  appName: string;
  appDescription: string;
  appLogoUrl?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  // One-shot content reveal: short lift with a restrained blur (beUI recipe).
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className="flex h-full flex-col items-center justify-center px-4 text-center"
    >
      <div className={cn(
        "mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary overflow-hidden",
        appLogoUrl && "p-0 bg-transparent"
      )}>
        {appLogoUrl ? (
          <img src={appLogoUrl} alt={appName} className="h-full w-full object-cover" />
        ) : (
          <Zap className="h-8 w-8" />
        )}
      </div>
      <h2 className="mb-2 text-3xl font-normal font-serif tracking-tight text-foreground">
        Welcome to {appName}
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {appDescription}
      </p>
      {!isExternal && (
        <div className="flex gap-3">
          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:border-primary/50"
          >
            <Zap className="h-4 w-4 text-primary" />
            Configure Webhook
          </button>
        </div>
      )}
    </motion.div>
  );
}
