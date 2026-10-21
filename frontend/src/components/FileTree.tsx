import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import {
  FileTree as MotionFileTree,
  FileTreeFile,
  FileTreeFolder,
} from '@/components/motion/file-tree';

export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  onFileClick?: (path: string) => void;
  activeFilePath?: string | null;
}

function collectDirPaths(nodes: TreeNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.type === 'directory') {
      into.add(node.path);
      if (node.children) collectDirPaths(node.children, into);
    }
  }
  return into;
}

function topDirPaths(nodes: TreeNode[]): string[] {
  return nodes.filter((n) => n.type === 'directory').map((n) => n.path);
}

function renderNodes(nodes: TreeNode[]) {
  return nodes.map((node) =>
    node.type === 'directory' ? (
      <FileTreeFolder key={node.path} value={node.path} name={node.name}>
        {node.children?.length ? renderNodes(node.children) : null}
      </FileTreeFolder>
    ) : (
      <FileTreeFile
        key={node.path}
        value={node.path}
        name={node.name}
        icon={<FileText className="size-4" />}
      />
    ),
  );
}

export function FileTree({ tree, onFileClick, activeFilePath }: FileTreeProps) {
  const dirPaths = useMemo(() => collectDirPaths(tree, new Set()), [tree]);
  // Expand top-level folders on first load; re-expand them when a new tree
  // (session) replaces the current one.
  const [expandedIds, setExpandedIds] = useState<string[]>(() => topDirPaths(tree));

  useEffect(() => {
    setExpandedIds(topDirPaths(tree));
  }, [tree]);

  if (tree.length === 0) {
    return (
      <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono italic">
        No files loaded.
      </div>
    );
  }

  return (
    <MotionFileTree
      value={activeFilePath ?? null}
      onValueChange={(value) => {
        // Folder rows toggle their own expansion; only files open the viewer.
        if (!dirPaths.has(value)) onFileClick?.(value);
      }}
      expandedIds={expandedIds}
      onExpandedChange={setExpandedIds}
      ariaLabel="Repository files"
      classNames={{
        // The gliding pill from FileTree carries the selected look; keep the
        // row itself transparent so the two don't double-paint.
        item: 'rounded-md aria-selected:bg-transparent aria-selected:text-foreground',
        label: 'font-mono text-[11px]',
      }}
    >
      {renderNodes(tree)}
    </MotionFileTree>
  );
}
