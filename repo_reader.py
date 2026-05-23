import os
import re
from pathlib import Path
from typing import List, Optional, Any
import subprocess
import tempfile
import shutil
import mimetypes

from pydantic import BaseModel, Field, ConfigDict
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
import pathspec

# Load environment variables
load_dotenv()

console = Console()

# --- Models & Configuration ---

class RepoConfig(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    root_path: Path
    gitignore_spec: Optional[pathspec.PathSpec] = None
    tool_events: List[str] = Field(default_factory=list)

# --- Utilities ---

def get_gitignore_spec(root_path: Path) -> pathspec.PathSpec:
    gitignore_path = root_path / ".gitignore"
    patterns = [".git/", ".venv/", "__pycache__/", "*.pyc"]
    if gitignore_path.exists():
        with open(gitignore_path, "r") as f:
            patterns.extend(f.readlines())
    return pathspec.PathSpec.from_lines("gitwildmatch", patterns)

def is_ignored(path: Path, root_path: Path, spec: pathspec.PathSpec) -> bool:
    try:
        relative_path = path.relative_to(root_path)
        # Convert to posix style (forward slashes)
        posix_path = relative_path.as_posix()
        # If it's a directory, append a slash to match directory patterns (like .venv/)
        if path.is_dir() and not posix_path.endswith('/'):
            posix_path += '/'
        return spec.match_file(posix_path)
    except ValueError:
        return False

def clone_repo(url: str) -> Path:
    """Clone a GitHub repository to a temporary directory."""
    temp_dir = Path(tempfile.mkdtemp(prefix="repo_reader_"))
    try:
        subprocess.run(["git", "clone", "--depth", "1", url, str(temp_dir)], check=True, capture_output=True)
        return temp_dir
    except subprocess.CalledProcessError as e:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        raise Exception(f"Git clone failed: {e.stderr.decode()}")

# --- Agent Definition ---

agent = Agent(
    'openrouter:inclusionai/ling-2.6-flash',
    deps_type=RepoConfig,
    description="An AI agent that explores and explains code repositories.",
    system_prompt=(
        "You are an expert software engineer and repository analyst. "
        "Your goal is to help users understand a codebase by exploring files, "
        "searching for symbols, and tracing logic. "
        "Always start by listing files if you're unsure of the project structure. "
        "When explaining code, be precise and mention 'what' it does and 'why' it's designed that way."
    )
)

# --- Tools ---

@agent.tool
def list_files(ctx: RunContext[RepoConfig], subdir: str = ".") -> str:
    """Recursively list files in a subdirectory, respecting .gitignore."""
    console.print(f"[bold yellow]Tool Called: list_files({subdir})...[/bold yellow]")
    ctx.deps.tool_events.append(f"📂 Listing files in `{subdir}`...")
    target_dir = ctx.deps.root_path / subdir
    if not target_dir.exists() or not target_dir.is_dir():
        return f"Error: Directory '{subdir}' not found."

    files_list = []
    for root, dirs, files in os.walk(target_dir):
        # Filter directories in-place to avoid walking into ignored ones
        dirs[:] = [d for d in dirs if not is_ignored(Path(root) / d, ctx.deps.root_path, ctx.deps.gitignore_spec)]
        
        for file in files:
            path = Path(root) / file
            if not is_ignored(path, ctx.deps.root_path, ctx.deps.gitignore_spec):
                files_list.append(str(path.relative_to(ctx.deps.root_path)))

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
def read_file(ctx: RunContext[RepoConfig], filepath: str) -> str:
    """Read the full content of a file."""
    console.print(f"[bold yellow]Tool Called: read_file({filepath})...[/bold yellow]")
    ctx.deps.tool_events.append(f"📖 Reading `{filepath}`...")
    path = ctx.deps.root_path / filepath
    if not path.exists():
        return f"Error: File '{filepath}' not found."
    if is_ignored(path, ctx.deps.root_path, ctx.deps.gitignore_spec):
        return f"Error: File '{filepath}' is ignored by .gitignore."
    
    if is_binary(path):
        return f"Error: File '{filepath}' appears to be a binary file. Can only read text files."
    
    try:
        content = path.read_text(encoding="utf-8")
        return f"--- File: {filepath} ---\n{content}"
    except Exception as e:
        return f"Error reading file '{filepath}': {e}"

@agent.tool
def search_code(ctx: RunContext[RepoConfig], pattern: str) -> str:
    """Search for a regex pattern or string across all non-ignored files."""
    console.print(f"[bold yellow]Tool Called: search_code({pattern})...[/bold yellow]")
    ctx.deps.tool_events.append(f"🔍 Searching for `{pattern}`...")
    results = []
    regex = re.compile(pattern, re.IGNORECASE)
    
    for root, dirs, files in os.walk(ctx.deps.root_path):
        dirs[:] = [d for d in dirs if not is_ignored(Path(root) / d, ctx.deps.root_path, ctx.deps.gitignore_spec)]
        for file in files:
            path = Path(root) / file
            if is_ignored(path, ctx.deps.root_path, ctx.deps.gitignore_spec) or is_binary(path):
                continue
            
            try:
                content = path.read_text(encoding="utf-8")
                lines = content.splitlines()
                for i, line in enumerate(lines):
                    if regex.search(line):
                        rel_path = path.relative_to(ctx.deps.root_path)
                        results.append(f"{rel_path}:{i+1}: {line.strip()}")
            except:
                continue

    if not results:
        return f"No matches found for '{pattern}'."
    
    if len(results) > 50:
        return "\n".join(results[:50]) + f"\n... (truncated {len(results)-50} more results)"
    
    return "\n".join(results)

@agent.tool
def get_file_structure(ctx: RunContext[RepoConfig], filepath: str) -> str:
    """Provide a high-level summary of a file (classes and functions) without the full body."""
    console.print(f"[bold yellow]Tool Called: get_file_structure({filepath})...[/bold yellow]")
    ctx.deps.tool_events.append(f"⚡ Analyzing structure of `{filepath}`...")
    path = ctx.deps.root_path / filepath
    if not path.exists():
        return f"Error: File '{filepath}' not found."
    
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
def find_references(ctx: RunContext[RepoConfig], symbol_name: str) -> str:
    """Find all places where a specific function, class, or variable is used."""
    console.print(f"[bold yellow]Tool Called: find_references({symbol_name})...[/bold yellow]")
    ctx.deps.tool_events.append(f"🔗 Finding references to `{symbol_name}`...")
    pattern = rf"(?:\W|^){re.escape(symbol_name)}(?:\W|$)"
    return search_code(ctx, pattern)

# --- CLI Implementation ---

def main():
    import sys
    
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        target = input("Enter a local path OR a GitHub URL: ").strip()
    
    temp_dir_to_clean = None

    try:
        if target.startswith(("http://", "https://")):
            with console.status("[bold yellow]Cloning repository...[/bold yellow]"):
                root = clone_repo(target)
                temp_dir_to_clean = root
        else:
            root = Path(target).resolve() if target else Path.cwd()

        if not root.exists() or not root.is_dir():
            console.print(f"[bold red]Error:[/bold red] Path '{root}' does not exist or is not a directory.")
            return

        config = RepoConfig(
            root_path=root,
            gitignore_spec=get_gitignore_spec(root)
        )

        console.print(f"\n[bold blue]Repo Reader Active[/bold blue]")
        console.print(f"Target: [cyan]{target if target else 'Local'}[/cyan]")
        console.print(f"Analysis Path: [dim]{root}[/dim]")
        
        message_history: List[ModelMessage] = []

        while True:
            try:
                prompt = input("Ask about the repo: ")
                if prompt.lower() in ('exit', 'quit'): break
                if not prompt.strip(): continue

                with console.status("[bold green]Analyzing...[/bold green]"):
                    result = agent.run_sync(prompt, deps=config, message_history=message_history)
                
                message_history = result.new_messages()
                console.print("\n[bold magenta]Repo Intelligence:[/bold magenta]")
                console.print(Markdown(result.output))
                console.print("-" * 40 + "\n")

            except (KeyboardInterrupt, EOFError):
                break
            except Exception as e:
                console.print(f"[bold red]Error:[/bold red] {e}")

    finally:
        if temp_dir_to_clean and temp_dir_to_clean.exists():
            console.print(f"\n[dim]Cleaning up temporary files...[/dim]")
            shutil.rmtree(temp_dir_to_clean)

if __name__ == "__main__":
    main()
