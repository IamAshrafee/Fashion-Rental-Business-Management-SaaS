export default function Home(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-5xl font-bold font-display text-gray-900 mb-4">
          ClosetRent
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Fashion Rental Business Management SaaS
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-800 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          System Online — Scaffolding Complete
        </div>
      </div>
    </main>
  );
}
