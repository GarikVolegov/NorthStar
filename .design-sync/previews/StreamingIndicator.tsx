import { StreamingIndicator } from "@northstar/web";

export const Default = () => <StreamingIndicator isStreaming label="Sto elaborando la tua richiesta…" />;

export const ShortLabel = () => <StreamingIndicator isStreaming label="Generazione in corso" />;
