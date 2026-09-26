import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'pressable relative inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-ink-faint',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
        secondary:
          'border border-line-control bg-surface text-ink hover:bg-sunken active:bg-sunken',
        ghost: 'text-ink hover:bg-sunken active:bg-sunken',
        danger: 'bg-danger text-on-danger hover:brightness-95 active:brightness-90',
      },
      size: {
        default: 'h-11 px-5 text-body',
        /** Desktop-only density (36px); never on touch layouts. */
        compact: 'h-9 px-3.5 text-small',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);
