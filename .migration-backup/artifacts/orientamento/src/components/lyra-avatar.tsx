// Backward-compat shim: tutto il codice esistente che importa da lyra-avatar
// continua a funzionare senza modifiche. Il componente vero è wendy-avatar.tsx.
export { WendyAvatar as LyraAvatar, type AvatarState } from "./wendy-avatar";
