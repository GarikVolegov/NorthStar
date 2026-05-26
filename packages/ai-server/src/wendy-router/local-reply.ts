export type LocalWendyReplyKind =
  | "greeting"
  | "wellbeing"
  | "thanks"
  | "ack"
  | "identity";

export interface LocalWendyReply {
  kind: LocalWendyReplyKind;
  text: string;
}

export function getLocalWendyReply(message: string): LocalWendyReply | null {
  void message;
  return null;
}

export function getLocalWendyFallbackReply(message: string): LocalWendyReply | null {
  void message;
  return null;
}

export function isLocalWendyReplyMessage(message: string): boolean {
  void message;
  return false;
}
