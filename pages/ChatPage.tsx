import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Loader2, Brain, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase, invokeFunction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import type { ChatMessage } from '../lib/claude';

// ─────────────────────────────────────────────
// Dynamic quick suggestions based on project
// ─────────────────────────────────────────────

function buildSuggestions(mainQuestion?: string, analysisArea?: string, needsPredictions?: boolean): string[] {
  const base = [
    '¿Qué debo hacer primero esta semana?',
    '¿Cuáles son los 3 mayores riesgos en mis datos?',
    '¿Dónde está mi mayor oportunidad de crecimiento?',
  ];
  if (mainQuestion) base.unshift(`¿Estoy respondiendo mi pregunta principal?`);
  if (analysisArea?.includes('Ventas')) base.push('¿Cuáles son mis productos más rentables?');
  if (analysisArea?.includes('Clientes')) base.push('¿Qué clientes están en riesgo de irse?');
  if (needsPredictions) base.push('¿Cómo estarán mis números el próximo mes?');
  return base.slice(0, 5);
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2.5`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-[10px] bg-gradient-to-br from-vizme-red to-vizme-orange flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
          <span className="text-[11px] font-black text-white">V</span>
        </div>
      )}
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed ${
        isUser
          ? 'bg-vizme-navy text-white rounded-br-sm'
          : 'bg-white border border-vizme-navy/8 text-vizme-navy rounded-bl-sm shadow-sm prose prose-sm prose-vizme max-w-none'
      }`}>
        {isUser ? msg.content : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5">{children}</ul>,
              li: ({ children }) => <li className="mb-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-bold text-vizme-navy">{children}</strong>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

const ChatPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, profile } = useAuth();
  const { activeProject } = useProject();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dynamicSuggestions, setSuggestions] = useState<string[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = dynamicSuggestions ?? buildSuggestions(
    activeProject?.main_question ?? undefined,
    activeProject?.analysis_area ?? undefined,
    activeProject?.needs_predictions,
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load full dashboard + file context once
  const [dashboardCtx, setDashboardCtx] = useState<unknown>(null);
  useEffect(() => {
    if (!user || !projectId) return;

    const loadContext = async () => {
      // Load dashboard with KPIs, charts, summary, alerts
      const { data: dashData } = await supabase.from('dashboards')
        .select('charts_json,kpis_json,summary_json,alerts_json,health_score,name')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Load the active file's enriched profile for deep data context
      const { data: fileData } = await supabase.from('files')
        .select('file_name,enriched_profile,data_profile,detected_business_type,row_count,column_count,quality_score,period_label')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ctx: Record<string, unknown> = {};
      if (dashData) {
        ctx.dashboard = dashData;
        // Summarize KPIs and chart insights for context
        const kpis = (dashData.kpis_json as any[]) ?? [];
        ctx.kpiSummary = kpis.map((k: any) => `${k.label}: ${k.value}${k.delta ? ` (${k.delta.value} ${k.delta.context ?? ''})` : ''}`).join('; ');
        const charts = (dashData.charts_json as any[]) ?? [];
        ctx.chartInsights = charts.map((c: any) => `[${c.title}] ${c.insight}`).join('\n');
        if (dashData.summary_json) {
          ctx.executiveSummary = dashData.summary_json;
        }
      }
      if (fileData) {
        ctx.file = {
          name: fileData.file_name,
          businessType: fileData.detected_business_type,
          rows: fileData.row_count,
          columns: fileData.column_count,
          quality: fileData.quality_score,
          period: fileData.period_label,
        };
        // Include enriched profile summary (column details, top cross-tabs)
        const ep = fileData.enriched_profile as any;
        if (ep) {
          ctx.dataColumns = ep.columnDetails?.map((c: any) =>
            `${c.name} (${c.type}${c.nullPct > 0 ? `, ${Math.round(c.nullPct * 100)}% vacíos` : ''})`
          ).join(', ');
          if (ep.crossTabs?.length) {
            ctx.topCrossTabs = ep.crossTabs.slice(0, 3).map((ct: any) =>
              `${ct.catColumn} × ${ct.numColumn}: ${ct.data.slice(0, 5).map((d: any) => `${d.name}=${d.value}`).join(', ')}`
            );
          }
          if (ep.correlations?.length) {
            ctx.correlations = ep.correlations.slice(0, 5).map((c: any) =>
              `${c.col1} ↔ ${c.col2} (r=${c.r.toFixed(2)})`
            );
          }
        }
      }
      setDashboardCtx(ctx);
    };

    loadContext();
  }, [user, projectId]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const { data, error } = await invokeFunction('analyze-data', {
        body: {
          mode: 'chat',
          chatMessage: msg,
          chatHistory: messages.slice(-10), // last 10 for context
          dashboardContext: dashboardCtx,
          projectId,
          profileContext: { company_name: profile?.company_name, industry: profile?.industry },
        },
      });
      if (error) throw error;

      const chat = data?.chat;
      let reply: string;
      if (chat?.message) {
        let full = chat.message;
        if (chat.bullets?.length) {
          full += '\n\n' + chat.bullets.map((b: string) => `• ${b}`).join('\n');
        }
        reply = full;
        if (chat.suggestedQuestions?.length) {
          setSuggestions(chat.suggestedQuestions.slice(0, 4));
        }
      } else {
        reply = data?.reply ?? 'Sin respuesta.';
      }
      setMessages([...newHistory, { role: 'assistant', content: reply }]);

      // Log chat in analysis_history (non-fatal)
      if (user && projectId) {
        supabase.from('analysis_history').insert({
          user_id: user.id,
          file_id: null,
          mode: 'chat',
          result_json: { question: msg, response: reply },
        }).then(() => {});
      }
    } catch {
      setMessages([...newHistory, { role: 'assistant', content: 'Hubo un error al procesar tu pregunta. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, projectId, dashboardCtx, profile, user]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-0.5">
          {activeProject?.name ?? 'Proyecto'}
        </p>
        <h1 className="text-2xl font-bold text-vizme-navy flex items-center gap-2">
          Copiloto IA
          <span className="text-[10px] font-bold bg-gradient-to-r from-vizme-red to-vizme-orange text-white px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles size={8} /> Opus
          </span>
        </h1>
        {activeProject?.main_question && (
          <p className="text-xs text-vizme-greyblue mt-1 italic">
            Pregunta del proyecto: "{activeProject.main_question}"
          </p>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-vizme-bg rounded-2xl border border-vizme-navy/8 p-4 space-y-4 min-h-0">

        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-vizme-red to-vizme-orange flex items-center justify-center mb-3 shadow-lg shadow-vizme-red/20">
                <span className="text-xl font-black text-white">V</span>
              </div>
              <p className="text-sm font-bold text-vizme-navy">Copiloto Vizme IA</p>
              <p className="text-xs text-vizme-greyblue mt-1 max-w-xs">
                Tu analista de negocios personal. Tiene acceso completo a tus datos, dashboard y KPIs — pregúntale lo que sea.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-2.5 text-center">
                Preguntas sugeridas
              </p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs text-vizme-navy bg-white border border-vizme-navy/8 hover:border-vizme-red/30 hover:bg-vizme-red/5 rounded-xl px-4 py-3 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-[10px] bg-gradient-to-br from-vizme-red to-vizme-orange flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-black text-white">V</span>
                </div>
                <div className="bg-white border border-vizme-navy/8 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-vizme-greyblue animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions after conversation started */}
      {messages.length > 0 && dynamicSuggestions && (
        <div className="flex-shrink-0 mt-2 flex gap-2 overflow-x-auto pb-1">
          {dynamicSuggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              disabled={loading}
              className="text-[10px] text-vizme-greyblue bg-white border border-vizme-navy/8 hover:border-vizme-red/30 rounded-full px-3 py-1.5 whitespace-nowrap transition-all disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 mt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregunta sobre tus datos... (Enter para enviar)"
          rows={2}
          className="flex-1 text-sm rounded-2xl border border-vizme-navy/10 bg-white px-4 py-3 text-vizme-navy placeholder-vizme-greyblue/40 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all resize-none"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="h-11 w-11 rounded-2xl bg-vizme-red text-white flex items-center justify-center hover:bg-vizme-orange transition-colors disabled:opacity-40 flex-shrink-0 shadow-lg shadow-vizme-red/20"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
