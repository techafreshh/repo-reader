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

describe("ToolCallList", () => {
  it("renders a running tool card with running status", () => {
    render(<ToolCallList toolCalls={[runningTool]} />);
    expect(screen.getByText(/Initializing repository/i)).toBeInTheDocument();
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });

  it("renders a completed tool card with done status", () => {
    render(<ToolCallList toolCalls={[doneTool]} />);
    expect(screen.getByText(/Listing files/i)).toBeInTheDocument();
    expect(screen.getByText(/Done/i)).toBeInTheDocument();
  });

  it("auto-expands running tools to reveal args and waiting state", () => {
    render(<ToolCallList toolCalls={[runningTool]} />);
    expect(screen.getByRole("button", { name: /Initializing repository/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText(/Waiting for result/i)).toBeInTheDocument();
  });

  it("collapses finished tools until toggled open", () => {
    render(<ToolCallList toolCalls={[doneTool]} />);
    const toggle = screen.getByRole("button", { name: /Listing files/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the running tool visible and hides earlier calls past the threshold", () => {
    const calls: ToolCall[] = [
      { id: "a", name: "list_files", status: "done" },
      { id: "b", name: "read_file", status: "done" },
      { id: "c", name: "search_code", status: "done" },
      { id: "d", name: "find_references", status: "done" },
      { ...runningTool, id: "e" },
    ];
    render(<ToolCallList toolCalls={calls} />);

    expect(screen.getByText(/Show .* earlier tool call/i)).toBeInTheDocument();
    expect(screen.getByText(/Initializing repository/i)).toBeInTheDocument();
  });
});
