import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, Lock, MessageCircle, ChevronDown } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { decryptMessage, encryptMessage, fetchEncryptedKey, unwrapAesKey } from "@/hooks/useChatEncryption";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

interface FriendInfo {
  friendshipId: number;
  id: number;
  name: string;
}

interface ChatMessage {
  id: number;
  senderId: number;
  encryptedContent: string;
  iv: string;
  createdAt: string;
  readAt?: string | null;
  decrypted?: string;
}

interface ChatDrawerProps {
  friend: FriendInfo;
  userId: number;
  wssSend?: (data: Record<string, unknown>) => void;
  wssOn?: (eventType: string, handler: (payload: any) => void) => () => void;
  onClose: () => void;
}

export function ChatDrawer({ friend, userId, wssSend, wssOn, onClose }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [typing, setTyping] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Carica la chiave di conversazione
  useEffect(() => {
    let cancelled = false;
    async function loadKey() {
      try {
        const encryptedKey = await fetchEncryptedKey(friend.friendshipId);
        const key = await unwrapAesKey(encryptedKey, userId);
        if (!cancelled) setAesKey(key);
      } catch {
        // Nessuna chiave ancora — primo messaggio la genererà
      } finally {
        if (!cancelled) setKeyLoading(false);
      }
    }
    loadKey();
    return () => { cancelled = true; };
  }, [friend.friendshipId, userId]);

  // Carica storico messaggi
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${BASE}api/friends/messages/${friend.friendshipId}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } finally {
      setLoading(false);
    }
  }, [friend.friendshipId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // WebSocket: nuovi messaggi
  useEffect(() => {
    if (!wssOn) return;
    const unsub = wssOn("friend:message", (payload: any) => {
      if (payload.friendshipId !== friend.friendshipId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
    });
    return unsub;
  }, [friend.friendshipId, wssOn]);

  // WebSocket: read receipt
  useEffect(() => {
    if (!wssOn) return;
    const unsub = wssOn("friend:message:read", (payload: any) => {
      if (payload.friendshipId !== friend.friendshipId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId ? { ...m, readAt: payload.readAt } : m,
        ),
      );
    });
    return unsub;
  }, [friend.friendshipId, wssOn]);

  // WebSocket: typing indicator
  useEffect(() => {
    if (!wssOn) return;
    const unsub = wssOn("friend:typing", (payload: any) => {
      if (payload.friendshipId !== friend.friendshipId) return;
      setTyping(payload.userId);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(null), 3000);
    });
    return unsub;
  }, [friend.friendshipId, wssOn]);

  // Auto-scroll in basso
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Invia messaggio
  const handleSend = useCallback(async (text: string) => {
    setSending(true);
    try {
      // Se non abbiamo ancora una chiave AES, ne generiamo una e la scambiamo
      let key = aesKey;
      if (!key) {
        key = await ensureKeyExchange();
        setAesKey(key);
      }

      const { encryptedContent, iv } = await encryptMessage(key, text);
      await apiFetch(`${BASE}api/friends/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendshipId: friend.friendshipId,
          encryptedContent,
          iv,
        }),
      });
    } finally {
      setSending(false);
    }
  }, [aesKey, friend.friendshipId]);

  const ensureKeyExchange = useCallback(async (): Promise<CryptoKey> => {
    const { generateConversationKey, wrapAesKey, fetchPublicKey, exchangeKeys } = await import(
      "@/hooks/useChatEncryption"
    );
    const aesKeyB64 = await generateConversationKey();

    // Ottieni le chiavi pubbliche di entrambi gli utenti
    const receiverId = friend.id;
    const [myPubKeyRes, theirPubKey] = await Promise.all([
      apiFetch(`${BASE}api/friends/keys/${userId}`).then((r) => r.json()),
      fetchPublicKey(receiverId),
    ]);

    const keyForRequester = await wrapAesKey(aesKeyB64, myPubKeyRes.publicKey);
    const keyForReceiver = await wrapAesKey(aesKeyB64, theirPubKey);
    await exchangeKeys(friend.friendshipId, keyForRequester, keyForReceiver);

    // Ricarica la chiave decifrata
    const encryptedKey = await fetchEncryptedKey(friend.friendshipId);
    return unwrapAesKey(encryptedKey, userId);
  }, [friend.friendshipId, friend.id, userId]);

  // Typing indicator
  const handleTyping = useCallback(() => {
    wssSend?.({ type: "friend:typing", payload: { friendshipId: friend.friendshipId } });
  }, [wssSend, friend.friendshipId]);

  // Decripta i messaggi in arrivo
  const decryptedMessages = messages.map((m) => {
    if (m.decrypted !== undefined) return m;
    return { ...m, decrypted: "[messaggio crittografato]" };
  });

  // Decripta in background
  useEffect(() => {
    if (!aesKey || messages.length === 0) return;
    let cancelled = false;
    async function decryptAll() {
      for (const msg of messages) {
        if (msg.decrypted !== undefined) continue;
        if (!aesKey) continue;
        try {
          const plain = await decryptMessage(aesKey, msg.encryptedContent, msg.iv);
          if (!cancelled) {
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, decrypted: plain } : m)),
            );
          }
        } catch { }
      }
    }
    decryptAll();
    return () => { cancelled = true; };
  }, [aesKey, messages]);

  const isEncrypted = aesKey !== null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{friend.name}</p>
          {isEncrypted && (
            <p className="text-[11px] text-emerald-600 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Crittografato end-to-end
            </p>
          )}
        </div>
        {keyLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Messaggi */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : decryptedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nessun messaggio</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Inizia una conversazione con {friend.name}
            </p>
          </div>
        ) : (
          decryptedMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.decrypted ?? "[messaggio crittografato]"}
              isMine={msg.senderId === userId}
              timestamp={msg.createdAt}
              isRead={!!msg.readAt}
              isEncrypted={isEncrypted}
            />
          ))
        )}

        {typing !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic animate-pulse">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.1s]" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
            <span className="ml-1">{friend.name} sta scrivendo...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={sending || keyLoading}
        isEncrypted={isEncrypted}
      />
    </div>
  );
}
