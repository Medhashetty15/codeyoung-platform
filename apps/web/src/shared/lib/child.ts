/** A child as typed into a form: the age stays a string until it is chosen. */
export interface ChildDraft {
  firstName: string;
  age: string;
}

export type ChildErrors = { firstName?: string | undefined; age?: string | undefined };

/** Ages a trial is for (contract StudentAgeSchema: 4 to 18). */
export const CHILD_AGES = Array.from({ length: 15 }, (_, index) => String(index + 4));

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u;

/** Client check before sending a child's name and age (same rules as FirstNameSchema). */
export function validateChild(child: ChildDraft): ChildErrors {
  const errors: ChildErrors = {};
  const name = child.firstName.trim();
  if (!name) errors.firstName = "Enter your child's first name.";
  else if (name.length > 50) errors.firstName = 'Use at most 50 characters.';
  else if (!NAME_PATTERN.test(name))
    errors.firstName = 'Use letters only, as on a school register.';
  if (!child.age) errors.age = 'Choose an age.';
  return errors;
}
