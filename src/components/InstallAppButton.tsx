import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallAppButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { pushToast } = usePlatform();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
      return;
    }
    pushToast(
      'Install Mercer & Sterling',
      'iPhone: Share → Add to Home Screen. Android/Chrome: Menu → Install app.',
      'info'
    );
  };

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      className={
        compact
          ? 'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-950 cursor-pointer'
          : 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 cursor-pointer'
      }
    >
      <Download className="w-4 h-4 shrink-0" />
      <span>{compact ? 'Install app' : 'Install on device'}</span>
    </button>
  );
};
