import { lazy, Suspense, useState } from 'react';

import { IconButton } from '../shared/ui/IconButton';
import { ListIcon } from '../shared/ui/icons';

import { loadMobileNavSheet } from './prefetch';

const MobileNavSheet = lazy(() =>
  loadMobileNavSheet().then((module) => ({ default: module.MobileNavSheet })),
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
        // Usually prefetched at idle already; hover, focus and touch start cover a fast first tap.
        onPointerEnter={() => void loadMobileNavSheet()}
        onFocus={() => void loadMobileNavSheet()}
        onPointerDown={() => void loadMobileNavSheet()}
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
