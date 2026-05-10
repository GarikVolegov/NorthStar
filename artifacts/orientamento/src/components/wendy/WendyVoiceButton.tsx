import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWendyVoice } from '../../hooks/useWendyVoice';

interface WendyVoiceButtonProps {
  onSend: (text: string) => void;
  lastAssistantMessage?: string;
  /** Chiamare speak() automaticamente sull'ultima risposta di Wendy */
  autoSpeak?: boolean;
}

const WendyVoiceButton = React.memo(function WendyVoiceButton({
  onSend,
  lastAssistantMessage,
  autoSpeak = false,
}: WendyVoiceButtonProps) {
  const { t } = useTranslation();

  const { startListening, stopAndSend, speak, cancelSpeech, listening, isSpeaking, transcript, isSupported } =
    useWendyVoice({ onSend });

  // Auto-speak quando arriva un nuovo messaggio da Wendy
  React.useEffect(() => {
    if (autoSpeak && lastAssistantMessage) {
      speak(lastAssistantMessage);
    }
  }, [lastAssistantMessage, autoSpeak, speak]);

  const handleMouseDown = useCallback(() => {
    startListening();
  }, [startListening]);

  const handleMouseUp = useCallback(() => {
    stopAndSend();
  }, [stopAndSend]);

  // Supporto touch per mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      startListening();
    },
    [startListening]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      stopAndSend();
    },
    [stopAndSend]
  );

  if (!isSupported) {
    return (
      <p className="wendy-voice-unsupported" data-testid="wendy-voice-unsupported">
        {t('wendy.notSupported')}
      </p>
    );
  }

  return (
    <div className="wendy-voice-container" data-testid="wendy-voice-container">
      {/* Avatar animato */}
      <div
        className={[
          'wendy-avatar',
          listening ? 'wendy-avatar--listening' : '',
          isSpeaking ? 'wendy-avatar--speaking' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid="wendy-avatar"
        aria-hidden="true"
      >
        <span className="wendy-avatar__icon">
          {listening ? '🎙️' : isSpeaking ? '💬' : '🤖'}
        </span>
      </div>

      {/* Stato corrente */}
      <p className="wendy-voice-status" data-testid="wendy-voice-status" aria-live="polite">
        {listening
          ? t('wendy.listening')
          : isSpeaking
          ? t('wendy.speaking')
          : t('wendy.idle')}
      </p>

      {/* Transcript live */}
      {transcript && (
        <p className="wendy-voice-transcript" data-testid="wendy-voice-transcript">
          {transcript}
        </p>
      )}

      {/* Pulsante principale */}
      <button
        className={[
          'wendy-voice-btn',
          listening ? 'wendy-voice-btn--active' : '',
          isSpeaking ? 'wendy-voice-btn--speaking' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid="wendy-voice-btn"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label={listening ? t('wendy.releaseToSend') : t('wendy.holdToSpeak')}
        type="button"
      >
        {listening ? t('wendy.releaseToSend') : t('wendy.holdToSpeak')}
      </button>

      {/* Stop speech button — visibile solo quando Wendy parla */}
      {isSpeaking && (
        <button
          className="wendy-voice-stop"
          data-testid="wendy-voice-stop"
          onClick={cancelSpeech}
          type="button"
          aria-label={t('wendy.stopSpeaking')}
        >
          {t('wendy.stopSpeaking')}
        </button>
      )}
    </div>
  );
});

export default WendyVoiceButton;
