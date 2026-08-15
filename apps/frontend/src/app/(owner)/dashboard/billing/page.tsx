import { redirect } from 'next/navigation';

/** Legacy route kept for bookmarks; subscription management has one canonical home. */
export default function BillingPage() {
  redirect('/dashboard/settings/subscription');
}
