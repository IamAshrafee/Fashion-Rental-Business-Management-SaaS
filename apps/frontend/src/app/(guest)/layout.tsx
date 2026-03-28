import { GuestHeader } from '@/components/guest/layout/guest-header';
import { GuestFooter } from '@/components/guest/layout/guest-footer';

/**
 * Guest storefront layout — wrappers for tenant-branded storefront pages.
 */
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fcfcfc]">
      <GuestHeader />
      <main className="flex-1">{children}</main>
      <GuestFooter />
    </div>
  );
}
