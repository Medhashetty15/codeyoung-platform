import type { ReactNode } from 'react';

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h2 text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-body text-ink-muted">{children}</div>
    </section>
  );
}
