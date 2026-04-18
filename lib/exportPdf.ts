/**
 * Export dashboard to PDF using the browser's print dialog.
 * This approach works without external libraries and renders
 * charts as they appear on screen.
 */

export function exportDashboardPdf(
  dashboardElement: HTMLElement,
  fileName: string,
  projectName: string,
): void {
  // Create a new window for clean print
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor permite ventanas emergentes para exportar el PDF.');
    return;
  }

  // Clone the dashboard content
  const clone = dashboardElement.cloneNode(true) as HTMLElement;

  // Remove interactive elements that don't belong in PDF
  clone.querySelectorAll('button, input, [data-no-print]').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });

  // Get all stylesheets from the current page
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(el => el.outerHTML)
    .join('\n');

  const now = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${fileName}</title>
      ${styles}
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: white;
          padding: 24px;
        }
        .pdf-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          margin-bottom: 24px;
          border-bottom: 2px solid #02222F;
        }
        .pdf-header h1 {
          font-size: 20px;
          font-weight: 900;
          color: #02222F;
          margin: 0;
        }
        .pdf-header p {
          font-size: 11px;
          color: #566970;
          margin: 2px 0 0;
        }
        .pdf-logo {
          font-size: 14px;
          font-weight: 900;
          color: #F54A43;
          letter-spacing: 0.2em;
        }
        .pdf-footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          font-size: 9px;
          color: #94a3b8;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="pdf-header">
        <div>
          <h1>${projectName}</h1>
          <p>Generado el ${now}</p>
        </div>
        <div class="pdf-logo">VIZME</div>
      </div>
      ${clone.outerHTML}
      <div class="pdf-footer">
        Reporte generado por Vizme AI &mdash; vizme.app
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to render then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Close the window after a delay (user may cancel print)
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  };
}
