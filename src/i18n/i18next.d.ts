// Type-safe translation keys: English files are the source of truth; Tamil files must have the same keys.
import 'i18next';
import type admin from './locales/en/admin.json';
import type auth from './locales/en/auth.json';
import type common from './locales/en/common.json';
import type desk from './locales/en/desk.json';
import type doctor from './locales/en/doctor.json';
import type kiosk from './locales/en/kiosk.json';
import type patient from './locales/en/patient.json';
import type triage from './locales/en/triage.json';
import type validation from './locales/en/validation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    returnNull: false;
    resources: {
      common: typeof common;
      validation: typeof validation;
      auth: typeof auth;
      patient: typeof patient;
      triage: typeof triage;
      kiosk: typeof kiosk;
      desk: typeof desk;
      doctor: typeof doctor;
      admin: typeof admin;
    };
  }
}
