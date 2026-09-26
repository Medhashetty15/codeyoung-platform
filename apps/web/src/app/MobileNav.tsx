import { lazy, Suspense, useState } from 'react';

import { IconButton } from '../shared/ui/IconButton';
import { ListIcon } from '../shared/ui/icons';

const loadSheet = () => import('./MobileNavSheet');
const MobileNavSheet = lazy(() =>
  loadSheet().then((module) => ({ default: module.MobileNavSheet })),
);

/** Phones: a menu button opening a bottom sheet with the header's items (doc 05 §3). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <IconButton
        icon={ListIcon}
        label="Menu"
        // Start fetching the sheet as the finger lands so it is ready by the time the tap ends.
        onPointerDown={() => void loadSheet()}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      />
      {mounted && (
        <Suspense fallback={null}>
          <MobileNavSheet open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
