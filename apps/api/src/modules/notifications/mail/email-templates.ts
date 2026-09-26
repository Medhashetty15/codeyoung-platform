/** Every email the worker sends (docs/03 §7.3); subjects are Handlebars like the bodies. */
export const EMAIL_SUBJECTS = {
  'booking-confirmed-parent': "Booked: {{childFirstName}}'s trial class on {{shortDate}}",
  'booking-confirmed-mentor': 'New trial class with {{childFirstName}} on {{shortDate}}',
  'booking-cancelled-parent': "Cancelled: {{childFirstName}}'s trial class on {{shortDate}}",
  'booking-cancelled-mentor': 'Cancelled: trial class with {{childFirstName}} on {{shortDate}}',
  'booking-rescheduled-parent': "New time for {{childFirstName}}'s trial class: {{shortDate}}",
  'booking-moved-away-mentor':
    'Off your schedule: trial class with {{childFirstName}} on {{shortDate}}',
  'booking-reassigned-parent': "New mentor for {{childFirstName}}'s trial class on {{shortDate}}",
  'booking-reminder-parent':
    "Reminder: {{childFirstName}}'s trial class is {{relativeDay}} at {{startTime}}",
  'booking-reminder-mentor':
    'Reminder: trial class with {{childFirstName}} {{relativeDay}} at {{startTime}}',
  'password-reset': 'Reset your Codeyoung password',
  'password-changed': 'Your Codeyoung password was {{#if wasReset}}reset{{else}}changed{{/if}}',
} as const;

export type EmailTemplate = keyof typeof EMAIL_SUBJECTS;

export const EMAIL_TEMPLATES = Object.keys(EMAIL_SUBJECTS) as EmailTemplate[];
