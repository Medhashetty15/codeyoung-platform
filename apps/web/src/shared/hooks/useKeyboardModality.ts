import { useRef, useState } from 'react';

/**
 * Tracks whether the last interaction inside an element came from the keyboard. Keyboard-driven
 * changes never animate (doc 07 §7.4, motion row 4b). Inputs are recorded in the capture phase so
 * `viaKeyboard()` is already correct inside a primitive's own change handler.
 */
export function useKeyboardModality() {
  const keyboardRef = useRef(false);
  const [keyboard, setKeyboard] = useState(false);
  const record = (value: boolean) => {
    keyboardRef.current = value;
    setKeyboard(value);
  };
  return {
    props: {
      'data-keyboard': keyboard || undefined,
      onKeyDownCapture: () => {
        record(true);
      },
      onPointerDownCapture: () => {
        record(false);
      },
    },
    viaKeyboard: () => keyboardRef.current,
  };
}
