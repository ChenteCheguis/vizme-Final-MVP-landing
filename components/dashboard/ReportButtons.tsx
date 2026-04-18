import React, { useState } from 'react';
import { FileText, Presentation, Loader2, Download } from 'lucide-react';
import { generatePDF, generatePPTX } from '../../lib/reportGenerator';
import type { ReportData } from '../../lib/reportGenerator';

interface ReportButtonsProps {
  data: ReportData;
}

const ReportButtons: React.FC<ReportButtonsProps> = ({ data }) => {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingPpt, setLoadingPpt] = useState(false);

  const handlePDF = async () => {
    setLoadingPdf(true);
    try {
      generatePDF(data);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handlePPT = async () => {
    setLoadingPpt(true);
    try {
      await generatePPTX(data);
    } finally {
      setLoadingPpt(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Download size={14} className="text-vizme-greyblue" />
        <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide">
          Exportar reporte
        </p>
      </div>
      <p className="text-xs text-vizme-greyblue mb-4 leading-relaxed">
        Descarga el análisis en formato PDF ejecutivo o presentación PowerPoint lista para compartir.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handlePDF}
          disabled={loadingPdf}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-vizme-navy/10 px-4 py-2.5 text-sm font-medium text-vizme-navy hover:bg-vizme-bg hover:border-vizme-navy/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingPdf ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileText size={15} className="text-vizme-red" />
          )}
          Descargar PDF
        </button>
        <button
          onClick={handlePPT}
          disabled={loadingPpt}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-vizme-navy/10 px-4 py-2.5 text-sm font-medium text-vizme-navy hover:bg-vizme-bg hover:border-vizme-navy/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingPpt ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Presentation size={15} className="text-vizme-orange" />
          )}
          Descargar PPT
        </button>
      </div>
    </div>
  );
};

export default ReportButtons;
