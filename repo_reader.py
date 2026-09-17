import os
import re
import ast
import uuid
import shutil
import asyncio
import mimetypes
from pathlib import Path
from typing import List, Optional

import logging
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Initialize Langfuse and Pydantic AI instrumentation if keys are configured
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY")

if LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY:
    try:
        from langfuse import get_client
        # get_client registers OpenTelemetry span processor
        langfuse = get_client()
        from pydantic_ai.agent import Agent as OTelAgent
        OTelAgent.instrument_all()
    except Exception as e:
        logging.warning(f"Failed to initialize Langfuse instrumentation: {e}")

from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from pydantic_ai.ui import StateDeps
from pydantic_ai.messages import ModelMessage
from rich.console import Console
from rich.markdown import Markdown

from repo_config import (
    RepoConfig,
    clone_repo,
    get_friendly_name,
    get_gitignore_spec,
    is_ignored,
    verify_repo_limits,
)
from sessions import sessions

console = Console()

MODEL_NAME = os.getenv("MODEL_NAME", "openrouter:deepseek/deepseek-v4-flash")

# --- Models & Configuration ---

class AgentState(BaseModel):
    session_id: str = ""

# --- Agent Definition ---

agent = Agent(
    MODEL_NAME,
    deps_type=StateDeps[AgentState],
    description="An AI agent that explores and explains code repositories.",
    system_prompt=(
        "You are an expert software engineer and repository analyst. "
        "Your goal is to help users understand a codebase by exploring files, "
        "searching for symbols, and tracing logic. "
        "Always start by listing files if you're unsure of the project structure. "
        "For Python files (.py), prefer using the analyze_python_ast tool first to get a "
        "token-efficient overview of classes, functions, and docstrings before reading the full file. "
        "When explaining code, be precise and mention 'what' it does and 'why' it's designed that way. "
        "CRITICAL RULE: You must ONLY answer queries that are directly related to the code, structure, "
        "configuration, logic, or documentation of the current repository/project. If the user's query is "
        "unrelated to the current repository or codebase, you must decline to answer, politely inform them "
        "that your capabilities are restricted to assisting with the loaded codebase, and ask them to ask "
        "a repository-related question."
    ),
    instrument=True
)

def _get_config(ctx: RunContext[StateDeps[AgentState]]) -> RepoConfig:
    session = sessions.get(ctx.deps.state.session_id)
    if not session:
        raise LookupError("No repository initialized. Please provide a GitHub URL or local path.")
    return session["config"]

def _resolve_safe_path(root_path: Path, target: str) -> Optional[Path]:
    """Resolve a target path safely, ensuring it resides within root_path.

    Returns the resolved Path if within root_path, or None if it escapes.
    """
    try:
        resolved_root = root_path.resolve()
        raw = Path(target)
        resolved = raw.resolve() if raw.is_absolute() else (resolved_root / raw).resolve()
        if resolved == resolved_root or resolved.is_relative_to(resolved_root):
            return resolved
        return None
    except Exception:
        return None


# --- Session Initialization ---

def initialize_session_logic(target: str, session_id: str) -> Path:
    """Clone or resolve a repository target and register a session for it."""
    root = None
    is_temp = False
    try:
        if target.startswith(("http://", "https://", "git@")):
            root = clone_repo(target)
            is_temp = True
        else:
            allow_local = os.getenv("ALLOW_LOCAL_REPO_TARGETS", "true").lower() in ("1", "true", "yes")
            if not allow_local:
                raise ValueError("Local repository paths are disabled on this server. Please provide a GitHub URL.")
            root = Path(target).resolve()
            is_temp = False

        if not root.exists() or not root.is_dir():
            raise ValueError(f"Invalid repository path: '{target}' does not exist or is not a directory.")

        gitignore_spec = get_gitignore_spec(root)
        verify_repo_limits(root, gitignore_spec)

        config = RepoConfig(root_path=root, gitignore_spec=gitignore_spec)
        sessions.create(
            session_id,
            config=config,
            is_temp=is_temp,
            temp_path=root if is_temp else None,
        )
        return root
    except Exception as e:
        if is_temp and root and root.exists():
            try:
                shutil.rmtree(root, ignore_errors=True)
            except Exception:
                pass
        raise e

# --- Tools ---

@agent.tool
async def initialize_repo(ctx: RunContext[StateDeps[AgentState]], repo_target: str) -> str:
    """Initialize a repository from a URL or local path when no session exists yet."""
    session_id = ctx.deps.state.session_id
    try:
        await asyncio.to_thread(initialize_session_logic, repo_target, session_id)
        friendly_name = get_friendly_name(repo_target)
        return f"Repository '{friendly_name}' initialized. You can now explore the codebase."
    except Exception as e:
        return f"Failed to initialize repository: {str(e)}"

@agent.tool
def list_files(ctx: RunContext[StateDeps[AgentState]], subdir: str = ".") -> str:
    """Recursively list files in a subdirectory, respecting .gitignore."""
    console.print(f"[bold yellow]Tool Called: list_files({subdir})...[/bold yellow]")
    try:
        config = _get_config(ctx)
    except LookupError as e:
        return f"Error: {e}"
    target_dir = _resolve_safe_path(config.root_path, subdir)
    if not target_dir or not target_dir.exists() or not target_dir.is_dir():
        return f"Error: Directory '{subdir}' not found or outside repository."

    files_list = []
    for root, dirs, files in os.walk(target_dir):
        # Filter directories in-place to avoid walking into ignored ones
        dirs[:] = [d for d in dirs if not is_ignored(Path(root) / d, config.root_path, config.gitignore_spec)]
        
        for file in files:
            path = Path(root) / file
            if not is_ignored(path, config.root_path, config.gitignore_spec):
                files_list.append(str(path.relative_to(config.root_path)))

    if not files_list:
        return "No files found (or all are ignored)."
    
    total_files = len(files_list)
    console.print(f"[dim]Found {total_files} files.[/dim]")
    
    # Truncate if there are too many files to avoid token limits
    MAX_FILES = 500
    if total_files > MAX_FILES:
        truncated = files_list[:MAX_FILES]
        return "\n".join(truncated) + f"\n\n... (truncated {total_files - MAX_FILES} more files. Please ask to see specific subdirectories if needed.)"
    
    return "\n".join(files_list)

def is_binary(path: Path) -> bool:
    """Check if a file is binary by looking at its extension and content."""
    mime, _ = mimetypes.guess_type(path)
    if mime and not mime.startswith('text/'):
        # Allow some common code extensions that might not have text/ mime types
        if path.suffix.lower() in ('.py', '.js', '.ts', '.tsx', '.json', '.md', '.txt', '.yaml', '.yml'):
            return False
        return True
    return False

@agent.tool
def read_file(ctx: RunContext[StateDeps[AgentState]], filepath: str) -> str:
    """Read the full content of a file."""
    console.print(f"[bold yellow]Tool Called: read_file({filepath})...[/bold yellow]")
    try:
        config = _get_config(ctx)
    except LookupError as e:
        return f"Error: {e}"
    path = _resolve_safe_path(config.root_path, filepath)
    if not path:
        return f"Error: Access denied. Path '{filepath}' is outside repository root."
    if not path.exists():
        return f"Error: File '{filepath}' not found."
    if path.is_dir():
        return f"Error: '{filepath}' is a directory. Use list_files to inspect directory contents."
    if is_ignored(path, config.root_path, config.gitignore_spec):
        return f"Error: File '{filepath}' is ignored by .gitignore."
    
    if is_binary(path):
        return f"Error: File '{filepath}' appears to be a binary file. Can only read text files."
    
    try:
        content = path.read_text(encoding="utf-8")
        return f"--- File: {filepath} ---\n{content}"
    except Exception as e:
        return f"Error reading file '{filepath}': {e}"

@agent.tool
def search_code(ctx: RunContext[StateDeps[AgentState]], pattern: str) -> str:
    """Search for a regex pattern or string across all non-ignored files."""
    console.print(f"[bold yellow]Tool Called: search_code({pattern})...[/bold yellow]")
    try:
        config = _get_config(ctx)
    except LookupError as e:
        return f"Error: {e}"

    try:
        regex = re.compile(pattern, re.IGNORECASE)
    except re.error as e:
        return f"Error: Invalid regular expression '{pattern}': {e}"

    results = []
    for root, dirs, files in os.walk(config.root_path):
        dirs[:] = [d for d in dirs if not is_ignored(Path(root) / d, config.root_path, config.gitignore_spec)]
        for file in files:
            path = Path(root) / file
            if is_ignored(path, config.root_path, config.gitignore_spec) or is_binary(path):
                continue
            
            try:
                content = path.read_text(encoding="utf-8")
                lines = content.splitlines()
                for i, line in enumerate(lines):
                    if regex.search(line):
                        rel_path = path.relative_to(config.root_path)
                        results.append(f"{rel_path}:{i+1}: {line.strip()}")
            except Exception:
                continue

    if not results:
        return f"No matches found for '{pattern}'."
    
    if len(results) > 50:
        return "\n".join(results[:50]) + f"\n... (truncated {len(results)-50} more results)"
    
    return "\n".join(results)

@agent.tool
def get_file_structure(ctx: RunContext[StateDeps[AgentState]], filepath: str) -> str:
    """Provide a high-level summary of a file (classes and functions) without the full body."""
    console.print(f"[bold yellow]Tool Called: get_file_structure({filepath})...[/bold yellow]")
    try:
        config = _get_config(ctx)
    except LookupError as e:
        return f"Error: {e}"
    path = _resolve_safe_path(config.root_path, filepath)
    if not path:
        return f"Error: Access denied. Path '{filepath}' is outside repository root."
    if not path.exists():
        return f"Error: File '{filepath}' not found."
    if path.is_dir():
        return f"Error: '{filepath}' is a directory. Use list_files to inspect directory contents."
    if is_ignored(path, config.root_path, config.gitignore_spec):
        return f"Error: File '{filepath}' is ignored by .gitignore."
    if is_binary(path):
        return f"Error: File '{filepath}' appears to be a binary file. Can only analyze text files."
    
    try:
        content = path.read_text(encoding="utf-8")
        structure = []
        for line in content.splitlines():
            if line.strip().startswith(("def ", "class ")):
                structure.append(line.strip())
        
        if not structure:
            return f"No classes or functions found in '{filepath}'."
        return f"Structure of {filepath}:\n" + "\n".join(structure)
    except Exception as e:
        return f"Error analyzing '{filepath}': {e}"

@agent.tool
def find_references(ctx: RunContext[StateDeps[AgentState]], symbol_name: str) -> str:
    """Find all places where a specific function, class, or variable is used."""
    console.print(f"[bold yellow]Tool Called: find_references({symbol_name})...[/bold yellow]")
    pattern = rf"(?:\W|^){re.escape(symbol_name)}(?:\W|$)"
    return search_code(ctx, pattern)

@agent.tool
def analyze_python_ast(ctx: RunContext[StateDeps[AgentState]], filepath: str) -> str:
    """Parse a Python file using AST to extract classes, functions, decorators, and docstrings.
    This is much more token-efficient than reading the full file and should be preferred
    for getting an overview of Python files."""
    console.print(f"[bold yellow]Tool Called: analyze_python_ast({filepath})...[/bold yellow]")
    try:
        config = _get_config(ctx)
    except LookupError as e:
        return f"Error: {e}"
    path = _resolve_safe_path(config.root_path, filepath)
    if not path:
        return f"Error: Access denied. Path '{filepath}' is outside repository root."
    if not path.exists():
        return f"Error: File '{filepath}' not found."
    if path.is_dir():
        return f"Error: '{filepath}' is a directory, not a Python file."
    if is_ignored(path, config.root_path, config.gitignore_spec):
        return f"Error: File '{filepath}' is ignored by .gitignore."
    if not filepath.endswith('.py'):
        return f"Error: '{filepath}' is not a Python file. This tool only works with .py files."

    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return f"Error: Could not parse '{filepath}': {e}"
    except Exception as e:
        return f"Error reading '{filepath}': {e}"

    lines = []
    module_doc = ast.get_docstring(tree)
    if module_doc:
        lines.append(f'Module docstring: "{module_doc[:200]}"')
    lines.append("")

    # Extract imports summary
    imports = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imports.append(f"{module}.{alias.name}")
    if imports:
        lines.append(f"Imports ({len(imports)}): {', '.join(imports[:20])}")
        if len(imports) > 20:
            lines.append(f"  ... and {len(imports) - 20} more imports")
        lines.append("")

    # Extract top-level classes and functions
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            decorators = [f"@{ast.dump(d) if not hasattr(d, 'id') else d.id}" for d in node.decorator_list]
            dec_str = " ".join(decorators) + " " if decorators else ""
            bases = [ast.unparse(b) for b in node.bases] if node.bases else []
            base_str = f"({', '.join(bases)})" if bases else ""
            lines.append(f"{dec_str}class {node.name}{base_str}:  [line {node.lineno}]")
            doc = ast.get_docstring(node)
            if doc:
                lines.append(f'    """{doc[:150]}"""')
            # Extract methods within the class
            for item in node.body:
                if isinstance(item, ast.FunctionDef) or isinstance(item, ast.AsyncFunctionDef):
                    args = []
                    for arg in item.args.args:
                        annotation = f": {ast.unparse(arg.annotation)}" if arg.annotation else ""
                        args.append(f"{arg.arg}{annotation}")
                    ret = f" -> {ast.unparse(item.returns)}" if item.returns else ""
                    prefix = "async def" if isinstance(item, ast.AsyncFunctionDef) else "def"
                    lines.append(f"    {prefix} {item.name}({', '.join(args)}){ret}  [line {item.lineno}]")
                    method_doc = ast.get_docstring(item)
                    if method_doc:
                        lines.append(f'        """{method_doc[:100]}"""')
            lines.append("")

        elif isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            decorators = []
            for d in node.decorator_list:
                try:
                    decorators.append(f"@{ast.unparse(d)}")
                except Exception:
                    decorators.append("@<decorator>")
            dec_str = " ".join(decorators) + " " if decorators else ""
            args = []
            for arg in node.args.args:
                annotation = f": {ast.unparse(arg.annotation)}" if arg.annotation else ""
                args.append(f"{arg.arg}{annotation}")
            ret = f" -> {ast.unparse(node.returns)}" if node.returns else ""
            prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
            lines.append(f"{dec_str}{prefix} {node.name}({', '.join(args)}){ret}  [line {node.lineno}]")
            doc = ast.get_docstring(node)
            if doc:
                lines.append(f'    """{doc[:150]}"""')
            lines.append("")

    if len(lines) <= 2:
        return f"No classes or functions found in '{filepath}'."

    return f"--- AST Analysis: {filepath} ---\n" + "\n".join(lines)

# --- CLI Implementation ---

def main():
    import sys
    
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        target = input("Enter a local path OR a GitHub URL: ").strip()
    
    session_id = f"cli-{uuid.uuid4()}"
    temp_dir_to_clean = None

    try:
        initialize_session_logic(target or ".", session_id)
        session = sessions.get(session_id)
        root = session["config"].root_path
        temp_dir_to_clean = session["temp_path"]

        console.print(f"\n[bold blue]Repo Reader Active[/bold blue]")
        console.print(f"Target: [cyan]{target if target else 'Local'}[/cyan]")
        console.print(f"Analysis Path: [dim]{root}[/dim]")
        
        message_history: List[ModelMessage] = []
        deps = StateDeps(AgentState(session_id=session_id))

        while True:
            try:
                prompt = input("Ask about the repo: ")
                if prompt.lower() in ('exit', 'quit'): break
                if not prompt.strip(): continue

                with console.status("[bold green]Analyzing...[/bold green]"):
                    result = agent.run_sync(prompt, deps=deps, message_history=message_history)
                
                message_history = result.new_messages()
                console.print("\n[bold magenta]Repo Intelligence:[/bold magenta]")
                console.print(Markdown(result.output))
                console.print("-" * 40 + "\n")

            except (KeyboardInterrupt, EOFError):
                break
            except Exception as e:
                console.print(f"[bold red]Error:[/bold red] {e}")

    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")

    finally:
        sessions.pop(session_id)
        if temp_dir_to_clean and Path(temp_dir_to_clean).exists():
            console.print(f"\n[dim]Cleaning up temporary files...[/dim]")
            shutil.rmtree(temp_dir_to_clean)
        
        # Flush Langfuse client if instrumentation is configured
        if os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
            try:
                from langfuse import get_client
                get_client().flush()
            except Exception:
                pass

if __name__ == "__main__":
    main()
