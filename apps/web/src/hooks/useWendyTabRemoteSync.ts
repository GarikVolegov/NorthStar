import { useCallback, useRef } from 'react';

import { type WendyTabEvent, useWendyTabSync } from './useWendyTabSync';

interface UseWendyTabRemoteSyncOptions {
  onRemoteStop: () => void;
  onRemoteClear: () => void;
}

export function useWendyTabRemoteSync({
  onRemoteStop,
  onRemoteClear,
}: UseWendyTabRemoteSyncOptions): {
  broadcastUnlessRemote: (event: Omit<WendyTabEvent, 'ts'>) => void;
} {
  const applyingRemoteEventRef = useRef(false);
  const { broadcast } = useWendyTabSync({
    onRemoteEvent: (event) => {
      applyingRemoteEventRef.current = true;
      try {
        if (event.kind === 'stop') onRemoteStop();
        if (event.kind === 'cleared') onRemoteClear();
      } finally {
        window.setTimeout(() => {
          applyingRemoteEventRef.current = false;
        }, 0);
      }
    },
  });

  const broadcastUnlessRemote = useCallback(
    (event: Omit<WendyTabEvent, 'ts'>) => {
      if (!applyingRemoteEventRef.current) broadcast(event);
    },
    [broadcast],
  );

  return { broadcastUnlessRemote };
}
