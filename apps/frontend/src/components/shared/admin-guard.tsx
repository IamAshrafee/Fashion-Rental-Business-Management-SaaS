'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { LoadingSpinner } from './loading-spinner';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.role !== 'saas_admin') {
        router.push('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <LoadingSpinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  // Double check condition to avoid flash of content
  if (!isAuthenticated || user?.role !== 'saas_admin') {
    return null;
  }

  return <>{children}</>;
}
