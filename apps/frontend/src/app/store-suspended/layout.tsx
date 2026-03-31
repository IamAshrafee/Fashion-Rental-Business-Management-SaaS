import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Store Suspended — ClosetRent',
  description: 'Your store has been suspended. Contact support for assistance.',
};

/**
 * Store-suspended layout — minimal centered layout (no sidebar, no top bar).
 * Lives outside (owner) so OwnerGuard doesn't interfere.
 */
export default function StoreSuspendedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      {children}
    </div>
  );
}
