export function A2DashboardSkeleton() {
  return (
    <div className="dashboard-grid grid-cols-1">
      <div className="panel h-28 animate-pulse" />
      <div className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="panel h-28 animate-pulse" />
        ))}
      </div>
      <div className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <div className="panel h-[360px] animate-pulse xl:col-span-2" />
        <div className="panel h-[360px] animate-pulse" />
      </div>
      <div className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <div className="panel h-[280px] animate-pulse" />
        <div className="panel h-[280px] animate-pulse" />
      </div>
    </div>
  );
}
