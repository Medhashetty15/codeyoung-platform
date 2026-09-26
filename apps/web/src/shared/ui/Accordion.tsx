import { useId, useState, type ReactNode } from 'react';

import { MinusIcon, PlusIcon } from './icons';

export interface AccordionItem {
  id: string;
  question: string;
  answer: ReactNode;
}

function Item({ item }: { item: AccordionItem }) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const triggerId = `${baseId}-trigger`;
  return (
    <div className="border-b border-line">
      <h3 className="m-0">
        <button
          type="button"
          id={triggerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="flex w-full items-center justify-between gap-6 py-5 text-left text-h3 text-ink"
        >
          {item.question}
          {open ? (
            <MinusIcon aria-hidden size={20} className="shrink-0 text-ink-muted" />
          ) : (
            <PlusIcon aria-hidden size={20} className="shrink-0 text-ink-muted" />
          )}
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="max-w-prose pb-5 text-body text-ink-muted"
      >
        {item.answer}
      </div>
    </div>
  );
}

/**
 * FAQ list: no boxes, hairline under each item, plus/minus icon. Opens instantly (doc 07 §7.4).
 * The WAI disclosure pattern on plain elements, so the landing page carries no primitives library.
 */
export function Accordion({ items }: { items: AccordionItem[] }) {
  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </div>
  );
}
