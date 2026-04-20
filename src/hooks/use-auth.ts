'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { Role } from '@/lib/types';

export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<{ role: Role }>('/api/auth/me', fetcher);
  return {
    role: data?.role ?? null,
    isLoading,
    isError: !!error,
    refresh: mutate,
    logout: async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      await mutate(undefined, { revalidate: false });
      window.location.href = '/login';
    }
  };
}
