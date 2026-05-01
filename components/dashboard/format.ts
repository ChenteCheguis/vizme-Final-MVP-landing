// Formatters compartidos para los widgets del dashboard.
// Mantenemos español mexicano: separador de miles con coma, decimales con punto.

import type { Metric } from '../../lib/v5types';

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const NUM_INT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NUM_DEC = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 });

export function formatMetricValue(
  value: number | null | undefined,
  metric?: Pick<Metric, 'format' | 'unit'> | null
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fmt = metric?.format ?? 'number';
  switch (fmt) {
    case 'currency':
      return MXN.format(value);
    case 'percent':
      return PCT.format(Math.abs(value) > 1.5 ? value / 100 : value);
    case 'duration':
      if (value >= 60) return `${NUM_DEC.format(value / 60)} h`;
      return `${NUM_INT.format(value)} min`;
    default: {
      const rounded = Math.abs(value) >= 100 ? NUM_INT.format(value) : NUM_DEC.format(value);
      return metric?.unit ? `${rounded} ${metric.unit}` : rounded;
    }
  }
}

export function formatChangePercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${NUM_DEC.format(pct)}%`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000)
    return `${NUM_DEC.format(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${NUM_DEC.format(value / 1_000)}k`;
  return NUM_INT.format(value);
}

export function formatPeriodLabel(period: string): string {
  switch (period) {
    case 'last_week':
      return 'Últimos 7 días';
    case 'last_month':
      return 'Últimos 30 días';
    case 'last_quarter':
      return 'Últimos 90 días';
    case 'last_year':
      return 'Últimos 12 meses';
    case 'all_time':
      return 'Histórico completo';
    default:
      return period;
  }
}

export const COLOR_SCHEMES = {
  navy: {
    primary: '#1e2a44',
    secondary: '#3b4d70',
    accent: '#5b6f95',
    palette: ['#1e2a44', '#3b4d70', '#5b6f95', '#8597b8', '#b1bdd2', '#dde3ee'],
  },
  coral: {
    primary: '#ff6b6b',
    secondary: '#ff8585',
    accent: '#ffa3a3',
    palette: ['#ff6b6b', '#ff8585', '#ffa3a3', '#ffc1c1', '#ffd9d9', '#ffeaea'],
  },
  orange: {
    primary: '#ff8c42',
    secondary: '#ffa264',
    accent: '#ffb787',
    palette: ['#ff8c42', '#ffa264', '#ffb787', '#ffcaa3', '#ffdcc1', '#ffead8'],
  },
  mixed: {
    primary: '#1e2a44',
    secondary: '#ff6b6b',
    accent: '#ff8c42',
    palette: ['#1e2a44', '#ff6b6b', '#ff8c42', '#5b6f95', '#ffa264', '#b1bdd2'],
  },
} as const;

export function getColorScheme(name: string | undefined | null) {
  const key = (name ?? 'navy') as keyof typeof COLOR_SCHEMES;
  return COLOR_SCHEMES[key] ?? COLOR_SCHEMES.navy;
}
