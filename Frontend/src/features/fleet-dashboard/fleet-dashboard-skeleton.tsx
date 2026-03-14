export function FleetDashboardSkeleton() {
  return (
    <div className="dashboard-grid grid-cols-1">
      <div className="panel h-24 animate-pulse" />
      <div className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="panel h-24 animate-pulse" />
        ))}
      </div>
      <div className="panel h-[420px] animate-pulse" />
      <div className="dashboard-grid grid-cols-1 xl:grid-cols-2">
        <div className="panel h-[300px] animate-pulse" />
        <div className="panel h-[300px] animate-pulse" />
      </div>
    </div>
  );
}
