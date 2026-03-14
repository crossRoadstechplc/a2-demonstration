export function DriverDashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="panel h-24 animate-pulse" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel h-24 animate-pulse" />
        ))}
      </div>
      <div className="panel h-52 animate-pulse" />
      <div className="panel h-56 animate-pulse" />
      <div className="panel h-64 animate-pulse" />
    </div>
  );
}
