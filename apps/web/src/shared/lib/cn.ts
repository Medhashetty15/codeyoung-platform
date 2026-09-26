import { clsx, type ClassValue } from 'clsx';

/**
 * Joins class names. There is no conflict resolution (tailwind-merge was dropped for bundle size),
 * so components never let a caller override a utility they already set: variants go through props
 * (cva), and `className` only adds layout such as margins or width.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
