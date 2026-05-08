import random
from pydantic_ai import Agent
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown

# Load environment variables (API keys, etc.)
load_dotenv()

# Setup Rich console for beautiful terminal output
console = Console()

# Define the agent
# Using OpenRouter as shown in the example, or fallback to a common provider
agent = Agent(
    'openrouter:mistralai/mistral-nemo',
    description='A simple dice-rolling agent',
    system_prompt=(
        "You are a helpful assistant with a dice-rolling tool. "
        "When a user asks to roll a die or dice, use your tool and report the result."
    )
)

@agent.tool_plain
def roll_dice() -> str:
    """Roll a six-sided die and return the result."""
    console.print("[bold yellow]Tool Called: roll_dice...[/bold yellow]")
    result = random.randint(1, 6)
    return f"The die rolled a {result}."

def main():
    console.print("[italic bold blue]Starting Dice Agent (Conversational Mode)...[/italic bold blue]")
    console.print("[dim]Type 'exit' or 'quit' to stop.[/dim]\n")
    
    while True:
        try:
            prompt = input("How can I help you today? : ")
            
            if prompt.lower() in ('exit', 'quit', '/exit', '/quit'):
                console.print("[bold yellow]Goodbye![/bold yellow]")
                break
                
            if not prompt.strip():
                continue

            # Running the agent synchronously without history as requested
            result = agent.run_sync(prompt)

            console.print("\n[bold green]Agent Response:[/bold green]")
            
            # Render markdown output
            md = Markdown(result.output)
            console.print(md)
            console.print("-" * 20 + "\n")

        except KeyboardInterrupt:
            console.print("\n[bold yellow]Exiting...[/bold yellow]")
            break
        except Exception as e:
            console.print(f"\n[bold red]Error:[/bold red] {e}")

if __name__ == "__main__":
    main()
