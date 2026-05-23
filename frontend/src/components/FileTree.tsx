import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  onFileClick?: (path: string) => void;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  onFileClick?: (path: string) => void;
}

function TreeItem({ node, depth, onFileClick }: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isDir = node.type === 'directory';

  const handleClick = () => {
    if (isDir) {
      setIsOpen((prev) => !prev);
    } else if (onFileClick) {
      onFileClick(node.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-mono transition-colors',
          'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
          isDir ? 'text-sidebar-foreground' : 'text-muted-foreground',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {isOpen ? (
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            )}
            {isOpen ? (
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            ) : (
              <Folder className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ tree, onFileClick }: FileTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono italic">
        No files loaded.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} onFileClick={onFileClick} />
      ))}
    </div>
  );
}
