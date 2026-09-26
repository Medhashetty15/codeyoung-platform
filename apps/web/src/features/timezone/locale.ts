/** The device locale decides 12 or 24 hour clocks and date order (doc 05 §11). */
export function deviceLocale(): string {
  const [first] = navigator.languages;
  return first ?? navigator.language;
}
