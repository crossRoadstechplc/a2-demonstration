export function EeuDashboardSkeleton() {
  return (
    <div className="dashboard-grid grid-cols-1">
      <div className="panel h-24 animate-pulse" />
      <div className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="panel h-24 animate-pulse" />
        ))}
      </div>
      <div className="dashboard-grid grid-cols-1 xl:grid-cols-[280px_1fr_320px]">
        <div className="panel h-[680px] animate-pulse" />
        <div className="panel h-[680px] animate-pulse" />
        <div className="panel h-[680px] animate-pulse" />
      </div>
    </div>
  );
}
