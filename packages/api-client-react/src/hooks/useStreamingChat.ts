/**
 * useStreamingChat — SSE-based streaming AI chat hook.
 *
 * The server exposes POST /api/chat/stream which responds with
 * Content-Type: text/event-stream.  Each SSE event is a JSON chunk:
 *
 *   data: {"delta":"hello "}\n\n
 *   data: {"delta":"world"}\n\n
 *   data: [DONE]\n\n
 *
 * Usage:
 *
 *   const { messages, sendMessage, isStreaming } = useStreamingChat({
 *     conversationId: 42,
 *     jwt,
 *   });
 */

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface UseStreamingChatOptions {
  conversationId: number | null;
  jwt: string | null;
  apiBase?: string;
  /** Called after each completed assistant message. */
  onMessageComplete?: (message: ChatMessage) => void;
}

export function useStreamingChat({
  conversationId,
  jwt,
  apiBase = "/api",
  onMessageComplete,
}: UseStreamingChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !jwt || isStreaming) return;

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Add user message optimistically
      const userMsg: ChatMessage = {
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setError(null);

      // Placeholder for the streaming assistant message
      const assistantPlaceholder: ChatMessage = {
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantPlaceholder]);

      try {
        const response = await fetch(`${apiBase}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ conversationId, content }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("ReadableStream not supported");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as { delta?: string };
              if (parsed.delta) {
                accumulated += parsed.delta;
                // Update the last message (assistant placeholder) in-place
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: accumulated,
                  };
                  return updated;
                });
              }
            } catch {
              // Ignore non-JSON SSE data
            }
          }
        }

        const finalMessage: ChatMessage = {
          role: "assistant",
          content: accumulated,
          createdAt: new Date().toISOString(),
        };
        onMessageComplete?.(finalMessage);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = (err as Error).message ?? "Unknown error";
        setError(msg);
        // Remove the empty assistant placeholder on error
        setMessages((prev) => prev.filter((m) => m.content !== ""));
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId, jwt, apiBase, isStreaming, onMessageComplete],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isStreaming, error, abort, clearMessages };
}
