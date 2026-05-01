// Selector global del período temporal del dashboard.
// Cambia el período → los widgets reciben otro slice de metric_calculations.

import type { MetricCalculationPeriod } from '../../lib/v5types';
import { formatPeriodLabel } from './format';

const PERIODS: MetricCalculationPeriod[] = [
  'last_week',
  'last_month',
  'last_quarter',
  'last_year',
  'all_time',
];

export default function PeriodPicker({
  value,
  onChange,
}: {
  value: MetricCalculationPeriod;
  onChange: (p: MetricCalculationPeriod) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-vizme-navy/10 bg-white/70 p-1 backdrop-blur">
      {PERIODS.map((p) => {
        const isActive = p === value;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={[
              'rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-all',
              isActive
                ? 'bg-vizme-coral text-white shadow-glow-coral'
                : 'text-vizme-greyblue hover:text-vizme-navy',
            ].join(' ')}
          >
            {formatPeriodLabel(p)}
          </button>
        );
      })}
    </div>
  );
}
