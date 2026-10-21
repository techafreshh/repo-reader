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
  AlertCircle,
  PanelRightClose,
  RotateCcw,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { Loader } from '@/components/motion/loader';
import { EASE_OUT } from '@/lib/ease';
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
  const reduce = useReducedMotion() ?? false;

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
      {/* 1. Tab Bar — spring pill indicator glides between tabs */}
      <div className="flex items-center justify-between border-b border-surface-dark-elevated bg-surface-dark-deep px-2 pt-1.5">
        <Tabs
          value={activeTab?.path ?? ''}
          onValueChange={(value) => onSelectTab(value)}
          variant="segment"
          className="flex-1 min-w-0"
        >
          <TabsList
            wrapperClassName="justify-start"
            className="rounded-lg bg-surface-dark/80 p-0.5 w-max max-w-full"
          >
            {tabs.map((tab) => {
              return (
                <TabsTrigger
                  key={tab.path}
                  value={tab.path}
                  icon={getFileIcon(tab.name)}
                  title={tab.path}
                  className="max-w-[200px] px-2.5 py-1 font-mono text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  <span className="max-w-[140px] truncate">{tab.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      // Keep the close click from also selecting the tab.
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseTab(tab.path, e);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="ml-1 rounded-sm p-0.5 text-zinc-400 opacity-60 hover:bg-zinc-800 hover:text-white hover:opacity-100 transition-opacity"
                    title="Close tab"
                    aria-label={`Close ${tab.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

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

      {/* 3. Code Content Area — content cross-fades as tabs change */}
      <div className="flex-1 overflow-auto bg-surface-dark p-0 relative">
        <motion.div
          key={activeTab?.path ?? 'empty'}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="flex h-full min-h-full flex-col"
        >
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
            <Loader variant="spinner" size={24} speed={0.9} label={`Loading ${activeTab.name}`} className="text-primary" />
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
        </motion.div>
      </div>
    </div>
  );
}
