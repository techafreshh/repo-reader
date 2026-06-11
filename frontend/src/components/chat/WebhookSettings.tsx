import { useState } from 'react';
import { X, Link, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface WebhookSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
  onUpdateUrl: (url: string) => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function WebhookSettings({
  isOpen,
  onClose,
  webhookUrl,
  onUpdateUrl,
}: WebhookSettingsProps) {
  const [inputUrl, setInputUrl] = useState(webhookUrl);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');

  const handleSave = () => {
    onUpdateUrl(inputUrl);
    onClose();
  };

  const handleTest = async () => {
    if (!inputUrl.trim()) return;

    setTestStatus('testing');
    setTestError('');

    try {
      console.log(`[WebhookSettings] Testing connection to: ${inputUrl}/agui`);
      const response = await fetch(`${inputUrl}/agui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: 'test-connection',
          runId: 'test-run',
          messages: [{ id: '1', role: 'user', content: 'ping' }],
          state: {},
          tools: [],
          context: [],
          forwardedProps: {},
        }),
      });

      console.log(`[WebhookSettings] Test response status: ${response.status}`);

      if (response.ok) {
        setTestStatus('success');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[WebhookSettings] Test connection error:', error);
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const handleClear = () => {
    setInputUrl('');
    onUpdateUrl('');
    setTestStatus('idle');
    setTestError('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-full max-w-md',
          'animate-slide-in-right',
          'border-l border-border bg-card shadow-2xl'
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">API Configuration</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="webhook-url" className="text-sm font-medium">
              API URL
            </Label>
            <Input
              id="webhook-url"
              type="url"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setTestStatus('idle');
              }}
              placeholder="http://localhost:7643"
              className={cn(
                'font-mono text-sm',
                testStatus === 'success' && 'border-success focus-visible:ring-success',
                testStatus === 'error' && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            <p className="text-xs text-muted-foreground">
              Connect to your Repo Reader API server (e.g. http://localhost:7643)
            </p>
          </div>

          {/* Test status feedback */}
          {testStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Connection successful
            </div>
          )}
          {testStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {testError || 'Connection failed'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!inputUrl.trim() || testStatus === 'testing'}
              className="flex-1"
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save
            </Button>
          </div>

          {inputUrl && (
            <Button
              variant="ghost"
              onClick={handleClear}
              className="w-full text-muted-foreground hover:text-destructive"
            >
              Clear API URL
            </Button>
          )}

          {/* Request format info */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <h3 className="text-sm font-medium">AG-UI Protocol</h3>
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
{`POST /agui
Content-Type: application/json

{
  "threadId": "session-uuid",
  "runId": "run-uuid",
  "messages": [
    { "id": "1", "role": "user", "content": "Hello" }
  ],
  "state": { "session_id": "..." },
  "tools": [],
  "context": [],
  "forwardedProps": {}
}`}
            </pre>
            <h3 className="text-sm font-medium">SSE Response</h3>
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
{`event: TEXT_MESSAGE_START
event: TEXT_MESSAGE_CONTENT
data: {"delta": "Hello!"}
event: TEXT_MESSAGE_END
event: RUN_FINISHED`}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
