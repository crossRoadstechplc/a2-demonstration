export function FreightDashboardSkeleton() {
  return (
    <div className="dashboard-grid grid-cols-1">
      <div className="panel h-24 animate-pulse" />
      <div className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel h-24 animate-pulse" />
        ))}
      </div>
      <div className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <div className="panel h-[560px] animate-pulse xl:col-span-2" />
        <div className="panel h-[560px] animate-pulse" />
      </div>
      <div className="panel h-[320px] animate-pulse" />
    </div>
  );
}
