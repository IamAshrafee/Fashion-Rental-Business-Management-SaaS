import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
};

/**
 * Auth layout — minimal centered layout for login/register pages.
 * No sidebar, no navigation — just the auth card.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          ClosetRent
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fashion Rental Business Management
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
