import {
  estimateTokens,
  getLlmUnavailableReply,
} from "@workspace/ai-server";
import type { WendyIntent } from "@workspace/ai-server";
import type { Logger } from "pino";

type SendFn = (data: object) => void;
type SendDoneFn = (extra?: Record<string, unknown>) => void;

/**
 * Gestisce i soli casi terminali NON-LLM prima della pipeline di ragionamento.
 *
 * Per design Wendy non emette risposte prescritte: saluti, identità, quick
 * action e qualsiasi domanda passano dall'LLM (fast/full path) che ragiona sui
 * dati reali dell'app e sui tool. L'unico caso gestito qui è l'assenza totale di
 * un provider LLM configurato, dove restituiamo un avviso operativo onesto
 * invece di un errore grezzo. In tutti gli altri casi ritorna null e il flusso
 * prosegue verso la pipeline LLM.
 */
export async function handleWendyLocalQuickAction(input: {
  effectiveMessage: string;
  endStream: () => void;
  intent: WendyIntent;
  llmConfigured: boolean;
  locale: string;
  logger: Logger;
  message: string;
  requestId: string;
  send: SendFn;
  sendDoneOnce: SendDoneFn;
  startedAt: number;
  userId: number;
}) {
  const {
    endStream,
    intent,
    llmConfigured,
    locale,
    logger,
    message,
    requestId,
    send,
    sendDoneOnce,
    startedAt,
    userId,
  } = input;

  const finish = (text: string, extra: Record<string, unknown>) => {
    const outputTokens = estimateTokens(text);
    const ttftMs = Date.now() - startedAt;
    send({ type: "token", value: text });
    sendDoneOnce(extra);
    endStream();
    return { assistantResponseForMemory: text, outputTokens, ttftMs };
  };

  if (!llmConfigured) {
    const msg = getLlmUnavailableReply(locale);
    logger.warn(
      { userId, requestId },
      "[ai/wendy] no LLM provider configured - returning graceful notice",
    );
    return finish(msg, {
      intent,
      answerMode: "unconfigured",
      usage: {
        model: "unconfigured",
        inputTokens: estimateTokens(message),
        outputTokens: estimateTokens(msg),
      },
    });
  }

  return null;
}
