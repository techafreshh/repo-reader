import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

export interface FileTab {
  path: string;
  name: string;
  content?: string;
  binary?: boolean;
  size?: number;
  isLoading: boolean;
  error?: string | null;
}

interface UseFileViewerProps {
  apiUrl?: string;
  sessionId?: string;
  /** Changing this (e.g. the repo's treeVersion) drops all cached tabs. */
  cacheKey?: string | number;
}

export function useFileViewer({ apiUrl, sessionId, cacheKey }: UseFileViewerProps) {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const tabsRef = useRef<FileTab[]>([]);
  tabsRef.current = tabs;
  const inFlightRef = useRef<Set<string>>(new Set());
  const prevCacheKeyRef = useRef(cacheKey);

  // Cached content is only valid for the repository it was fetched from, so
  // a cacheKey change (repo re-initialized under the same session id) resets
  // every tab instead of serving the previous repo's files.
  useEffect(() => {
    if (prevCacheKeyRef.current !== cacheKey) {
      prevCacheKeyRef.current = cacheKey;
      inFlightRef.current.clear();
      setTabs([]);
      setActiveTabPath(null);
    }
  }, [cacheKey]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activeTabPath),
    [tabs, activeTabPath]
  );

  const openFile = useCallback(
    async (path: string) => {
      // Normalize slashes
      const normalizedPath = path.replace(/\\/g, '/');
      const filename = normalizedPath.split('/').pop() || normalizedPath;

      setIsOpen(true);
      setActiveTabPath(normalizedPath);

      // Focus-only for already loaded tabs; refetch errored ones (Retry)
      const existingTab = tabsRef.current.find((t) => t.path === normalizedPath);
      if (existingTab && !existingTab.error) {
        return;
      }
      if (inFlightRef.current.has(normalizedPath)) {
        return;
      }
      inFlightRef.current.add(normalizedPath);

      // Upsert a placeholder tab in loading state (no duplicate on race)
      setTabs((prev) =>
        prev.some((t) => t.path === normalizedPath)
          ? prev.map((t) =>
              t.path === normalizedPath ? { ...t, isLoading: true, error: null } : t
            )
          : [...prev, { path: normalizedPath, name: filename, isLoading: true, error: null }]
      );

      const failTab = (error: string) => {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === normalizedPath ? { ...t, isLoading: false, error } : t
          )
        );
      };

      try {
        if (!apiUrl || !sessionId) {
          failTab('Active repository session and connection required to view file.');
          return;
        }

        const response = await fetch(
          `${apiUrl}/file/${sessionId}?path=${encodeURIComponent(normalizedPath)}`
        );

        if (!response.ok) {
          let errorMsg = `HTTP ${response.status}: Failed to load file`;
          try {
            const errData = await response.json();
            if (errData.detail) {
              errorMsg = errData.detail;
            }
          } catch {
            // Fallback to generic message
          }
          failTab(errorMsg);
          return;
        }

        const data = await response.json();
        setTabs((prev) =>
          prev.map((t) =>
            t.path === normalizedPath
              ? {
                  ...t,
                  isLoading: false,
                  content: data.content ?? '',
                  binary: Boolean(data.binary),
                  size: data.size,
                  error: null,
                }
              : t
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        failTab(`Error loading file: ${message}`);
      } finally {
        inFlightRef.current.delete(normalizedPath);
      }
    },
    [apiUrl, sessionId]
  );

  const closeTab = useCallback(
    (path: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }

      setTabs((prev) => {
        const index = prev.findIndex((t) => t.path === path);
        const filtered = prev.filter((t) => t.path !== path);

        if (activeTabPath === path) {
          if (filtered.length === 0) {
            setActiveTabPath(null);
            setIsOpen(false);
          } else {
            // Select previous tab if available, else first tab
            const nextIndex = Math.max(0, index - 1);
            setActiveTabPath(filtered[nextIndex].path);
          }
        }

        return filtered;
      });
    },
    [activeTabPath]
  );

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabPath(null);
    setIsOpen(false);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    tabs,
    activeTab,
    activeTabPath,
    isOpen,
    openFile,
    closeTab,
    closeAllTabs,
    setActiveTabPath,
    setIsOpen,
    toggleOpen,
  };
}
