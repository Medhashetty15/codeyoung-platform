import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Book a free trial</Button>);
    expect(screen.getByRole('button', { name: 'Book a free trial' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('keeps its label while pending and ignores presses', async () => {
    const onClick = vi.fn();
    render(
      <Button pending onClick={onClick}>
        Confirm trial
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Confirm trial' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays focusable while pending so focus is not lost mid-submit', () => {
    render(<Button pending>Confirm trial</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });

  it('forwards the caller ref', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Log in</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
