import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCallList } from "@/components/chat/ToolCallList";
import type { ToolCall } from "@/types/chat";

const initTool: ToolCall = {
  id: "t1",
  name: "initialize_repo",
  status: "running",
  args: '{"repo_target":"https://github.com/pydantic/pydantic-ai"}',
};

const listTool: ToolCall = {
  id: "t2",
  name: "list_files",
  status: "done",
  args: '{"subdir":"."}',
  result: "src/main.py\nsrc/app.py",
};

const readTool: ToolCall = {
  id: "t3",
  name: "read_file",
  status: "done",
  args: '{"filepath":"rate_limiter.py"}',
  result: "--- File: rate_limiter.py ---\nimport time",
};

const searchTool: ToolCall = {
  id: "t4",
  name: "search_code",
  status: "done",
  args: '{"pattern":"rate_limit"}',
  result: "rate_limiter.py:10",
};

const refsTool: ToolCall = {
  id: "t5",
  name: "find_references",
  status: "done",
  args: '{"symbol_name":"RateLimiter"}',
  result: "rate_limiter.py:3",
};

function renderList(toolCalls: ToolCall[], isRunActive = false) {
  return render(<ToolCallList toolCalls={toolCalls} isRunActive={isRunActive} />);
}

describe("ToolCallList", () => {
  it("streams mixed activity rows while the run is active", () => {
    renderList([initTool, listTool], true);
    expect(screen.getByText(/Exploring the repository/i)).toBeInTheDocument();
    expect(screen.getByText(/Initializing repository/i)).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("repository root")).toBeInTheDocument();
  });

  it("never renders tool input or output traces", () => {
    const { container } = renderList([readTool, searchTool, listTool], true);
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
    expect(screen.queryByText("Response")).not.toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByText(/--- File: rate_limiter/)).not.toBeInTheDocument();
  });

  it("renders searches as query rows", () => {
    renderList([searchTool, refsTool], true);
    expect(screen.getByText("rate_limit")).toBeInTheDocument();
    expect(screen.getByText("references of RateLimiter")).toBeInTheDocument();
  });

  it("collapses a finished run to a summary row", () => {
    renderList([listTool, readTool]);
    const summary = screen.getByRole("button", { name: /Ran 2 tools/i });
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });

  it("expands the summary back to the activity rows", () => {
    renderList([listTool, readTool]);
    fireEvent.click(screen.getByRole("button", { name: /Ran 2 tools/i }));
    expect(screen.getByRole("button", { name: /Ran 2 tools/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getAllByText("Read")).toHaveLength(2);
    expect(screen.getByText("rate_limiter.py")).toBeInTheDocument();
  });

  it("shows a placeholder target until streaming args parse", () => {
    renderList([{ id: "x", name: "read_file", status: "running" }], true);
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("keeps the run summary for every call — no early-call truncation needed", () => {
    const calls: ToolCall[] = [
      listTool,
      readTool,
      searchTool,
      refsTool,
      { id: "e", name: "get_file_structure", status: "done", args: '{"filepath":"app.py"}' },
    ];
    renderList(calls);
    expect(
      screen.getByRole("button", { name: /Ran 5 tools/i })
    ).toBeInTheDocument();
    // The collapsed summary replaces the old "Show N earlier tool calls".
    expect(screen.queryByText(/Show .* earlier tool call/i)).not.toBeInTheDocument();
  });
});
