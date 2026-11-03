import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService, queryKeys } from '@/services';
import { useSessionStore } from '@/features/auth/session';

export const useDemoAccounts = () =>
  useQuery({ queryKey: queryKeys.users.demo, queryFn: () => authService.listDemoAccounts(), staleTime: 5 * 60_000 });

export const useCurrentUser = (userId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.users.detail(userId ?? ''),
    queryFn: () => authService.getUser(userId ?? ''),
    enabled: Boolean(userId),
  });

export function useSignInAs() {
  const signIn = useSessionStore((s) => s.signIn);
  return useMutation({
    mutationFn: (userId: string) => authService.signInAs(userId),
    onSuccess: (session) => signIn(session),
  });
}

export function useRequestOtp() {
  return useMutation({ mutationFn: (phone: string) => authService.requestOtp(phone) });
}

export function useVerifyOtp() {
  const signIn = useSessionStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => authService.verifyOtp(phone, code),
    onSuccess: (session) => signIn(session),
    meta: { silentError: true },
  });
}

/** Ends the session and drops cached data so the next user starts clean. */
export function useSignOut(redirectTo: string) {
  const client = useQueryClient();
  const signOut = useSessionStore((s) => s.signOut);
  const navigate = useNavigate();
  return () => {
    signOut();
    client.clear();
    navigate(redirectTo, { replace: true });
  };
}
