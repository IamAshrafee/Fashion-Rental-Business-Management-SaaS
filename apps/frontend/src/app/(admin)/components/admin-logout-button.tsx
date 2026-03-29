'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

export function AdminLogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      onClick={() => logout()}
      className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-900 transition-colors"
    >
      <LogOut className="mr-3 h-4 w-4" />
      Sign out
    </button>
  );
}
