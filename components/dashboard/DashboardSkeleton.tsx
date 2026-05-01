// Skeleton editorial mientras carga el dashboard. Sustituye al spinner
// genérico con bloques que evocan la estructura final (hero + KPIs + grid).

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy aria-live="polite">
      {/* Page nav */}
      <div className="flex gap-2">
        <div className="vizme-skeleton h-8 w-32" />
        <div className="vizme-skeleton h-8 w-24" />
        <div className="vizme-skeleton h-8 w-28" />
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="vizme-skeleton h-3 w-40" />
        <div className="vizme-skeleton h-12 w-3/5" />
        <div className="vizme-skeleton h-4 w-1/2" />
      </div>

      {/* Hero (kpi gigante + 3 cards) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="vizme-skeleton h-56 lg:col-span-4" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="vizme-skeleton h-32" />
        ))}
      </div>

      {/* Chart grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="vizme-skeleton h-72" />
        <div className="vizme-skeleton h-72" />
      </div>

      {/* Insights placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="vizme-skeleton h-28" />
        <div className="vizme-skeleton h-28" />
      </div>
    </div>
  );
}
