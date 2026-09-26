import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field, Input, NativeSelect } from './Field';

describe('Field', () => {
  it('labels the control and describes it with helper text', () => {
    render(
      <Field label="Email" description="We send the class link here.">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We send the class link here.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and adds the error to its description', () => {
    render(
      <Field
        label="Email"
        description="We send the class link here."
        error="Enter an email address."
      >
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'We send the class link here. Enter an email address.',
    );
  });

  it('wires native selects the same way', () => {
    render(
      <Field label="Age" error="Choose an age.">
        <NativeSelect defaultValue="">
          <option value="" disabled>
            Choose
          </option>
          <option value="9">9</option>
        </NativeSelect>
      </Field>,
    );
    expect(screen.getByLabelText('Age')).toHaveAccessibleDescription('Choose an age.');
  });

  it('marks optional fields in the label', () => {
    render(
      <Field label="Phone" optional>
        <Input type="tel" />
      </Field>,
    );
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
  });
});
