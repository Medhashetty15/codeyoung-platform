import { createContext, use, type ChangeEvent } from 'react';

export interface ChoiceContextValue {
  name: string;
  value: string | null;
  onChange: (value: string) => void;
}

export const ChoiceContext = createContext<ChoiceContextValue | null>(null);

/**
 * Props for the visually hidden native input inside a choice chip. `sr-only` positions it
 * absolutely, so the chip's label must be `relative`: otherwise the input escapes a scrolling
 * parent (the date strip) and widens the page.
 */
export function useChoice(value: string, disabled = false) {
  const group = use(ChoiceContext);
  if (!group) throw new Error('useChoice needs <ChoiceGroup>');
  return {
    type: 'radio' as const,
    name: group.name,
    value,
    checked: group.value === value,
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) group.onChange(value);
    },
    className: 'sr-only',
  };
}

/** Focus ring on the visible chip while its hidden input has keyboard focus. */
export const choiceFocusClassName =
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
