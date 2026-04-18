import { invokeFunction as invokeEdge } from './supabase';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AnalysisInsight {
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisAlert {
  title: string;
  body: string;
}

export interface AnalysisRecommendation {
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface AnalysisKPI {
  name: string;
  value: string;
}

export interface AnalysisResult {
  summary: string;
  insights: AnalysisInsight[];
  alerts: AnalysisAlert[];
  recommendations: AnalysisRecommendation[];
  kpis_detected: AnalysisKPI[];
}

// ─────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function invokeFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await invokeEdge('analyze-data', { body });
  if (error) throw new Error((error as any).message ?? 'Error desconocido');
  if (!(data as any)?.success) throw new Error((data as any)?.error ?? 'Error desconocido');
  return data as Record<string, unknown>;
}

export async function analyzeUpload(uploadId: string): Promise<AnalysisResult> {
  const data = await invokeFunction({ uploadId });
  return data.analysis as AnalysisResult;
}

export async function analyzeUploads(uploadIds: string[]): Promise<AnalysisResult> {
  const data = await invokeFunction({ uploadIds });
  return data.analysis as AnalysisResult;
}

export async function chatWithData(message: string, history: ChatMessage[]): Promise<string> {
  const data = await invokeFunction({ chatMessage: message, chatHistory: history });
  return data.reply as string;
}
