export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

export type ToolCallStatus = 'running' | 'done' | 'error';

export interface ToolCall {
  id: string;
  name: string;
  status: ToolCallStatus;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  toolCalls?: ToolCall[];
}

export interface WebhookConfig {
  url: string;
  isConnected: boolean;
  isExternal?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  webhookConfig: WebhookConfig;
}
