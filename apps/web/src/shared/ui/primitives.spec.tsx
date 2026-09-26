import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Accordion } from './Accordion';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Menu, MenuItem } from './Menu';
import { Tabs } from './Tabs';

function TabsHarness() {
  const [value, setValue] = useState<'create' | 'login'>('create');
  return (
    <Tabs
      label="Account"
      value={value}
      onValueChange={setValue}
      items={[
        { value: 'create', label: 'Create account', panel: <p>Create form</p> },
        { value: 'login', label: 'Log in', panel: <p>Login form</p> },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('exposes one tab per item and keeps the visual copy out of the accessibility tree', () => {
    render(<TabsHarness />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches panels with a click and with arrow keys', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    await user.click(screen.getByRole('tab', { name: 'Log in' }));
    expect(screen.getByText('Login form')).toBeVisible();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveFocus();
  });

  it('stops animating the indicator while the keyboard drives it (doc 07 §7.4)', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const list = screen.getByRole('tablist');
    await user.click(screen.getByRole('tab', { name: 'Log in' }));
    expect(list).not.toHaveAttribute('data-keyboard');
    await user.keyboard('{ArrowLeft}');
    expect(list).toHaveAttribute('data-keyboard');
  });
});

describe('Dialog', () => {
  it('renders title, sentence and actions, and closes on Escape', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        title="Cancel Leo's trial on Sat 24 Oct?"
        description="The time will be offered to another family."
        actions={
          <>
            <Button variant="secondary">Keep booking</Button>
            <Button variant="danger">Cancel trial</Button>
          </>
        }
      />,
    );
    const dialog = screen.getByRole('dialog', { name: "Cancel Leo's trial on Sat 24 Oct?" });
    expect(dialog).toHaveAccessibleDescription('The time will be offered to another family.');
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});

describe('Menu', () => {
  it('opens from its trigger and runs the chosen item', async () => {
    const onReschedule = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu trigger={<Button variant="secondary">More</Button>}>
        <MenuItem onClick={onReschedule}>Reschedule</MenuItem>
        <MenuItem tone="danger">Cancel</MenuItem>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reschedule' }));
    expect(onReschedule).toHaveBeenCalledOnce();
  });
});

describe('Accordion', () => {
  it('toggles an answer and reports the expanded state', async () => {
    const user = userEvent.setup();
    render(
      <Accordion
        items={[
          { id: 'free', question: 'Is it really free?', answer: 'Yes, the trial class is free.' },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Is it really free?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Yes, the trial class is free.')).toBeVisible();
  });
});
