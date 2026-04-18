// ─────────────────────────────────────────────
// dataFormatter.ts
// Formats DataProfile into a human-readable
// string for the chat system prompt.
// ─────────────────────────────────────────────

import type { DataProfile } from './inferDataProfile';
import { formatValue } from './aggregateData';

const DATA_TYPE_LABEL: Record<string, string> = {
  ventas:      'datos de ventas / facturación',
  inventario:  'datos de inventario / stock',
  clientes:    'datos de clientes / CRM',
  operaciones: 'datos de operaciones / procesos',
  financiero:  'datos financieros / contabilidad',
  desconocido: 'datos de negocio',
};

export function formatDataProfileForChat(profile: DataProfile): string {
  const lines: string[] = [];

  lines.push(`DATOS ACTUALES (${profile.totalRows.toLocaleString('es-MX')} filas de ${DATA_TYPE_LABEL[profile.dataType] ?? 'negocio'}):`);

  // KPI-level stats for numeric columns
  if (profile.numericColumns.length > 0) {
    lines.push('\nMÉTRICAS PRINCIPALES:');
    for (const col of profile.numericColumns.slice(0, 5)) {
      const s = profile.stats[col];
      if (!s) continue;
      lines.push(`  • ${col}: suma=${formatValue(s.sum, 'number')}, promedio=${formatValue(s.mean, 'number')}, rango=${ formatValue(s.min, 'number')}–${formatValue(s.max, 'number')}`);
    }
  }

  // Category dimensions
  if (profile.categoryColumns.length > 0) {
    lines.push('\nDIMENSIONES CATEGÓRICAS:');
    for (const col of profile.categoryColumns.slice(0, 4)) {
      const card = profile.categoryCardinality[col] ?? 0;
      lines.push(`  • ${col}: ${card} valores únicos`);
    }
  }

  // Data quality notes
  const qualityIssues: string[] = [];
  for (const [col, count] of Object.entries(profile.nullCount)) {
    if (count > 0 && profile.totalRows > 0) {
      const pct = Math.round((count / profile.totalRows) * 100);
      if (pct >= 10) qualityIssues.push(`${col} tiene ${pct}% de valores nulos`);
    }
  }
  if (profile.duplicateRows > 0) {
    qualityIssues.push(`${profile.duplicateRows} filas duplicadas detectadas`);
  }
  if (qualityIssues.length > 0) {
    lines.push('\nCALIDAD DE DATOS: ' + qualityIssues.join(', '));
  }

  // Columns available
  lines.push(`\nCOLUMNAS: ${profile.columns.map((c) => `${c.name}(${c.type})`).join(', ')}`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Dynamic chat suggestions from DataProfile
// ─────────────────────────────────────────────

export function buildChatSuggestions(profile: DataProfile | null): string[] {
  if (!profile) {
    return [
      '¿Qué datos debo subir para empezar?',
      '¿Qué puede analizar Vizme con mis datos?',
    ];
  }

  const suggestions: string[] = [];

  // Category with most variation
  if (profile.categoryColumns.length > 0) {
    const topCat = profile.categoryColumns.reduce((a, b) =>
      (profile.categoryCardinality[a] ?? 0) >= (profile.categoryCardinality[b] ?? 0) ? a : b
    );
    suggestions.push(`¿Cuál ${topCat} rinde más?`);
  }

  // High variance numeric column
  if (profile.numericColumns.length > 0) {
    const highVar = profile.numericColumns.find((col) => {
      const s = profile.stats[col];
      return s && s.stdDev > s.mean * 0.5;
    });
    if (highVar) suggestions.push(`¿Por qué hay tanta diferencia en ${highVar}?`);
  }

  // Two numeric columns → relationship question
  if (profile.numericColumns.length >= 2) {
    suggestions.push(`¿Qué relación hay entre ${profile.numericColumns[0]} y ${profile.numericColumns[1]}?`);
  }

  // Date column → temporal
  if (profile.hasDateColumn && profile.dateColumnName) {
    suggestions.push('¿Cuál fue el mejor período en los datos?');
  }

  // Quality issues
  if (profile.duplicateRows > 0) {
    suggestions.push('¿Impactan los duplicados en mis métricas?');
  }

  // Fallbacks
  if (suggestions.length < 2) {
    suggestions.push('¿Cuál es el insight más importante?');
    suggestions.push('¿Qué acción debo tomar esta semana?');
  }

  return suggestions.slice(0, 4);
}
