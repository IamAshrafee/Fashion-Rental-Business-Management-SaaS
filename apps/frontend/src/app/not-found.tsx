import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center p-4">
      <div className="rounded-full bg-muted p-6 mb-6">
        <span className="font-display text-4xl font-bold tracking-tighter text-muted-foreground">
          404
        </span>
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Page Not Found</h1>
      <p className="mb-8 text-muted-foreground max-w-sm">
        The page you are looking for doesn&apos;t exist, has been moved, or you don&apos;t have permission to access it.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
