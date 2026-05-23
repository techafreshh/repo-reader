import { useState, useEffect } from 'react';
import { Link } from 'react-serif'; // Note: react-router-dom Link is used instead
import { Link as RouterLink } from 'react-router-dom';
import { 
  BookOpen, 
  ArrowRight, 
  Check, 
  GitBranch, 
  Search, 
  CloudDownload, 
  Layers, 
  Terminal as TerminalIcon, 
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export default function Index() {
  const [terminalText, setTerminalText] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // High-end terminal typing animation
  useEffect(() => {
    const lines = [
      { type: 'input', text: 'uv run repo_reader.py https://github.com/pydantic/pydantic-ai' },
      { type: 'system', text: 'Initializing Repo Reader AI Agent...' },
      { type: 'success', text: '✓ Git-aware index built (142 files, 0 ignored)' },
      { type: 'target', text: 'Target Loaded: pydantic-ai (Mistral-Nemo Active)' },
      { type: 'prompt', text: 'Ask about the repo: How does the Agent class register tools?' },
      { type: 'tool', text: '🔍 Tool Called: list_files(subdir="src/pydantic_ai")' },
      { type: 'tool', text: '📂 Tool Called: read_file("src/pydantic_ai/agent.py")' },
      { type: 'tool', text: '⚡ Tool Called: get_file_structure("src/pydantic_ai/agent.py")' },
      { type: 'response', text: 'The `Agent` class registers tools using the `@agent.tool` decorator. Under the hood, this decorator wraps function objects in a `Tool` class, extracting Pydantic schema validation for arguments, and binds them to the agent\'s runtime execution context (RunContext).' }
    ];

    let currentLine = 0;
    let currentChar = 0;
    let activeText: string[] = [];

    const typeNext = () => {
      if (currentLine >= lines.length) {
        // Reset animation loop after 9 seconds
        setTimeout(() => {
          setTerminalText([]);
          currentLine = 0;
          currentChar = 0;
          activeText = [];
          typeNext();
        }, 9000);
        return;
      }

      const line = lines[currentLine];

      if (line.type === 'input' || line.type === 'prompt') {
        if (currentChar === 0) {
          activeText.push(line.type === 'input' ? '➜ ' : 'Ask about the repo: ');
        }
        
        const prefix = line.type === 'input' ? '➜ ' : 'Ask about the repo: ';
        activeText[currentLine] = prefix + line.text.substring(0, currentChar + 1);
        setTerminalText([...activeText]);
        currentChar++;

        if (currentChar < line.text.length) {
          setTimeout(typeNext, 20 + Math.random() * 30);
        } else {
          currentLine++;
          currentChar = 0;
          setTimeout(typeNext, 600);
        }
      } else {
        activeText.push(line.text);
        setTerminalText([...activeText]);
        currentLine++;
        setTimeout(typeNext, 700);
      }
    };

    typeNext();

    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans transition-colors duration-300 select-none selection:bg-primary/20 selection:text-foreground overflow-x-hidden">
      
      {/* Decorative Brand Accent (Top Hairline Soft Colorband) */}
      <div className="h-1 w-full bg-primary" />

      {/* Header / Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="flex h-16 max-w-6xl items-center justify-between px-6 mx-auto">
          {/* Logo with signature spike-mark asterisk */}
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold text-xl select-none font-serif">✦</span>
            <span className="text-lg font-semibold tracking-tight font-serif text-foreground">RepoReader</span>
          </div>

          {/* Desktop Navigation links */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted hover:text-foreground transition-colors font-sans">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted hover:text-foreground transition-colors font-sans font-medium">How it works</a>
            <a href="#tech" className="text-sm font-medium text-muted hover:text-foreground transition-colors font-sans">Architecture</a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:text-foreground hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-all"
              aria-label="Toggle theme"
            >
              {theme === 'deep-dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a 
              href="https://github.com/techafreshh/repo-reader" 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-xs font-medium text-muted hover:text-foreground hover:bg-neutral-100/50 transition-all gap-2"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 16 16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Star on GitHub
            </a>
            <RouterLink to="/chat">
              <Button size="sm" className="bg-primary hover:bg-[#a9583e] active:bg-[#a9583e] text-white font-medium rounded-md px-4 gap-1.5 h-9">
                Launch App
                <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
              </Button>
            </RouterLink>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-background px-6 py-4 flex flex-col gap-4 animate-accordion-down">
            <a 
              href="#features" 
              className="text-sm font-medium text-muted hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              className="text-sm font-medium text-muted hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              How it works
            </a>
            <a 
              href="#tech" 
              className="text-sm font-medium text-muted hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Architecture
            </a>
            <hr className="border-border/60" />
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleTheme}
                className="flex h-10 items-center justify-center rounded-md border border-border bg-transparent text-sm font-semibold text-muted hover:text-foreground transition-all gap-2"
              >
                {theme === 'deep-dark' ? (
                  <><Sun className="h-4 w-4" /> Light Mode</>
                ) : (
                  <><Moon className="h-4 w-4" /> Dark Mode</>
                )}
              </button>
              <a 
                href="https://github.com/techafreshh/repo-reader" 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 items-center justify-center rounded-md border border-border bg-transparent text-sm font-semibold text-muted hover:text-foreground transition-all gap-2"
              >
                GitHub Repo
              </a>
              <RouterLink to="/chat" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full bg-primary hover:bg-[#a9583e] text-white font-medium h-10 rounded-md">
                  Launch Chat App
                </Button>
              </RouterLink>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-6 flex flex-col space-y-6 md:space-y-7">
            <div className="inline-flex self-start items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-medium tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Built with Pydantic AI
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground font-serif leading-[1.05] -letter-spacing-[1.5px]">
              Talk to your <span className="italic text-primary">codebase</span>.
            </h1>
            
            <p className="text-base sm:text-lg text-muted font-sans leading-relaxed max-w-xl">
              An intelligent suite of AI agents capable of mapping directory architectures, searching regex patterns, and delivering precision traces for complex repositories. Built with a warm, elegant editorial voice.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <RouterLink to="/chat">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-[#a9583e] text-white font-medium px-8 py-6 rounded-md text-sm gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Button>
              </RouterLink>
              <a 
                href="https://github.com/techafreshh/repo-reader"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex h-[52px] items-center justify-center rounded-md border border-border bg-background px-8 text-sm font-semibold text-muted hover:text-foreground hover:bg-neutral-100 transition-all gap-2"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Star on GitHub
              </a>
            </div>
            
            <div className="pt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-muted font-mono">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary stroke-[2.5]" />
                <span>Git-Aware Filter</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary stroke-[2.5]" />
                <span>GitHub Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary stroke-[2.5]" />
                <span>Local Workspaces</span>
              </div>
            </div>
          </div>

          {/* Right Visual Column (Dark Navy code window mockup) */}
          <div className="lg:col-span-6 relative mt-6 lg:mt-0 flex justify-center">
            
            {/* Terminal Window Mock (Surface Dark) */}
            <div className="w-full max-w-[500px] rounded-lg border border-[#1f1e1b] bg-[#181715] overflow-hidden shadow-xl flex flex-col font-mono text-xs md:text-sm">
              
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#1f1e1b]/80 border-b border-[#181715]">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#181715] opacity-40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#181715] opacity-40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#181715] opacity-40" />
                </div>
                <span className="text-[10px] text-[#a09d96] font-semibold">repo_reader.py</span>
                <div className="w-8" />
              </div>

              {/* Terminal Logs */}
              <div className="p-4 md:p-5 space-y-3 flex-1 min-h-[300px] max-h-[360px] overflow-y-auto leading-relaxed text-[#faf9f5]">
                {terminalText.map((line, idx) => {
                  if (line.startsWith('➜')) {
                    return (
                      <div key={idx} className="flex gap-2 text-[#faf9f5]">
                        <span className="text-primary font-bold">➜</span>
                        <span>{line.substring(2)}</span>
                      </div>
                    );
                  }
                  if (line.startsWith('Ask about the repo:')) {
                    return (
                      <div key={idx} className="text-[#a09d96]">
                        <span className="text-[#faf9f5] font-semibold">Ask about the repo:</span>
                        <span>{line.substring(20)}</span>
                      </div>
                    );
                  }
                  if (line.startsWith('✓') || line.startsWith('Target Loaded')) {
                    return <div key={idx} className="text-[#5db872]">{line}</div>;
                  }
                  if (line.startsWith('🔍') || line.startsWith('📂') || line.startsWith('⚡')) {
                    return <div key={idx} className="text-[#e8a55a] pl-4 border-l border-[#cc785c]/30 my-1">{line}</div>;
                  }
                  if (line.startsWith('The `Agent`')) {
                    return (
                      <div key={idx} className="text-[#faf9f5] mt-2 bg-[#252320] p-3 rounded-md border border-[#1f1e1b]">
                        <span className="text-primary font-bold block mb-1">Repo Intelligence:</span>
                        {line}
                      </div>
                    );
                  }
                  return <div key={idx} className="text-[#a09d96]">{line}</div>;
                })}
                <div className="inline-block w-1.5 h-3.5 bg-[#faf9f5] animate-pulse ml-0.5" />
              </div>
            </div>

            {/* Chat UI Overlay Floating Card (Surface Dark Elevated) */}
            <div className="absolute -bottom-6 -left-6 hidden md:flex flex-col w-[260px] bg-[#252320] border border-[#1f1e1b] rounded-lg p-4 shadow-2xl gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#1f1e1b]">
                <span className="text-primary font-bold text-sm select-none font-serif">✦</span>
                <span className="text-[10px] font-bold text-[#faf9f5] font-mono">Chat Stream Active</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="bg-[#cc785c]/25 text-[#faf9f5] rounded-md rounded-br-none px-3 py-2 text-[10px] self-end max-w-[90%] font-medium">
                  List all FastAPI routes.
                </div>
                <div className="bg-[#1f1e1b] text-[#faf9f5]/90 border border-[#181715] rounded-md rounded-bl-none px-3 py-2 text-[10px] self-start max-w-[90%] leading-relaxed">
                  Found <span className="text-primary font-semibold font-serif">4 active routes</span> in <span className="font-mono text-xs">chat_api.py</span>:<br/>
                  • POST /initialize<br/>
                  • POST /chat<br/>
                  • POST /chat/stream
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section (Light Cream Cards surface) */}
      <section id="features" className="py-24 border-t border-border/80 bg-neutral-100/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight font-serif text-foreground">
              Deep intelligence for every commit.
            </h2>
            <p className="text-muted text-sm md:text-base leading-relaxed">
              More than just a chatbot. Repo Reader uses specialized tools to navigate your codebase like a senior engineer.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 - feature-card (#efe9de surface-card) */}
            <div className="flex flex-col p-8 rounded-lg border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary mb-6">
                <GitBranch className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground mb-3 font-serif">Git-Native Awareness</h3>
              <p className="text-muted text-sm leading-relaxed font-sans">
                Interrogates local directories while automatically respecting complex `.gitignore` wildmatch sequences. Keeps build artifacts and dependencies clean.
              </p>
            </div>

            {/* Feature 2 - feature-card */}
            <div className="flex flex-col p-8 rounded-lg border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary mb-6">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground mb-3 font-serif">Deep Analysis Tools</h3>
              <p className="text-muted text-sm leading-relaxed font-sans">
                Loaded with automated utilities to list contents, perform regex searches, inspect symbol definitions, and extract abstract workspace maps without heavy tokens.
              </p>
            </div>

            {/* Feature 3 - feature-card */}
            <div className="flex flex-col p-8 rounded-lg border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary mb-6">
                <CloudDownload className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground mb-3 font-serif">Live GitHub Sync</h3>
              <p className="text-muted text-sm leading-relaxed font-sans">
                Paste any live public GitHub repository URL. The agent automatically clones it down to a sandboxed directory, maps architecture, and scrubs files when session terminates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 border-t border-border/80 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Steps Column */}
            <div className="lg:col-span-6 flex flex-col space-y-10">
              <h2 className="text-3xl md:text-4xl font-normal tracking-tight font-serif text-foreground max-w-md">
                Zero indexing steps.<br/>Instant context.
              </h2>
              
              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-xs font-bold text-primary font-mono">
                    01
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-foreground font-serif">Connect Codebase Workspace</h4>
                    <p className="text-muted text-xs md:text-sm">
                      Paste a GitHub Repository link or set a local environment route. Our agent instantly indexes structure in memory.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-xs font-bold text-primary font-mono">
                    02
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-foreground font-serif">Prompt in Plain English</h4>
                    <p className="text-muted text-xs md:text-sm">
                      Ask about specific functions, authentication routes, or logic layouts: "How does the session cleanup handle files?"
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-xs font-bold text-primary font-mono">
                    03
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-foreground font-serif">Inspect Tool Traces</h4>
                    <p className="text-muted text-xs md:text-sm">
                      Watch the agent select tools, read file structures, trace dependencies, and produce detailed code explanations.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Editor Block Column (Code window card over Surface Dark) */}
            <div className="lg:col-span-6">
              <div className="rounded-lg border border-[#1f1e1b] bg-[#181715] p-1 shadow-xl overflow-hidden">
                <div className="bg-[#1f1e1b]/40 rounded-md p-5 font-mono text-[11px] md:text-xs text-[#a09d96] space-y-4 leading-relaxed overflow-x-auto">
                  <div className="flex gap-1.5 opacity-40">
                    <div className="w-2 h-2 rounded-full bg-[#faf9f5]" />
                    <div className="w-2 h-2 rounded-full bg-[#faf9f5]" />
                    <div className="w-2 h-2 rounded-full bg-[#faf9f5]" />
                  </div>
                  
                  <div className="space-y-3 text-[#faf9f5]/90">
                    <div>
                      <span className="text-[#a09d96]"># Clone project and configure variables</span>
                      <div className="text-[#faf9f5] mt-1">git clone https://github.com/techafreshh/repo-reader && cd repo-reader</div>
                    </div>
                    
                    <div>
                      <span className="text-[#a09d96]"># Install high-performance dependencies via uv</span>
                      <div className="text-[#faf9f5] mt-1">uv sync</div>
                    </div>

                    <div>
                      <span className="text-[#a09d96]"># Run chat API service on port 7643</span>
                      <div className="text-[#faf9f5] mt-1">uv run chat_api.py --port 7643</div>
                    </div>

                    <div>
                      <span className="text-[#a09d96]"># Build and deploy securely with multi-container docker</span>
                      <div className="text-[#faf9f5] mt-1">docker compose up -d --build</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Tech Stack Bar (Surface soft section) */}
      <section id="tech" className="py-16 border-t border-border/80 bg-neutral-100/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="space-y-1 text-center lg:text-left">
              <h3 className="text-xl font-normal font-serif text-foreground">Modern Architecture</h3>
              <p className="text-muted text-xs md:text-sm font-sans">
                Engineered for speed, strict types, and robust AI orchestration patterns.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6 text-muted">
              <div className="flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-semibold font-sans tracking-wide text-foreground uppercase">FastAPI</span>
              </div>
              <div className="flex items-center gap-2">
                <TerminalIcon className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-semibold font-sans tracking-wide text-foreground uppercase">Pydantic AI</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-semibold font-sans tracking-wide text-foreground uppercase">Docker</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold font-sans tracking-wide text-foreground uppercase">React + TS</span>
              </div>
              <div className="text-xs font-mono font-semibold text-foreground">
                uv package manager
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (Dark Navy Surface) */}
      <footer className="py-16 bg-[#181715] text-[#a09d96] border-t border-[#1f1e1b]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80">
            <span className="text-primary font-bold text-lg select-none font-serif">✦</span>
            <span className="text-sm font-semibold tracking-tight font-serif text-[#faf9f5]">RepoReader</span>
          </div>
          
          <div className="text-xs font-sans">
            &copy; 2026 RepoReader. Open-source under MIT License.
          </div>
          
          <div className="flex gap-4">
            <a href="https://github.com/techafreshh/repo-reader" target="_blank" rel="noreferrer" className="text-[#a09d96] hover:text-[#faf9f5] transition-colors">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
