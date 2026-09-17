import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileViewer } from "@/hooks/useFileViewer";

describe("useFileViewer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes with empty tabs and closed state", () => {
    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBeUndefined();
    expect(result.current.isOpen).toBe(false);
  });

  it("opens a file tab and fetches content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        path: "src/main.py",
        name: "main.py",
        content: "print('hello')",
        binary: false,
        size: 14,
      }),
    } as Response));

    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    await act(async () => {
      await result.current.openFile("src/main.py");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.tabs.length).toBe(1);
    expect(result.current.activeTabPath).toBe("src/main.py");
    expect(result.current.activeTab?.content).toBe("print('hello')");
    expect(result.current.activeTab?.isLoading).toBe(false);
  });

  it("focuses existing tab when opening an already open file without re-fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        path: "src/main.py",
        name: "main.py",
        content: "code",
        binary: false,
        size: 4,
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    await act(async () => {
      await result.current.openFile("src/main.py");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.openFile("src/main.py");
    });

    // Should not fetch again
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.tabs.length).toBe(1);
  });

  it("closes tab and selects adjacent tab or closes pane if empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        path: "file.py",
        name: "file.py",
        content: "content",
        binary: false,
      }),
    } as Response));

    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    await act(async () => {
      await result.current.openFile("file1.py");
      await result.current.openFile("file2.py");
    });

    expect(result.current.tabs.length).toBe(2);
    expect(result.current.activeTabPath).toBe("file2.py");

    act(() => {
      result.current.closeTab("file2.py");
    });

    expect(result.current.tabs.length).toBe(1);
    expect(result.current.activeTabPath).toBe("file1.py");
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeTab("file1.py");
    });

    expect(result.current.tabs.length).toBe(0);
    expect(result.current.isOpen).toBe(false);
  });

  it("closeAllTabs resets tabs and closes pane", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: "a.py", name: "a.py", content: "" }),
    } as Response));

    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    await act(async () => {
      await result.current.openFile("a.py");
    });

    act(() => {
      result.current.closeAllTabs();
    });

    expect(result.current.tabs).toEqual([]);
    expect(result.current.isOpen).toBe(false);
  });

  it("refetches an errored tab when reopened (Retry)", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          path: "f.py",
          name: "f.py",
          content: "ok",
          binary: false,
          size: 2,
        }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    await act(async () => {
      await result.current.openFile("f.py");
    });

    expect(result.current.activeTab?.error).toContain("network down");

    await act(async () => {
      await result.current.openFile("f.py");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.activeTab?.error).toBeNull();
    expect(result.current.activeTab?.content).toBe("ok");
  });

  it("does not create duplicate tabs or repeat fetches on rapid double open", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useFileViewer({ apiUrl: "http://localhost:7643", sessionId: "test-session" })
    );

    await act(async () => {
      const first = result.current.openFile("a.py");
      const second = result.current.openFile("a.py");
      resolveFetch({
        ok: true,
        json: async () => ({ path: "a.py", name: "a.py", content: "x", binary: false, size: 1 }),
      } as Response);
      await Promise.all([first, second]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.tabs.length).toBe(1);
    expect(result.current.activeTab?.content).toBe("x");
  });

  it("clears cached tabs when the cacheKey changes (repo re-initialized)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        path: "a.py",
        name: "a.py",
        content: "old repo content",
        binary: false,
        size: 16,
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      (props: { apiUrl: string; sessionId: string; cacheKey: number }) =>
        useFileViewer(props),
      {
        initialProps: {
          apiUrl: "http://localhost:7643",
          sessionId: "test-session",
          cacheKey: 0,
        },
      }
    );

    await act(async () => {
      await result.current.openFile("a.py");
    });
    expect(result.current.tabs.length).toBe(1);
    expect(result.current.activeTab?.content).toBe("old repo content");

    // Same session id, new repository → cached tabs must be dropped
    rerender({
      apiUrl: "http://localhost:7643",
      sessionId: "test-session",
      cacheKey: 1,
    });

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabPath).toBeNull();

    // Reopening refetches instead of serving the previous repo's content
    await act(async () => {
      await result.current.openFile("a.py");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.tabs.length).toBe(1);
  });

  it("clears cached tabs when the sessionId changes even if cacheKey is unchanged (New Chat)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        path: "a.py",
        name: "a.py",
        content: "previous session content",
        binary: false,
        size: 23,
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      (props: { apiUrl: string; sessionId: string; cacheKey: number }) =>
        useFileViewer(props),
      {
        initialProps: {
          apiUrl: "http://localhost:7643",
          sessionId: "session-one",
          cacheKey: 0,
        },
      }
    );

    await act(async () => {
      await result.current.openFile("a.py");
    });
    expect(result.current.tabs.length).toBe(1);
    expect(result.current.activeTab?.content).toBe("previous session content");

    // "New Chat" rotates the session id without bumping treeVersion →
    // cached tabs from the previous session must be dropped
    rerender({
      apiUrl: "http://localhost:7643",
      sessionId: "session-two",
      cacheKey: 0,
    });

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabPath).toBeNull();
    // isOpen is intentionally left as-is (same as the cacheKey reset): the
    // pane is hidden whenever tabs are empty until a file is opened again.

    // Reopening in the new session refetches instead of serving stale content
    await act(async () => {
      await result.current.openFile("a.py");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.tabs.length).toBe(1);
    expect(result.current.isOpen).toBe(true);
  });
});
