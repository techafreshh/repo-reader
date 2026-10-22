import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCallList } from "@/components/chat/ToolCallList";
import type { ToolCall } from "@/types/chat";

const runningTool: ToolCall = {
  id: "t1",
  name: "initialize_repo",
  status: "running",
  args: '{"repo_target":"https://github.com/pydantic/pydantic-ai"}',
};

const doneTool: ToolCall = {
  id: "t2",
  name: "list_files",
  status: "done",
  args: '{"subdir":"."}',
  result: "src/main.py\nsrc/app.py",
};

const doneTool2: ToolCall = {
  id: "t3",
  name: "read_file",
  status: "done",
  args: '{"filepath":"rate_limiter.py"}',
  result: "--- File: rate_limiter.py ---\nimport time",
};

function renderList(toolCalls: ToolCall[], isRunActive = false) {
  return render(<ToolCallList toolCalls={toolCalls} isRunActive={isRunActive} />);
}

describe("ToolCallList", () => {
  it("streams tool calls as activity steps while the run is active", () => {
    renderList([runningTool], true);
    expect(screen.getByText(/Initializing repository/i)).toBeInTheDocument();
    expect(screen.getByText(/Exploring the repository/i)).toBeInTheDocument();
    // No deep-inspection surface while the run is working.
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  it("collapses a finished run to a summary row", () => {
    renderList([doneTool, doneTool2]);
    const summary = screen.getByRole("button", { name: /Ran 2 tools/i });
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  it("reveals the JSON inspection cards when the summary is expanded", () => {
    renderList([doneTool, doneTool2]);
    fireEvent.click(screen.getByRole("button", { name: /Ran 2 tools/i }));

    // One Parameters section per tool card
    expect(screen.getAllByText("Parameters")).toHaveLength(2);
    const toggle = screen.getByRole("button", { name: /Listing files/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the tool's target argument in the activity row", () => {
    renderList([doneTool2], true);
    expect(screen.getByText(/rate_limiter\.py/)).toBeInTheDocument();
  });

  it("keeps the run summary for every call — no early-call truncation needed", () => {
    const calls: ToolCall[] = [
      { id: "a", name: "list_files", status: "done", args: '{"subdir":"."}' },
      { id: "b", name: "read_file", status: "done" },
      { id: "c", name: "search_code", status: "done" },
      { id: "d", name: "find_references", status: "done" },
      { id: "e", name: "read_file", status: "done" },
    ];
    renderList(calls);
    expect(
      screen.getByRole("button", { name: /Ran 5 tools/i })
    ).toBeInTheDocument();
    // The collapsed summary replaces the old "Show N earlier tool calls".
    expect(screen.queryByText(/Show .* earlier tool call/i)).not.toBeInTheDocument();
  });
});
