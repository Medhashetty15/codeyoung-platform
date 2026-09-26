import { WarningCircleIcon } from './icons';

export interface SummaryError {
  name: string;
  label: string;
  message: string;
}

/**
 * After a failed submit with several problems, lists them with a way to jump to each field
 * (doc 05 §12.3). A single problem needs no summary: focus already lands on that field.
 */
export function FormErrorSummary({
  errors,
  onSelect,
}: {
  errors: SummaryError[];
  onSelect: (name: string) => void;
}) {
  if (errors.length < 2) return null;
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-surface bg-danger-tint px-4 py-3.5 text-small text-ink"
    >
      <WarningCircleIcon aria-hidden size={20} className="shrink-0 text-danger" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Check {errors.length} fields before continuing</p>
        <ul className="flex flex-col gap-0.5">
          {errors.map((error) => (
            <li key={error.name}>
              <button
                type="button"
                onClick={() => {
                  onSelect(error.name);
                }}
                className="text-left underline decoration-1 underline-offset-[3px] hover:decoration-2"
              >
                {error.label}: {error.message}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
