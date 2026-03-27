import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClosetRent — Fashion Rental Business Management',
  description:
    'Manage your fashion rental business with ease. Product catalogs, booking management, customer tracking, and more.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
