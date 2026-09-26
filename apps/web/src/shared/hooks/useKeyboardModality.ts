import { useState } from 'react';

/**
 * Tracks whether the last interaction inside an element came from the keyboard. Keyboard-driven
 * changes never animate (doc 07 §7.4, motion row 4b), so components drop their transitions while
 * `data-keyboard` is set.
 */
export function useKeyboardModality() {
  const [keyboard, setKeyboard] = useState(false);
  return {
    'data-keyboard': keyboard || undefined,
    onKeyDown: () => {
      setKeyboard(true);
    },
    onPointerDown: () => {
      setKeyboard(false);
    },
  };
}
