import type { ToastTone } from './ToastView';

interface NotifyOptions {
  description?: string;
  /** Toasts that may fire twice (retries) pass an id so the second replaces the first. */
  id?: string;
}

let resolveReady: () => void = () => {};
const toasterReady = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

/** Called by <Toaster /> once mounted; toasts fired before that wait instead of getting lost. */
export function markToasterReady(): void {
  resolveReady();
}

async function show(tone: ToastTone, title: string, options: NotifyOptions = {}) {
  // Sonner and the toast view load on first use, keeping them out of the first page load.
  const [{ toast }, { ToastView }] = await Promise.all([
    import('sonner'),
    import('./ToastView'),
    toasterReady,
  ]);
  toast.custom(() => <ToastView tone={tone} title={title} description={options.description} />, {
    ...(options.id && { id: options.id }),
  });
}

/**
 * Transient confirmations only ("Link copied", "Trial cancelled"). Persistent information belongs
 * in a <Notice> (doc 07 §6).
 */
export const notify = Object.assign(
  (title: string, options?: NotifyOptions) => void show('neutral', title, options),
  {
    success: (title: string, options?: NotifyOptions) => void show('success', title, options),
    error: (title: string, options?: NotifyOptions) => void show('danger', title, options),
  },
);
