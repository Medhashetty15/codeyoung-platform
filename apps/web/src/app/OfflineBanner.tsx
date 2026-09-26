import { useOnline } from '../shared/hooks/useOnline';
import { WifiSlashIcon } from '../shared/ui/icons';

/** Persistent while offline (doc 05 §12.5); submit buttons use useOnline to explain themselves. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="bg-caution-tint">
      <p className="mx-auto flex max-w-content items-center gap-2 px-4 py-2.5 text-small text-ink">
        <WifiSlashIcon aria-hidden size={16} className="shrink-0 text-caution" />
        You are offline. We will reconnect when your connection is back.
      </p>
    </div>
  );
}
