// Signed-in session: kept in memory and in sessionStorage (per tab), so each tab can act as a different role.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Role, Session } from '@/types';

interface SessionState {
  session: Session | null;
  signIn: (session: Session) => void;
  update: (patch: Partial<Session>) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      signIn: (session) => set({ session }),
      update: (patch) => set((s) => (s.session ? { session: { ...s.session, ...patch } } : s)),
      signOut: () => set({ session: null }),
    }),
    { name: 'mediflow.session', storage: createJSONStorage(() => sessionStorage) },
  ),
);

export const useSession = () => useSessionStore((s) => s.session);

/** Home route for each role. */
export const HOME_BY_ROLE: Record<Role, string> = {
  patient: '/app',
  desk: '/desk',
  doctor: '/doctor',
  admin: '/admin',
};
