'use client';

import { useTenant } from '@/hooks/use-tenant';
import { MessageCircle } from 'lucide-react';

export function WhatsAppFloatingButton() {
  const { tenant } = useTenant();

  if (!tenant?.whatsapp) {
    return null;
  }

  return (
    <a
      href={`https://wa.me/${tenant.whatsapp.replace(/[^0-9]/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
