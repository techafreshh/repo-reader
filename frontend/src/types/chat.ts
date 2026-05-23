export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  toolTraces?: string[];
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
