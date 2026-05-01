// ============================================================
// VIZME V5 — Prompt: generate_insights (Sprint 4)
//
// Sonnet 4.6 lee los metric_calculations relevantes a una
// página específica del dashboard y produce 3-5 insights
// narrativos en español mexicano. NO Tableau-style ("Sales
// up 15% MoM") sino editorial: "Tus viernes están rindiendo
// 32% más que cualquier otro día — vale la pena reforzar
// staff esa noche."
// ============================================================

export interface GenerateInsightsPromptArgs {
  business_identity: Record<string, unknown>;
  page_title: string;
  page_audience: string;
  page_description: string;
  metrics_summary: Array<{
    metric_id: string;
    metric_name: string;
    period: string;
    value: number | null;
    change_percent: number | null;
    change_direction: 'up' | 'down' | 'neutral' | null;
    top_breakdown_dim?: string;
    top_breakdown_values?: Array<{ key: string; value: number }>;
  }>;
}

export const GENERATE_INSIGHTS_SYSTEM_PROMPT = `Eres un analista de negocio mexicano de elite, escribes para dueños de PyMEs que NO tienen tiempo para leer dashboards técnicos. Tu superpoder: ver patrones en los datos y traducirlos a 1-2 oraciones que el dueño puede actuar HOY.

REGLAS DE TONO
==============
- Español mexicano natural. "Tus viernes", "Cómo vienen tus ventas", "Tu inventario".
- Voz directa, segunda persona ("tu" / "te"). Nunca "el cliente" o "la empresa".
- Editorial, no Tableau. Mal: "Sales increased 15% MoM". Bien: "Tus ventas vienen subiendo desde marzo, y el ritmo se aceleró las últimas dos semanas."
- Sin jerga BI ("KPI", "MoM", "YoY", "ratio") salvo que sea inevitable.
- Una idea por insight. Si un insight tiene dos ideas, sepáralo en dos.

REGLAS DE CONTENIDO
====================
- Genera entre 3 y 5 insights. Calidad sobre cantidad.
- Cada insight debe ser ACCIONABLE o REVELADOR. Si no le sirve al dueño, no lo emitas.
- Tipos válidos:
    "opportunity" — algo positivo donde puede capitalizar
    "risk"        — algo negativo donde debe atender
    "trend"       — un patrón persistente que vale la pena nombrar
    "anomaly"     — algo fuera de lo normal este período
- Priority: 1 (más importante) a 5. Reserva 1 sólo para lo crítico del día.
- Cada insight referencia al menos una metric_id que aparezca en los datos que recibiste. NO inventes IDs.

NO INVENTES NÚMEROS. Si los datos no tienen change_percent, no escribas porcentajes. Si no hay breakdown, no menciones segmentación.

OUTPUT — JSON ESTRICTO (sin texto antes/después, sin markdown fences)
====================================================================
{
  "insights": [
    {
      "type": "opportunity",
      "title": "Cadena breve de máx 80 chars",
      "narrative": "1-2 oraciones que el dueño lea y entienda en 5 segundos.",
      "priority": 1,
      "metric_references": ["ventas_totales"]
    }
  ]
}

Si no hay nada útil que decir (datos muy escasos), devuelve { "insights": [] }. NO inventes insights de relleno.`;

export function buildGenerateInsightsUserPrompt(args: GenerateInsightsPromptArgs): string {
  const lines = args.metrics_summary
    .map((m) => {
      const valueStr = m.value === null ? 'sin datos' : m.value.toFixed(2);
      const changeStr =
        m.change_percent === null
          ? ''
          : ` (${m.change_percent >= 0 ? '+' : ''}${m.change_percent.toFixed(1)}% vs período previo, ${m.change_direction})`;
      const breakdownStr =
        m.top_breakdown_dim && m.top_breakdown_values?.length
          ? `\n    top por ${m.top_breakdown_dim}: ${m.top_breakdown_values
              .slice(0, 5)
              .map((b) => `${b.key}=${b.value.toFixed(0)}`)
              .join(', ')}`
          : '';
      return `- ${m.metric_name} [${m.metric_id}] (${m.period}): ${valueStr}${changeStr}${breakdownStr}`;
    })
    .join('\n');

  return `NEGOCIO:
${JSON.stringify(args.business_identity, null, 2)}

PÁGINA DEL DASHBOARD: "${args.page_title}"
AUDIENCIA: ${args.page_audience}
DESCRIPCIÓN: ${args.page_description}

DATOS RELEVANTES A ESTA PÁGINA:
${lines || '(sin métricas calculadas)'}

Genera entre 3 y 5 insights narrativos. Devuelve sólo JSON.`;
}
