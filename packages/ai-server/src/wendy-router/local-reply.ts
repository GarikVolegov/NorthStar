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

function normalizeLocalMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[?!.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GREETING_MESSAGES = new Set([
  "ciao",
  "hey",
  "hei",
  "ehi",
  "salve",
  "buongiorno",
  "buonasera",
]);

const WELLBEING_MESSAGES = new Set([
  "come stai",
  "come va",
  "come stai oggi",
  "tutto bene",
  "stai bene",
  "come ti senti",
  "hru",
]);

const THANKS_MESSAGES = new Set([
  "grazie",
  "grazie mille",
  "ti ringrazio",
  "perfetto grazie",
  "ok grazie",
]);

const ACK_MESSAGES = new Set([
  "ok",
  "okay",
  "va bene",
  "perfetto",
  "chiaro",
  "capito",
  "bene",
]);

const IDENTITY_MESSAGES = new Set([
  "chi sei",
  "cosa sai fare",
  "che cosa sai fare",
  "come funziona wendy",
  "presentati",
  "aiutami a capire cosa puoi fare",
]);

const LOCAL_REPLIES: Record<LocalWendyReplyKind, string> = {
  greeting: "Ciao. Ci sono. Dimmi pure cosa vuoi capire o sistemare in NorthStar.",
  wellbeing: "Ci sono. Meglio quando posso aiutarti a sciogliere un nodo concreto. Dimmi pure cosa vuoi sistemare.",
  thanks: "Figurati. Quando vuoi, riprendiamo da qui.",
  ack: "Va bene. Resto qui se vuoi continuare.",
  identity: "Sono Wendy, l'assistente operativo di NorthStar. Posso aiutarti a cercare contenuti nell'app, capire settori e ruoli, oppure portarti alla pagina giusta e preparare bozze prima di salvarle.",
};

export function getLocalWendyReply(message: string): LocalWendyReply | null {
  const normalized = normalizeLocalMessage(message);

  if (GREETING_MESSAGES.has(normalized)) return { kind: "greeting", text: LOCAL_REPLIES.greeting };
  if (WELLBEING_MESSAGES.has(normalized)) return { kind: "wellbeing", text: LOCAL_REPLIES.wellbeing };
  if (THANKS_MESSAGES.has(normalized)) return { kind: "thanks", text: LOCAL_REPLIES.thanks };
  if (ACK_MESSAGES.has(normalized)) return { kind: "ack", text: LOCAL_REPLIES.ack };
  if (IDENTITY_MESSAGES.has(normalized)) return { kind: "identity", text: LOCAL_REPLIES.identity };

  return null;
}

export function isLocalWendyReplyMessage(message: string): boolean {
  return getLocalWendyReply(message) !== null;
}
