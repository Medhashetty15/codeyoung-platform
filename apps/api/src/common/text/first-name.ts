/** "Priya Raghavan" -> "Priya": how emails and pages address people. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
