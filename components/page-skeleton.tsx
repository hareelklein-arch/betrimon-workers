export function PageSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="h-8 w-40 rounded-lg bg-[#e7efe8]" />
      <div className="h-4 w-64 rounded-lg bg-[#e7efe8]" />
      <div className="card h-28" />
      <div className="card h-28" />
      <div className="card h-28" />
    </div>
  );
}
