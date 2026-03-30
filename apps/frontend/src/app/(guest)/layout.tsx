import { GuestHeader } from '@/components/guest/layout/guest-header';
import { GuestFooter } from '@/components/guest/layout/guest-footer';
import { WhatsAppFloatingButton } from '@/components/guest/layout/whatsapp-button';

/**
 * Guest storefront layout — wrappers for tenant-branded storefront pages.
 */
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fcfcfc]" style={{ colorScheme: 'light' }} data-theme="light">
      <GuestHeader />
      <main className="flex-1">{children}</main>
      <GuestFooter />
      <WhatsAppFloatingButton />
    </div>
  );
}
