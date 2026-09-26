import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import juice from 'juice';

import { EMAIL_SUBJECTS, EMAIL_TEMPLATES, type EmailTemplate } from './email-templates';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export type TemplateData = Record<string, string | number | boolean>;

type Render = (data: object) => string;

/** Copied next to the compiled code by the Nest CLI (`assets` in nest-cli.json). */
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

/**
 * Renders a template to subject, inlined-CSS HTML and plain text (docs/03 §7.3).
 * Templates compile once at startup in strict mode, so a missing value fails
 * the send (and retries) instead of mailing a blank.
 */
@Injectable()
export class EmailRenderer {
  private readonly handlebars = Handlebars.create();
  private readonly layout: { html: Render; text: Render };
  private readonly templates: Map<EmailTemplate, { subject: Render; html: Render; text: Render }>;

  constructor() {
    this.layout = { html: this.load('layout.html.hbs'), text: this.load('layout.txt.hbs', true) };
    this.templates = new Map(
      EMAIL_TEMPLATES.map((template) => [
        template,
        {
          subject: this.compile(EMAIL_SUBJECTS[template], true),
          html: this.load(`${template}.html.hbs`),
          text: this.load(`${template}.txt.hbs`, true),
        },
      ]),
    );
  }

  render(template: EmailTemplate, data: TemplateData, footer: string): RenderedEmail {
    const compiled = this.templates.get(template);
    if (compiled === undefined) throw new Error(`Unknown email template ${template}`);
    const subject = compiled.subject(data);
    const html = this.layout.html({ subject, footer, body: compiled.html(data) });
    const text = this.layout.text({ footer, body: compiled.text(data) });
    return { subject, html: juice(html), text: tidyText(text) };
  }

  private load(file: string, plainText = false): Render {
    return this.compile(readFileSync(join(TEMPLATES_DIR, file), 'utf8'), plainText);
  }

  /** Plain text and subjects are not HTML: no entity escaping there. */
  private compile(source: string, plainText: boolean): Render {
    return this.handlebars.compile(source, { strict: true, noEscape: plainText });
  }
}

/** Collapses the blank lines conditional blocks leave behind. */
function tidyText(text: string): string {
  return `${text.replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
