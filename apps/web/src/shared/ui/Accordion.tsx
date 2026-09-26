import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import type { ReactNode } from 'react';

import { MinusIcon, PlusIcon } from './icons';

export interface AccordionItem {
  id: string;
  question: string;
  answer: ReactNode;
}

/** FAQ list: no boxes, hairline under each item, plus/minus icon. Opens instantly (doc 07 §7.4). */
export function Accordion({ items }: { items: AccordionItem[] }) {
  return (
    <BaseAccordion.Root multiple className="border-t border-line">
      {items.map((item) => (
        <BaseAccordion.Item key={item.id} value={item.id} className="border-b border-line">
          <BaseAccordion.Header className="m-0">
            <BaseAccordion.Trigger className="group flex w-full items-center justify-between gap-6 py-5 text-left text-h3 text-ink">
              {item.question}
              <PlusIcon
                aria-hidden
                size={20}
                className="shrink-0 text-ink-muted group-data-panel-open:hidden"
              />
              <MinusIcon
                aria-hidden
                size={20}
                className="hidden shrink-0 text-ink-muted group-data-panel-open:block"
              />
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          <BaseAccordion.Panel className="max-w-prose pb-5 text-body text-ink-muted">
            {item.answer}
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
}
