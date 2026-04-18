import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PptxGenJS from 'pptxgenjs';
import type { AnalysisResult } from './claude';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ReportData {
  companyName: string;
  industry: string;
  fileName: string;
  rowCount: number;
  analysis: AnalysisResult;
}

// ─────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────

const NAVY_RGB: [number, number, number] = [2, 34, 47];
const RED_RGB: [number, number, number] = [245, 74, 67];
const ORANGE_RGB: [number, number, number] = [242, 106, 61];
const GREY_RGB: [number, number, number] = [86, 105, 112];
const BG_RGB: [number, number, number] = [235, 248, 254];
const WHITE_RGB: [number, number, number] = [255, 255, 255];
const LIGHT_RGB: [number, number, number] = [245, 247, 250];

const INDUSTRY_LABEL: Record<string, string> = {
  empresa: 'Empresa',
  influencer: 'Influencer',
  artista: 'Artista Musical',
};

const EFFORT_LABEL: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto' };
const PRIORITY_LABEL: Record<string, string> = { high: 'ALTA', medium: 'MEDIA', low: 'BAJA' };

// ─────────────────────────────────────────────
// PDF Generator
// ─────────────────────────────────────────────

function pdfPageHeader(doc: jsPDF, companyName: string, date: string, W: number, margin: number) {
  doc.setFillColor(...NAVY_RGB);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFillColor(...RED_RGB);
  doc.rect(0, 0, W, 1.2, 'F');
  doc.setTextColor(...RED_RGB);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VIZME', margin, 8);
  doc.setTextColor(...WHITE_RGB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(companyName, margin + 22, 8);
  doc.setTextColor(...GREY_RGB);
  doc.text(date, W - margin, 8, { align: 'right' });
}

function pdfSectionTitle(doc: jsPDF, title: string, y: number, margin: number, contentW: number) {
  doc.setFillColor(...BG_RGB);
  doc.rect(margin, y - 4, contentW, 7, 'F');
  doc.setFillColor(...RED_RGB);
  doc.rect(margin, y - 4, 2.5, 7, 'F');
  doc.setTextColor(...NAVY_RGB);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 6, y + 0.5);
  return y + 10;
}

export function generatePDF(data: ReportData): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const W = 210;
  const margin = 18;
  const contentW = W - margin * 2;
  const date = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const industryLabel = INDUSTRY_LABEL[data.industry] ?? 'Negocio';
  const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);

  // ── PAGE 1: COVER ─────────────────────────────────────────
  doc.setFillColor(...NAVY_RGB);
  doc.rect(0, 0, W, 297, 'F');

  // Top accent bar
  doc.setFillColor(...RED_RGB);
  doc.rect(0, 0, W, 3.5, 'F');

  // VIZME logo text
  doc.setTextColor(...RED_RGB);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VIZME', margin, 28);
  doc.setTextColor(...GREY_RGB);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Business Intelligence + IA', margin, 35);

  // Report label
  doc.setTextColor(...GREY_RGB);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE ANÁLISIS', margin, 120);

  // Company name (large)
  doc.setTextColor(...WHITE_RGB);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const compLines = doc.splitTextToSize(data.companyName, contentW);
  doc.text(compLines, margin, 132);
  const afterComp = 132 + compLines.length * 11;

  // Industry badge
  doc.setFillColor(...RED_RGB);
  doc.roundedRect(margin, afterComp + 4, industryLabel.length * 2.4 + 8, 7.5, 1.5, 1.5, 'F');
  doc.setTextColor(...WHITE_RGB);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(industryLabel.toUpperCase(), margin + 4, afterComp + 9.2);

  // Red divider
  doc.setDrawColor(...RED_RGB);
  doc.setLineWidth(0.4);
  doc.line(margin, afterComp + 18, W - margin, afterComp + 18);

  // Meta info
  doc.setTextColor(...GREY_RGB);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Archivo: ${data.fileName}`, margin, afterComp + 26);
  doc.text(`Filas analizadas: ${data.rowCount.toLocaleString()}`, margin, afterComp + 33);
  doc.text(`Generado: ${date}`, margin, afterComp + 40);

  // Footer
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 285, W, 12, 'F');
  doc.setTextColor(...GREY_RGB);
  doc.setFontSize(7);
  doc.text('Generado por Vizme · vizme.io', margin, 292);
  doc.text('Confidencial', W - margin, 292, { align: 'right' });

  // ── PAGE 2: SUMMARY + KPIs ────────────────────────────────
  doc.addPage();
  pdfPageHeader(doc, data.companyName, date, W, margin);

  let y = 28;
  y = pdfSectionTitle(doc, 'Resumen Ejecutivo', y, margin, contentW);

  doc.setTextColor(...GREY_RGB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const summaryLines = doc.splitTextToSize(data.analysis.summary, contentW);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5.2 + 14;

  if ((data.analysis.kpis_detected?.length ?? 0) > 0) {
    y = pdfSectionTitle(doc, 'KPIs Detectados', y, margin, contentW);
    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor detectado']],
      body: data.analysis.kpis_detected.map((k) => [k.name, k.value]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: NAVY_RGB, textColor: WHITE_RGB, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: GREY_RGB },
      alternateRowStyles: { fillColor: BG_RGB },
      columnStyles: { 0: { fontStyle: 'bold', textColor: NAVY_RGB, cellWidth: 100 } },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ── PAGE 3: INSIGHTS ─────────────────────────────────────
  doc.addPage();
  pdfPageHeader(doc, data.companyName, date, W, margin);
  y = 28;
  y = pdfSectionTitle(doc, 'Insights Clave', y, margin, contentW);

  const priorityColors: Record<string, [number, number, number]> = {
    high: RED_RGB,
    medium: ORANGE_RGB,
    low: GREY_RGB,
  };

  for (const insight of data.analysis.insights ?? []) {
    const bodyLines = doc.splitTextToSize(insight.body, contentW - 10);
    const blockH = Math.max(14, 14 + bodyLines.length * 4.5);

    if (y + blockH > 268) {
      doc.addPage();
      pdfPageHeader(doc, data.companyName, date, W, margin);
      y = 28;
    }

    const pColor = priorityColors[insight.priority] ?? GREY_RGB;

    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(margin, y, contentW, blockH, 2, 2, 'F');
    doc.setFillColor(...pColor);
    doc.roundedRect(margin, y, 2.5, blockH, 1, 1, 'F');

    // Priority badge
    doc.setFillColor(...pColor);
    doc.roundedRect(margin + 6, y + 3, 15, 5, 1, 1, 'F');
    doc.setTextColor(...WHITE_RGB);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(PRIORITY_LABEL[insight.priority] ?? 'MEDIA', margin + 8, y + 6.8);

    // Title
    doc.setTextColor(...NAVY_RGB);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(insight.title, margin + 25, y + 7);

    // Body
    doc.setTextColor(...GREY_RGB);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(bodyLines, margin + 6, y + 14);

    y += blockH + 4;
  }

  // ── PAGE N: ALERTS + RECOMMENDATIONS ─────────────────────
  if (y > 200) {
    doc.addPage();
    pdfPageHeader(doc, data.companyName, date, W, margin);
    y = 28;
  } else {
    y += 6;
  }

  if ((data.analysis.alerts?.length ?? 0) > 0) {
    y = pdfSectionTitle(doc, 'Alertas y Riesgos', y, margin, contentW);

    for (const alert of data.analysis.alerts ?? []) {
      const bodyLines = doc.splitTextToSize(alert.body, contentW - 10);
      const blockH = Math.max(14, 14 + bodyLines.length * 4.5);

      if (y + blockH > 268) {
        doc.addPage();
        pdfPageHeader(doc, data.companyName, date, W, margin);
        y = 28;
      }

      doc.setFillColor(255, 243, 242);
      doc.roundedRect(margin, y, contentW, blockH, 2, 2, 'F');
      doc.setFillColor(...RED_RGB);
      doc.roundedRect(margin, y, 2.5, blockH, 1, 1, 'F');

      doc.setTextColor(...RED_RGB);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(alert.title, margin + 6, y + 7);

      doc.setTextColor(120, 50, 50);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(bodyLines, margin + 6, y + 14);

      y += blockH + 4;
    }
    y += 6;
  }

  if ((data.analysis.recommendations?.length ?? 0) > 0) {
    if (y > 220) {
      doc.addPage();
      pdfPageHeader(doc, data.companyName, date, W, margin);
      y = 28;
    }

    y = pdfSectionTitle(doc, 'Recomendaciones Accionables', y, margin, contentW);

    autoTable(doc, {
      startY: y,
      head: [['Acción', 'Impacto esperado', 'Esfuerzo']],
      body: data.analysis.recommendations.map((r) => [
        r.action,
        r.impact,
        EFFORT_LABEL[r.effort] ?? r.effort,
      ]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: NAVY_RGB, textColor: WHITE_RGB, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: GREY_RGB },
      alternateRowStyles: { fillColor: BG_RGB },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: NAVY_RGB, cellWidth: 72 },
        1: { cellWidth: 72 },
        2: { cellWidth: contentW - 144, halign: 'center' },
      },
    });
  }

  // ── Footer on every page ─────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY_RGB);
    doc.rect(0, 285, W, 12, 'F');
    doc.setTextColor(...GREY_RGB);
    doc.setFontSize(7);
    doc.text(`Página ${p} de ${totalPages}`, W / 2, 292, { align: 'center' });
    doc.text('Generado por Vizme · vizme.io', margin, 292);
    doc.text('Confidencial', W - margin, 292, { align: 'right' });
  }

  doc.save(`Vizme_Reporte_${safeFileName(data.companyName)}_${new Date().getFullYear()}.pdf`);
}

// ─────────────────────────────────────────────
// PPTX Generator
// ─────────────────────────────────────────────

type PptxSlide = ReturnType<InstanceType<typeof PptxGenJS>['addSlide']>;

function addPptxHeader(
  slide: PptxSlide,
  prs: InstanceType<typeof PptxGenJS>,
  sectionTitle: string,
  companyName: string,
) {
  slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.15, fill: { color: '02222F' } });
  slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.06, fill: { color: 'F54A43' } });
  slide.addText('VIZME', { x: 0.5, y: 0.1, w: 1.2, h: 0.35, color: 'F54A43', fontSize: 12, bold: true, fontFace: 'Helvetica' });
  slide.addText('·', { x: 1.6, y: 0.1, w: 0.3, h: 0.35, color: 'FFFFFF', fontSize: 12, fontFace: 'Helvetica' });
  slide.addText(companyName, { x: 1.85, y: 0.1, w: 7, h: 0.35, color: 'FFFFFF', fontSize: 11, fontFace: 'Helvetica' });
  slide.addText(sectionTitle, { x: 0.5, y: 0.55, w: 12, h: 0.5, color: 'FFFFFF', fontSize: 18, bold: true, fontFace: 'Helvetica' });
}

export async function generatePPTX(data: ReportData): Promise<void> {
  const prs = new PptxGenJS();
  prs.layout = 'LAYOUT_WIDE';

  const date = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const industryLabel = INDUSTRY_LABEL[data.industry] ?? 'Negocio';
  const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);

  // ── SLIDE 1: COVER ────────────────────────────────────────
  const cover = prs.addSlide();
  cover.background = { color: '02222F' };

  cover.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.06, fill: { color: 'F54A43' } });

  cover.addText('VIZME', {
    x: 0.6, y: 0.5, w: 3, h: 0.5,
    color: 'F54A43', fontSize: 24, bold: true, fontFace: 'Helvetica',
  });
  cover.addText('Business Intelligence + IA', {
    x: 0.6, y: 1.05, w: 6, h: 0.3,
    color: '566970', fontSize: 10, fontFace: 'Helvetica',
  });

  cover.addText('REPORTE DE ANÁLISIS', {
    x: 0.6, y: 2.6, w: 10, h: 0.35,
    color: '566970', fontSize: 10, bold: true, charSpacing: 3, fontFace: 'Helvetica',
  });
  cover.addText(data.companyName, {
    x: 0.6, y: 3.05, w: 11.3, h: 1.5,
    color: 'FFFFFF', fontSize: 38, bold: true, fontFace: 'Helvetica', breakLine: true,
  });

  cover.addShape(prs.ShapeType.roundRect, {
    x: 0.6, y: 4.7, w: industryLabel.length * 0.12 + 0.8, h: 0.32,
    fill: { color: 'F54A43' }, rectRadius: 0.04,
  });
  cover.addText(industryLabel.toUpperCase(), {
    x: 0.6, y: 4.7, w: industryLabel.length * 0.12 + 0.8, h: 0.32,
    color: 'FFFFFF', fontSize: 8, bold: true, fontFace: 'Helvetica', align: 'center',
  });

  cover.addShape(prs.ShapeType.line, {
    x: 0.6, y: 5.15, w: 11.3, h: 0,
    line: { color: 'F54A43', width: 0.5 },
  });

  cover.addText(`${data.fileName}  ·  ${data.rowCount.toLocaleString()} filas  ·  ${date}`, {
    x: 0.6, y: 5.4, w: 11.3, h: 0.3,
    color: '566970', fontSize: 9, fontFace: 'Helvetica',
  });

  // ── SLIDE 2: EXECUTIVE SUMMARY ───────────────────────────
  const s2 = prs.addSlide();
  s2.background = { color: 'F7FAFB' };
  addPptxHeader(s2, prs, 'Resumen Ejecutivo', data.companyName);

  s2.addText(data.analysis.summary, {
    x: 0.6, y: 1.3, w: 11.3, h: 3.5,
    color: '566970', fontSize: 15, fontFace: 'Helvetica',
    valign: 'top', wrap: true, lineSpacingMultiple: 1.5,
  });

  // ── SLIDE 3: KPIs ─────────────────────────────────────────
  if ((data.analysis.kpis_detected?.length ?? 0) > 0) {
    const s3 = prs.addSlide();
    s3.background = { color: 'F7FAFB' };
    addPptxHeader(s3, prs, 'KPIs Detectados', data.companyName);

    const kpis = data.analysis.kpis_detected.slice(0, 6);
    kpis.forEach((kpi, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.5 + col * 4.1;
      const y = 1.35 + row * 1.8;
      s3.addShape(prs.ShapeType.roundRect, {
        x, y, w: 3.8, h: 1.55,
        fill: { color: 'FFFFFF' },
        line: { color: 'DDE8ED', width: 0.5 },
        rectRadius: 0.1,
      });
      s3.addText(kpi.value, {
        x: x + 0.2, y: y + 0.15, w: 3.4, h: 0.7,
        color: '02222F', fontSize: 24, bold: true, fontFace: 'Helvetica',
      });
      s3.addShape(prs.ShapeType.line, {
        x: x + 0.2, y: y + 0.88, w: 3.2, h: 0,
        line: { color: 'F54A43', width: 0.5 },
      });
      s3.addText(kpi.name, {
        x: x + 0.2, y: y + 1.0, w: 3.4, h: 0.45,
        color: '566970', fontSize: 9, fontFace: 'Helvetica', wrap: true,
      });
    });
  }

  // ── SLIDE 4+: INSIGHTS ────────────────────────────────────
  const insights = data.analysis.insights ?? [];
  const insightsPerSlide = 3;

  for (let si = 0; si < insights.length; si += insightsPerSlide) {
    const chunk = insights.slice(si, si + insightsPerSlide);
    const totalSlides = Math.ceil(insights.length / insightsPerSlide);
    const slideNum = Math.floor(si / insightsPerSlide) + 1;
    const title = totalSlides > 1 ? `Insights Clave (${slideNum}/${totalSlides})` : 'Insights Clave';

    const sl = prs.addSlide();
    sl.background = { color: 'F7FAFB' };
    addPptxHeader(sl, prs, title, data.companyName);

    const pColors: Record<string, string> = { high: 'F54A43', medium: 'F26A3D', low: '566970' };
    const pLabels: Record<string, string> = { high: 'ALTA', medium: 'MEDIA', low: 'BAJA' };

    chunk.forEach((insight, i) => {
      const y = 1.3 + i * 1.7;
      const pc = pColors[insight.priority] ?? '566970';

      sl.addShape(prs.ShapeType.roundRect, {
        x: 0.5, y, w: 11.9, h: 1.5,
        fill: { color: 'FFFFFF' },
        line: { color: 'DDE8ED', width: 0.5 },
        rectRadius: 0.08,
      });
      sl.addShape(prs.ShapeType.rect, {
        x: 0.5, y, w: 0.07, h: 1.5,
        fill: { color: pc },
      });
      sl.addShape(prs.ShapeType.roundRect, {
        x: 0.7, y: y + 0.1, w: 0.75, h: 0.28,
        fill: { color: pc }, rectRadius: 0.03,
      });
      sl.addText(pLabels[insight.priority] ?? 'MEDIA', {
        x: 0.7, y: y + 0.1, w: 0.75, h: 0.28,
        color: 'FFFFFF', fontSize: 7, bold: true, fontFace: 'Helvetica', align: 'center',
      });
      sl.addText(insight.title, {
        x: 1.6, y: y + 0.08, w: 10.6, h: 0.38,
        color: '02222F', fontSize: 11, bold: true, fontFace: 'Helvetica',
      });
      sl.addText(insight.body, {
        x: 0.7, y: y + 0.52, w: 11.5, h: 0.88,
        color: '566970', fontSize: 9, fontFace: 'Helvetica', wrap: true,
      });
    });
  }

  // ── SLIDE: ALERTS ─────────────────────────────────────────
  if ((data.analysis.alerts?.length ?? 0) > 0) {
    const alertSlide = prs.addSlide();
    alertSlide.background = { color: 'F7FAFB' };
    addPptxHeader(alertSlide, prs, 'Alertas y Riesgos', data.companyName);

    data.analysis.alerts.slice(0, 4).forEach((alert, i) => {
      const y = 1.3 + i * 1.55;
      alertSlide.addShape(prs.ShapeType.roundRect, {
        x: 0.5, y, w: 11.9, h: 1.35,
        fill: { color: 'FFF3F2' },
        line: { color: 'FECACA', width: 0.5 },
        rectRadius: 0.08,
      });
      alertSlide.addShape(prs.ShapeType.rect, {
        x: 0.5, y, w: 0.07, h: 1.35,
        fill: { color: 'F54A43' },
      });
      alertSlide.addText(alert.title, {
        x: 0.7, y: y + 0.12, w: 11.5, h: 0.38,
        color: 'F54A43', fontSize: 11, bold: true, fontFace: 'Helvetica',
      });
      alertSlide.addText(alert.body, {
        x: 0.7, y: y + 0.55, w: 11.5, h: 0.7,
        color: '7C2020', fontSize: 9, fontFace: 'Helvetica', wrap: true,
      });
    });
  }

  // ── SLIDE: RECOMMENDATIONS ───────────────────────────────
  if ((data.analysis.recommendations?.length ?? 0) > 0) {
    const recoSlide = prs.addSlide();
    recoSlide.background = { color: 'F7FAFB' };
    addPptxHeader(recoSlide, prs, 'Recomendaciones', data.companyName);

    const effortColors: Record<string, string> = { low: '16a34a', medium: 'F26A3D', high: 'F54A43' };
    const effortLabels: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto' };

    data.analysis.recommendations.slice(0, 5).forEach((rec, i) => {
      const y = 1.3 + i * 1.2;
      if (y > 6.6) return;

      recoSlide.addShape(prs.ShapeType.roundRect, {
        x: 0.5, y, w: 11.9, h: 1.05,
        fill: { color: 'FFFFFF' },
        line: { color: 'DDE8ED', width: 0.5 },
        rectRadius: 0.08,
      });

      // Number badge
      recoSlide.addShape(prs.ShapeType.ellipse, {
        x: 0.6, y: y + 0.18, w: 0.52, h: 0.52,
        fill: { color: '02222F' },
      });
      recoSlide.addText(`${i + 1}`, {
        x: 0.6, y: y + 0.22, w: 0.52, h: 0.44,
        color: 'FFFFFF', fontSize: 12, bold: true, fontFace: 'Helvetica', align: 'center',
      });

      // Effort badge
      const ec = effortColors[rec.effort] ?? '566970';
      recoSlide.addShape(prs.ShapeType.roundRect, {
        x: 10.9, y: y + 0.08, w: 1.3, h: 0.26,
        fill: { color: ec }, rectRadius: 0.03,
      });
      recoSlide.addText(`Esfuerzo ${effortLabels[rec.effort] ?? rec.effort}`, {
        x: 10.9, y: y + 0.08, w: 1.3, h: 0.26,
        color: 'FFFFFF', fontSize: 7, bold: true, fontFace: 'Helvetica', align: 'center',
      });

      recoSlide.addText(rec.action, {
        x: 1.25, y: y + 0.1, w: 9.5, h: 0.35,
        color: '02222F', fontSize: 10, bold: true, fontFace: 'Helvetica',
      });
      recoSlide.addText(rec.impact, {
        x: 1.25, y: y + 0.5, w: 9.5, h: 0.45,
        color: '566970', fontSize: 9, fontFace: 'Helvetica', wrap: true,
      });
    });
  }

  await prs.writeFile({ fileName: `Vizme_Presentacion_${safeFileName(data.companyName)}_${new Date().getFullYear()}.pptx` });
}
