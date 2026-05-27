import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, WebhookConfig } from '@/types/chat';

const WEBHOOK_STORAGE_KEY = 'voltchat-webhook-url';
const MESSAGES_STORAGE_KEY = 'voltchat-messages';
const SESSION_ID_STORAGE_KEY = 'voltchat-session-id';
const STREAMING_ENABLED_KEY = 'voltchat-streaming-enabled';

const generateId = () => Math.random().toString(36).substring(2, 15);

export function useChat() {
  const ENV_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL;
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
    url: ENV_WEBHOOK_URL || '',
    isConnected: !!ENV_WEBHOOK_URL,
    isExternal: !!ENV_WEBHOOK_URL, // Track if it's fixed via Env
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
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem(WEBHOOK_STORAGE_KEY);
    const savedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
    const savedStreaming = localStorage.getItem(STREAMING_ENABLED_KEY);

    if (!ENV_WEBHOOK_URL && savedUrl) {
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

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Persist streaming setting to localStorage
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
      if (ENV_WEBHOOK_URL) return; // Prevent manual updates if env var is set
      const trimmedUrl = url.trim();
      localStorage.setItem(WEBHOOK_STORAGE_KEY, trimmedUrl);
      setWebhookConfig({
        url: trimmedUrl,
        isConnected: trimmedUrl.length > 0,
        isExternal: false,
      });
      clearMessages();
    }, [clearMessages, ENV_WEBHOOK_URL]);
  
    const toggleStreaming = useCallback(() => {
      setIsStreamingEnabled((prev) => !prev);
    }, []);

    const stopStreaming = useCallback(() => {
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
        streamCleanupRef.current = null;
      }
      setMessages(prev => prev.map(m => m.status === 'streaming' ? { ...m, status: 'complete' } : m));
      setIsLoading(false);
    }, []);
  
    const simulateStreaming = useCallback(
      (messageId: string, fullContent: string) => {
        let currentIndex = 0;
        const chunkSize = 2 + Math.floor(Math.random() * 3); // 2-4 chars at a time
        const baseDelay = 20; // ms between chunks
  
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
            streamCleanupRef.current = null;
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
  
        streamCleanupRef.current = () => clearInterval(streamInterval);
      },
      []
    );
  
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
          status: isStreamingEnabled ? 'streaming' : 'complete',
          toolTraces: [],
        };
  
        setMessages((prev) => [...prev, placeholderMessage]);
  
        try {
          if (!webhookConfig.url) {
            // Demo mode - simulate a response
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
  
          // Determine the correct URL for streaming vs non-streaming
          const baseUrl = webhookConfig.url;
          const streamUrl = isStreamingEnabled
            ? baseUrl.replace(/\/chat\/?$/, '/chat/stream')
            : baseUrl;

          console.log(`[useChat] Sending message to: ${streamUrl}`, {
            message: content.trim(),
            sessionId,
            streaming: isStreamingEnabled,
          });

          const response = await fetch(streamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(ENV_API_TOKEN ? { 'Authorization': `Bearer ${ENV_API_TOKEN}` } : {}),
            },
            body: JSON.stringify({
              message: content.trim(),
              timestamp: new Date().toISOString(),
              sessionId,
            }),
          });

          console.log(`[useChat] Response status: ${response.status} ${response.statusText}`);
  
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          if (isStreamingEnabled && response.body) {
            // --- Real streaming via ReadableStream ---
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            const traces: string[] = [];
            let cancelled = false;

            streamCleanupRef.current = () => {
              cancelled = true;
              reader.cancel();
            };

            let buffer = '';
            let isReadingThoughts = true;

            while (true) {
              const { done, value } = await reader.read();
              if (done || cancelled) break;

              const chunk = decoder.decode(value, { stream: !done });
              
              if (isReadingThoughts) {
                buffer += chunk;
                
                // Process complete lines from the buffer
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                  const line = buffer.slice(0, newlineIndex);
                  buffer = buffer.slice(newlineIndex + 1);
                  
                  if (line.startsWith('__THOUGHT__:')) {
                    const thought = line.slice('__THOUGHT__:'.length);
                    traces.push(thought);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, toolTraces: [...traces] }
                          : m
                      )
                    );
                  } else {
                    // We found a complete line that is NOT a thought!
                    // This means thoughts are finished.
                    isReadingThoughts = false;
                    // Append this line and the newline back, plus whatever is left in the buffer
                    accumulatedContent += line + '\n' + buffer;
                    buffer = ''; // Clear buffer since we moved it
                    
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: accumulatedContent }
                          : m
                      )
                    );
                    break;
                  }
                }
              } else {
                // Thoughts are finished, stream the remaining text directly
                accumulatedContent += chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              }
            }

            // Handle any residual buffer if the stream finishes without newline
            if (isReadingThoughts && buffer.length > 0) {
              if (buffer.startsWith('__THOUGHT__:')) {
                const thought = buffer.slice('__THOUGHT__:'.length);
                traces.push(thought);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolTraces: [...traces] }
                      : m
                  )
                );
              } else {
                accumulatedContent += buffer;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              }
            }

            // Finalize the message
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { 
                      ...m, 
                      content: accumulatedContent, 
                      status: 'complete', 
                      toolTraces: traces.length > 0 ? traces : undefined 
                    }
                  : m
              )
            );
            setIsLoading(false);
            streamCleanupRef.current = null;
          } else {
            // --- Non-streaming: regular JSON response ---
            const data = await response.json();
            console.log('[useChat] Received data:', data);
            const responseContent =
              (typeof data.output === 'object' ? data.output?.response : data.output) ||
              data.response ||
              data.message ||
              data.content ||
              JSON.stringify(data);
  
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { 
                      ...m, 
                      content: responseContent, 
                      status: 'complete',
                      toolTraces: data.tool_events && data.tool_events.length > 0 ? data.tool_events : undefined
                    }
                  : m
              )
            );
            setIsLoading(false);
          }
        } catch (error) {
          console.error('[useChat] Send message error:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Connection failed';
  
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: `Error: ${errorMessage}. Check your webhook URL and try again.`,
                    status: 'error',
                  }
                : m
            )
          );
          setIsLoading(false);
        }
      },
      [webhookConfig.url, isLoading, simulateStreaming, sessionId, isStreamingEnabled]
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
        
        // Add a system message about the upload
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
    };
  }
function getDemoResponse(input: string): string {
  const responses = [
    "I'm VoltChat running in demo mode. Configure a webhook URL to connect to your AI backend.",
    "This is a simulated response. Your message was received instantly — that's the VoltChat difference.",
    "Demo mode active. Set up your webhook endpoint to see real AI responses with the same electric speed.",
    "How far connect your webhook now.. wetin dey worry you sef😂",
    "No webhook configured. I'm showing you how fast responses feel in VoltChat. Ready to connect your backend?",
  ];

  if (input.toLowerCase().includes('hello') || input.toLowerCase().includes('hi')) {
    return "Connected. Ready. What can I help you build today?";
  }

  if (input.toLowerCase().includes('webhook')) {
    return "Click the ⚡ icon in the top right to configure your webhook URL. VoltChat will POST your messages and display responses with simulated streaming.";
  }

  return responses[Math.floor(Math.random() * responses.length)];
}
