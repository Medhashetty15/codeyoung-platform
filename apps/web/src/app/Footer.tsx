import { Link } from 'react-router';

import { config } from '../shared/config';
import { textLinkClassName } from '../shared/ui/text-link';
import { ThemeSwitch } from '../shared/ui/ThemeSwitch';

export function Footer() {
  return (
    <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 text-small text-ink-muted">
          <p>
            Questions? Write to{' '}
            <a href={`mailto:${config.supportEmail}`} className={textLinkClassName}>
              {config.supportEmail}
            </a>
          </p>
          <p className="flex gap-4">
            <Link to="/privacy" className={textLinkClassName}>
              How we handle your data
            </Link>
            <Link to="/terms" className={textLinkClassName}>
              Trial class terms
            </Link>
          </p>
        </div>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
