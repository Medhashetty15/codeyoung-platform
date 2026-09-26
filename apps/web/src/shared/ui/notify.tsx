import { toast } from 'sonner';

import { ToastView, type ToastTone } from './ToastView';

function show(tone: ToastTone, title: string, options?: { description?: string; id?: string }) {
  return toast.custom(
    () => <ToastView tone={tone} title={title} description={options?.description} />,
    {
      ...(options?.id && { id: options.id }),
    },
  );
}

/**
 * Transient confirmations only ("Link copied", "Trial cancelled"). Persistent information belongs
 * in a <Notice> (doc 07 §6). Pass an `id` for toasts that may fire twice so the second replaces the first.
 */
export const notify = Object.assign(
  (title: string, options?: { description?: string; id?: string }) =>
    show('neutral', title, options),
  {
    success: (title: string, options?: { description?: string; id?: string }) =>
      show('success', title, options),
    error: (title: string, options?: { description?: string; id?: string }) =>
      show('danger', title, options),
    dismiss: (id?: string) => toast.dismiss(id),
  },
);
