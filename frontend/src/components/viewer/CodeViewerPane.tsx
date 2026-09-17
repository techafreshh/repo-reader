import { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  X,
  Copy,
  Check,
  Code,
  FileText,
  FileCode,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle,
  PanelRightClose,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FileTab } from '@/hooks/useFileViewer';

interface CodeViewerPaneProps {
  tabs: FileTab[];
  activeTab?: FileTab;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e?: React.MouseEvent) => void;
  onCloseAll: () => void;
  onClosePane: () => void;
  onAskAi?: (prompt: string) => void;
  onReloadTab?: (path: string) => void;
}

function getLanguage(filename: string): string {
  if (/^dockerfile$/i.test(filename)) {
    return 'docker';
  }
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    case 'json':
      return 'json';
    case 'html':
    case 'xml':
    case 'svg':
      return 'xml';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'bash';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'c':
    case 'cpp':
    case 'h':
      return 'cpp';
    case 'java':
      return 'java';
    case 'kt':
    case 'kts':
      return 'kotlin';
    case 'swift':
      return 'swift';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'ini':
    case 'conf':
    case 'cfg':
      return 'ini';
    default:
      return 'text';
  }
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return <span className="text-[#3776ab] font-bold text-[11px] font-mono leading-none">🐍</span>;
    case 'ts':
    case 'tsx':
      return <span className="text-[#3178c6] font-bold text-[10px] font-mono leading-none">TS</span>;
    case 'js':
    case 'jsx':
      return <span className="text-[#f7df1e] font-bold text-[10px] font-mono leading-none">JS</span>;
    case 'json':
      return <span className="text-[#e8a55a] font-bold text-[10px] font-mono leading-none">&#123;&#125;</span>;
    case 'md':
      return <FileText className="h-3.5 w-3.5 text-zinc-400" />;
    default:
      return <FileCode className="h-3.5 w-3.5 text-zinc-400" />;
  }
}

export function CodeViewerPane({
  tabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  onCloseAll,
  onClosePane,
  onAskAi,
  onReloadTab,
}: CodeViewerPaneProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!activeTab?.content) return;
    navigator.clipboard.writeText(activeTab.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAskAi = () => {
    if (!activeTab || !onAskAi) return;
    onAskAi(`Explain the code in file: ${activeTab.path}`);
  };

  // Breadcrumbs: split path into directory crumbs + filename
  const breadcrumbs = useMemo(() => {
    if (!activeTab) return [];
    return activeTab.path.split('/');
  }, [activeTab]);

  const language = useMemo(() => {
    return activeTab ? getLanguage(activeTab.name) : 'text';
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col bg-surface-dark text-on-dark border-l border-surface-dark-elevated font-sans select-text">
      {/* 1. Tab Bar */}
      <div className="flex items-center justify-between border-b border-surface-dark-elevated bg-surface-dark-deep px-2 pt-1">
        <div role="tablist" className="flex items-center space-x-1 overflow-x-auto no-scrollbar scroll-smooth flex-1 pr-2">
          {tabs.map((tab) => {
            const isActive = tab.path === activeTab?.path;
            return (
              <div
                key={tab.path}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => onSelectTab(tab.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTab(tab.path);
                  }
                }}
                className={cn(
                  'group flex items-center gap-2 rounded-t-md px-3 py-1.5 text-xs font-mono transition-all cursor-pointer border-t border-x select-none flex-shrink-0 max-w-[200px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
                  isActive
                    ? 'bg-surface-dark border-surface-dark-elevated border-b-transparent text-white font-medium shadow-sm'
                    : 'bg-surface-dark-deep border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-surface-dark/60'
                )}
                title={tab.path}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-3.5 h-3.5">
                  {getFileIcon(tab.name)}
                </div>
                <span className="truncate">{tab.name}</span>
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.path, e)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="ml-1 p-0.5 rounded-sm opacity-60 hover:opacity-100 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1 pb-1">
          {tabs.length > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  onClick={onCloseAll}
                >
                  <span className="text-[10px] font-mono">✕ all</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close all tabs</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                onClick={onClosePane}
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close side pane</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 2. Breadcrumb & Action Toolbar */}
      {activeTab && (
        <div className="flex items-center justify-between border-b border-surface-dark-elevated bg-surface-dark px-4 py-2 text-xs">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 font-mono text-zinc-400 truncate pr-2">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  {isLast && (
                    <span className="flex items-center justify-center">
                      {getFileIcon(crumb)}
                    </span>
                  )}
                  <span
                    className={cn(
                      'truncate',
                      isLast ? 'text-zinc-200 font-semibold' : 'text-zinc-400'
                    )}
                  >
                    {crumb}
                  </span>
                  {!isLast && (
                    <ChevronRight className="h-3 w-3 flex-shrink-0 text-zinc-600" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!activeTab.binary && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-[11px] font-mono border-zinc-800 bg-surface-dark-soft text-zinc-300 hover:bg-zinc-800 hover:text-white gap-1.5"
                title="Copy file contents"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            )}

            {onAskAi && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAskAi}
                className="h-7 px-2.5 text-[11px] font-medium border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-white gap-1.5"
                title="Ask AI to analyze this file"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask AI</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 3. Code Content Area */}
      <div className="flex-1 overflow-auto bg-surface-dark p-0 relative">
        {!activeTab ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-500 font-mono text-xs">
            <Code className="h-10 w-10 text-zinc-700 mb-3" />
            <p>No file selected.</p>
            <p className="mt-1 text-zinc-600">
              Click a file from the repository tree to inspect it.
            </p>
          </div>
        ) : activeTab.isLoading ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400 font-mono text-xs gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Loading {activeTab.name}...</span>
          </div>
        ) : activeTab.error ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-red-400 font-mono text-xs gap-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="max-w-md font-sans text-sm text-zinc-300">{activeTab.error}</p>
            {onReloadTab && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReloadTab(activeTab.path)}
                className="mt-2 border-zinc-700 bg-zinc-800 text-zinc-200 hover:text-white gap-2 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry
              </Button>
            )}
          </div>
        ) : activeTab.binary ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400 font-mono text-xs gap-3">
            <FileText className="h-10 w-10 text-zinc-600" />
            <p className="text-zinc-300 text-sm">Binary file preview not supported</p>
            <p className="text-zinc-500 text-[11px]">
              {activeTab.size ? `Size: ${(activeTab.size / 1024).toFixed(1)} KB` : ''}
            </p>
          </div>
        ) : (
          <div className="text-[12.5px] font-mono leading-relaxed">
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language}
              showLineNumbers={true}
              lineNumberStyle={{
                minWidth: '2.75rem',
                paddingRight: '1rem',
                color: '#52525b',
                textAlign: 'right',
                userSelect: 'none',
                fontSize: '11.5px',
              }}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: '1rem 0.5rem',
                background: '#181715',
                fontSize: '12.5px',
                lineHeight: '1.6',
              }}
            >
              {activeTab.content || ''}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}
