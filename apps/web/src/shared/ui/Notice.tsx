import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

import { InfoIcon, WarningCircleIcon, WarningIcon, type Icon } from './icons';

type NoticeTone = 'neutral' | 'caution' | 'danger';

const noticeVariants = cva('flex gap-3 rounded-surface px-4 py-3.5 text-small', {
  variants: {
    tone: {
      neutral: 'bg-sunken text-ink',
      caution: 'bg-caution-tint text-ink',
      danger: 'bg-danger-tint text-ink',
    },
  },
});

const toneIcon: Record<NoticeTone, { icon: Icon; className: string }> = {
  neutral: { icon: InfoIcon, className: 'text-ink-muted' },
  caution: { icon: WarningIcon, className: 'text-caution' },
  danger: { icon: WarningCircleIcon, className: 'text-danger' },
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
  /** One follow-up action (a button or link), placed under the sentence. */
  action?: ReactNode;
  /** `status` for async results that should be announced politely; `alert` for blocking errors. */
  role?: 'status' | 'alert';
  className?: string;
}

/** Inline banner for persistent information (doc 07 §6). Never use a toast for this. */
export function Notice({
  tone = 'neutral',
  title,
  children,
  action,
  role,
  className,
}: NoticeProps) {
  const { icon: ToneIcon, className: iconClassName } = toneIcon[tone];
  return (
    <div role={role} className={cn(noticeVariants({ tone }), className)}>
      <ToneIcon aria-hidden size={20} className={cn('shrink-0', iconClassName)} />
      <div className="flex min-w-0 flex-col gap-1">
        {Boolean(title) && <p className="font-semibold">{title}</p>}
        <div className="text-pretty">{children}</div>
        {Boolean(action) && <div className="mt-1.5 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
