import { useState, useCallback, useEffect, useRef } from 'react';
import { HttpAgent, EventType } from '@ag-ui/client';
import type { BaseEvent } from '@ag-ui/core';
import type { Message, ToolCall, WebhookConfig } from '@/types/chat';

const WEBHOOK_STORAGE_KEY = 'voltchat-api-url';
const MESSAGES_STORAGE_KEY = 'voltchat-messages';
const SESSION_ID_STORAGE_KEY = 'voltchat-session-id';
const STREAMING_ENABLED_KEY = 'voltchat-streaming-enabled';

const generateId = () => crypto.randomUUID();

export function useChat() {
  const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const ENV_API_TOKEN = import.meta.env.VITE_API_TOKEN;
  const ENV_UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;
  const ENV_APP_NAME = import.meta.env.VITE_APP_NAME || 'VoltChat';
  const ENV_APP_DESCRIPTION = import.meta.env.VITE_APP_DESCRIPTION || 'A high-performance chat interface.';
  const ENV_ENABLE_UPLOADS = import.meta.env.VITE_ENABLE_UPLOADS === 'true';
  const ENV_APP_LOGO_URL = import.meta.env.VITE_APP_LOGO_URL || '';
  const ENV_FAVICON_URL = import.meta.env.VITE_FAVICON_URL || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: ENV_API_BASE_URL || '',
    isConnected: !!ENV_API_BASE_URL,
    isExternal: !!ENV_API_BASE_URL,
  });
  const [isStreamingEnabled, setIsStreamingEnabled] = useState(true);
  const [sessionId, setSessionId] = useState<string>(() => {
    let savedSessionId = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (!savedSessionId) {
      savedSessionId = generateId();
      sessionStorage.setItem(SESSION_ID_STORAGE_KEY, savedSessionId);
    }
    return savedSessionId;
  });
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [treeVersion, setTreeVersion] = useState(0);

  useEffect(() => {
    const savedUrl = localStorage.getItem(WEBHOOK_STORAGE_KEY);
    const savedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
    const savedStreaming = localStorage.getItem(STREAMING_ENABLED_KEY);

    if (!ENV_API_BASE_URL && savedUrl) {
      setWebhookConfig({ url: savedUrl, isConnected: true, isExternal: false });
    }

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(
          parsed.map((m: Message) => ({
            ...m,
            timestamp: new Date(m.timestamp),
            status: m.status === 'streaming' ? 'complete' : m.status,
          }))
        );
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }

    if (savedStreaming !== null) {
      setIsStreamingEnabled(JSON.parse(savedStreaming));
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STREAMING_ENABLED_KEY, JSON.stringify(isStreamingEnabled));
  }, [isStreamingEnabled]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
    const newSessionId = generateId();
    sessionStorage.setItem(SESSION_ID_STORAGE_KEY, newSessionId);
    setSessionId(newSessionId);
  }, []);

  const updateWebhookUrl = useCallback((url: string) => {
    if (ENV_API_BASE_URL) return;
    const trimmedUrl = url.trim();
    localStorage.setItem(WEBHOOK_STORAGE_KEY, trimmedUrl);
    setWebhookConfig({
      url: trimmedUrl,
      isConnected: trimmedUrl.length > 0,
      isExternal: false,
    });
    clearMessages();
  }, [clearMessages, ENV_API_BASE_URL]);

  const toggleStreaming = useCallback(() => {
    setIsStreamingEnabled((prev) => !prev);
  }, []);

  const stopStreaming = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    setMessages(prev => prev.map(m => m.status === 'streaming' ? { ...m, status: 'complete' } : m));
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setIsLoading(true);
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        status: 'complete',
      };

      setMessages((prev) => [...prev, userMessage]);

      const assistantMessageId = generateId();
      const placeholderMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'streaming',
        toolCalls: [],
      };

      setMessages((prev) => [...prev, placeholderMessage]);

      if (!webhookConfig.url) {
        const demoResponse = getDemoResponse(content);
        setTimeout(() => {
          if (isStreamingEnabled) {
            simulateStreaming(assistantMessageId, demoResponse);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: demoResponse, status: 'complete' }
                  : m
              )
            );
            setIsLoading(false);
          }
        }, 300);
        return;
      }

      try {
        const agent = new HttpAgent({
          url: `${webhookConfig.url}/agui`,
          threadId: sessionId,
          initialState: { session_id: sessionId },
          fetch: window.fetch.bind(window),
        });

        // Build AG-UI messages from our message history
        const aguiMessages = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content || undefined,
          }));

        const observable = agent.run({
          threadId: sessionId,
          runId: crypto.randomUUID(),
          messages: [
            ...aguiMessages,
            { id: userMessage.id, role: 'user' as const, content: content.trim() },
          ],
          state: { session_id: sessionId },
          tools: [],
          context: [],
          forwardedProps: {},
        });

        let accumulatedContent = '';
        const toolCalls: ToolCall[] = [];

        const subscription = observable.subscribe({
          next: (event: BaseEvent) => {
            // Debug: log all tool-call events
            if (
              event.type === EventType.TOOL_CALL_START ||
              event.type === EventType.TOOL_CALL_ARGS ||
              event.type === EventType.TOOL_CALL_END ||
              event.type === EventType.TOOL_CALL_RESULT
            ) {
              console.log('[AG-UI Event]', event.type, JSON.stringify(event));
            }
            switch (event.type) {
              case EventType.TOOL_CALL_START: {
                const toolName = (event as any).toolCallName;
                const toolCallId = (event as any).toolCallId;
                toolCalls.push({ id: toolCallId, name: toolName, status: 'running' });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc })) }
                      : m
                  )
                );
                break;
              }
              case EventType.TOOL_CALL_ARGS: {
                const toolCallId = (event as any).toolCallId;
                const delta = (event as any).delta;
                const index = toolCalls.findIndex((t) => t.id === toolCallId);
                if (index !== -1) {
                  toolCalls[index] = {
                    ...toolCalls[index],
                    args: (toolCalls[index].args || '') + (delta || ''),
                  };
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc })) }
                      : m
                  )
                );
                break;
              }
              case EventType.TOOL_CALL_RESULT: {
                const toolCallId = (event as any).toolCallId;
                const content = (event as any).content;
                const index = toolCalls.findIndex((t) => t.id === toolCallId);
                if (index !== -1) {
                  toolCalls[index] = {
                    ...toolCalls[index],
                    result: content,
                  };
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc })) }
                      : m
                  )
                );
                break;
              }
              case EventType.TOOL_CALL_END: {
                const toolCallId = (event as any).toolCallId;
                const index = toolCalls.findIndex((t) => t.id === toolCallId);
                if (index !== -1) {
                  toolCalls[index] = {
                    ...toolCalls[index],
                    status: 'done',
                  };
                  if (toolCalls[index].name === 'initialize_repo') {
                    setTreeVersion((v) => v + 1);
                  }
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc })) }
                      : m
                  )
                );
                break;
              }
              case EventType.TEXT_MESSAGE_START: {
                break;
              }
              case EventType.TEXT_MESSAGE_CONTENT: {
                const delta = (event as any).delta;
                if (delta) {
                  accumulatedContent += delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: accumulatedContent, toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({ ...tc })) : undefined }
                        : m
                    )
                  );
                }
                break;
              }
              case EventType.TEXT_MESSAGE_END: {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          content: accumulatedContent,
                          toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({ ...tc })) : undefined,
                        }
                      : m
                  )
                );
                break;
              }
              case EventType.RUN_FINISHED: {
                setIsLoading(false);
                subscriptionRef.current = null;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          status: 'complete',
                          toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({ ...tc })) : undefined,
                        }
                      : m
                  )
                );
                if (
                  accumulatedContent.includes('Repository initialized') ||
                  accumulatedContent.includes('analyzed the codebase') ||
                  toolCalls.some((t) => t.name === 'initialize_repo')
                ) {
                  setTreeVersion((v) => v + 1);
                }
                break;
              }
              case EventType.RUN_ERROR: {
                const errorMsg = (event as any).message || 'Unknown error';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: `Error: ${errorMsg}`, status: 'error', toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({ ...tc })) : undefined }
                      : m
                  )
                );
                setIsLoading(false);
                subscriptionRef.current = null;
                break;
              }
            }
          },
          complete: () => {
            setIsLoading(false);
            subscriptionRef.current = null;
          },
          error: (err: Error) => {
            console.error('[useChat] AG-UI stream error:', err);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: `Error: ${err.message}`, status: 'error' }
                  : m
              )
            );
            setIsLoading(false);
            subscriptionRef.current = null;
          },
        });

        subscriptionRef.current = subscription;
      } catch (error) {
        console.error('[useChat] Send message error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Connection failed';

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: `Error: ${errorMessage}. Check your API URL and try again.`,
                  status: 'error',
                }
              : m
          )
        );
        setIsLoading(false);
      }
    },
    [webhookConfig.url, isLoading, sessionId, isStreamingEnabled, messages]
  );

  const simulateStreaming = useCallback(
    (messageId: string, fullContent: string) => {
      let currentIndex = 0;
      const chunkSize = 2 + Math.floor(Math.random() * 3);
      const baseDelay = 20;

      const streamInterval = setInterval(() => {
        currentIndex += chunkSize;

        if (currentIndex >= fullContent.length) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: fullContent, status: 'complete' }
                : m
            )
          );
          clearInterval(streamInterval);
          setIsLoading(false);
          subscriptionRef.current = null;
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: fullContent.slice(0, currentIndex) }
                : m
            )
          );
        }
      }, baseDelay + Math.random() * 15);

      subscriptionRef.current = { unsubscribe: () => clearInterval(streamInterval) };
    },
    []
  );

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    if (lastUserMessage) {
      setMessages((prev) => prev.slice(0, -1));
      sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  const uploadFile = useCallback(async (file: File) => {
    if (!ENV_UPLOAD_URL) {
      console.warn('VITE_UPLOAD_URL is not configured');
      return { success: false, message: 'Upload URL not configured' };
    }

    setIsLoading(true);
    try {
      console.log(`[useChat] Uploading file to: ${ENV_UPLOAD_URL}`, { fileName: file.name, fileSize: file.size });
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(ENV_UPLOAD_URL, {
        method: 'POST',
        headers: {
          ...(ENV_API_TOKEN ? { 'Authorization': `Bearer ${ENV_API_TOKEN}` } : {}),
        },
        body: formData,
      });

      console.log(`[useChat] Upload response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[useChat] Upload success data:', data);
      
      const systemMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Successfully uploaded file: **${file.name}**`,
        timestamp: new Date(),
        status: 'complete',
      };
      setMessages(prev => [...prev, systemMessage]);

      return { success: true, data };
    } catch (error) {
      console.error('[useChat] Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Error uploading file: ${errorMessage}`,
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [ENV_UPLOAD_URL, ENV_API_TOKEN]);
  			
  return {
    messages,
    isLoading,
    webhookConfig,
    isStreamingEnabled,
    sendMessage,
    updateWebhookUrl,
    toggleStreaming,
    clearMessages,
    retryLastMessage,
    stopStreaming,
    uploadFile,
    hasUploadConfig: !!ENV_UPLOAD_URL && ENV_ENABLE_UPLOADS,
    appName: ENV_APP_NAME,
    appDescription: ENV_APP_DESCRIPTION,
    appLogoUrl: ENV_APP_LOGO_URL,
    sessionId,
    treeVersion,
  };
}

function getDemoResponse(input: string): string {
  const responses = [
    "I'm VoltChat running in demo mode. Configure an API URL to connect to your AI backend.",
    "This is a simulated response. Your message was received instantly — that's the VoltChat difference.",
    "Demo mode active. Set up your API endpoint to see real AI responses with the same electric speed.",
    "No API configured. I'm showing you how fast responses feel in VoltChat. Ready to connect your backend?",
  ];

  if (input.toLowerCase().includes('hello') || input.toLowerCase().includes('hi')) {
    return "Connected. Ready. What can I help you build today?";
  }

  if (input.toLowerCase().includes('api') || input.toLowerCase().includes('webhook')) {
    return "Click the ⚡ icon in the top right to configure your API URL. VoltChat will connect to your Repo Reader backend.";
  }

  return responses[Math.floor(Math.random() * responses.length)];
}
