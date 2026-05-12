import { useWendy } from '../contexts/WendyProvider';
import { WendyAvatar } from './wendy-avatar';

export function WendyFloatingButton() {
  const { isOpen, isSpeaking, toggle } = useWendy();

  if (isOpen) return null;

  return (
    <button
      onClick={toggle}
      data-testid="wendy-fab"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95"
      aria-label="Apri Wendy"
      style={{ width: 64, height: 64 }}
    >
      <div className="relative">
        <WendyAvatar
          state={isSpeaking ? 'speaking' : 'curious'}
          phase={1}
          reduced={!isSpeaking}
          size={64}
        />
        {isSpeaking && (
          <span className="absolute -inset-1 rounded-full border-2 border-violet-400/50 animate-ping" />
        )}
      </div>
    </button>
  );
}
