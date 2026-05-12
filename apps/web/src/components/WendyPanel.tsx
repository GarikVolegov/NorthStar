import { useEffect, useRef } from 'react';
import { useWendy } from '../contexts/WendyProvider';
import { WendyChat } from './WendyChat';
import { WendyAvatar } from './wendy-avatar';

const QUICK_ACTIONS = [
  { label: 'Controlla il mio piano trading', icon: '📈' },
  { label: 'Analizza il mio mindset', icon: '🧠' },
  { label: 'Piano settimanale abitudini', icon: '🌱' },
  { label: 'Revisione carriera', icon: '💼' },
];

export function WendyPanel() {
  const { isOpen, isSpeaking, close } = useWendy();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
        onClick={close}
      />
      <div
        ref={panelRef}
        className={`fixed z-50 flex flex-col bg-white/95 dark:bg-gray-950/95 shadow-2xl transition-all duration-300
          md:right-4 md:top-4 md:bottom-4 md:w-[420px] md:max-w-[90vw] md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800
          inset-x-0 bottom-0 top-0 rounded-t-2xl md:rounded-t-2xl
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-4 py-3 shrink-0">
          <div className="relative">
            <WendyAvatar
              state={isSpeaking ? 'speaking' : 'curious'}
              phase={1}
              reduced={!isSpeaking}
              size={40}
            />
            {isSpeaking && (
              <span className="absolute -inset-0.5 rounded-full border border-violet-400/40 animate-ping" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Wendy</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isSpeaking ? 'Sta parlando...' : 'Online'}
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <WendyChat className="h-full border-0 rounded-none" />
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 overflow-x-auto px-4 py-2 border-t border-gray-200 dark:border-gray-800 shrink-0">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap transition-colors"
              onClick={() => {
                const chat = document.querySelector<HTMLTextAreaElement>('[data-wendy-input]');
                if (chat) {
                  chat.value = a.label;
                  chat.dispatchEvent(new Event('input', { bubbles: true }));
                  chat.focus();
                }
              }}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
