// UI preferences saved on this device: theme, patient-app language, travel time and notification choices.
// Staff apps (front desk, doctor, admin) are English only, so they have no language preference.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Lang, NotificationPrefs } from '@/types';

export type ThemePref = 'system' | 'light' | 'dark';

interface PrefsState {
  theme: ThemePref;
  /** Patient app language; null until chosen on first launch. */
  patientLang: Lang | null;
  /** Minutes from home to the hospital; null uses the hospital default. */
  travelMins: number | null;
  notifications: NotificationPrefs;
  setTheme: (theme: ThemePref) => void;
  setPatientLang: (lang: Lang) => void;
  setTravelMins: (mins: number | null) => void;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      patientLang: null,
      travelMins: null,
      notifications: { bookingUpdates: true, queueAlerts: true, reminders: true, sms: true, whatsapp: true },
      setTheme: (theme) => set({ theme }),
      setPatientLang: (patientLang) => set({ patientLang }),
      setTravelMins: (travelMins) => set({ travelMins }),
      setNotifications: (prefs) => set((s) => ({ notifications: { ...s.notifications, ...prefs } })),
    }),
    { name: 'mediflow.prefs', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
