import { CheckCircleIcon, InfoIcon, WarningCircleIcon, type Icon } from './icons';

export type ToastTone = 'neutral' | 'success' | 'danger';

const toneIcon: Record<ToastTone, { icon: Icon; className: string }> = {
  neutral: { icon: InfoIcon, className: 'text-ink-muted' },
  success: { icon: CheckCircleIcon, className: 'text-accent' },
  danger: { icon: WarningCircleIcon, className: 'text-danger' },
};

export function ToastView({
  tone,
  title,
  description,
}: {
  tone: ToastTone;
  title: string;
  description?: string | undefined;
}) {
  const { icon: ToneIcon, className } = toneIcon[tone];
  return (
    <div className="flex w-full items-start gap-3 rounded-surface bg-surface px-4 py-3.5 text-small text-ink shadow-float ring-1 ring-line sm:w-[356px]">
      <ToneIcon aria-hidden size={20} className={`shrink-0 ${className}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium">{title}</p>
        {description && <p className="text-ink-muted">{description}</p>}
      </div>
    </div>
  );
}
