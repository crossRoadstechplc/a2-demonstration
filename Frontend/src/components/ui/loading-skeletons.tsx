export function LoadingSkeletons() {
  return (
    <div className="dashboard-grid grid-cols-1 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="panel h-32 animate-pulse bg-gradient-to-r from-background-elevated via-background-muted to-background-elevated"
        />
      ))}
    </div>
  );
}
