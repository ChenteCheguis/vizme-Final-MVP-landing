// One-off fixture generator for farmacia_demo.xlsx
// Run: node scripts/fixtures/generate_farmacia.mjs
import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ventasRows = [
  ['Farmacia San Miguel - Ventas Marzo 2026'],
  [],
  ['fecha', 'sku', 'producto', 'categoria', 'cantidad', 'precio_unitario', 'total'],
  ['2026-03-01', 'PCT500', 'Paracetamol 500mg caja', 'OTC', 18, 45, 810],
  ['2026-03-01', 'IBU400', 'Ibuprofeno 400mg caja', 'OTC', 12, 58, 696],
  ['2026-03-02', 'AMX500', 'Amoxicilina 500mg caja', 'Etico', 4, 220, 880],
  ['2026-03-02', 'CRM200', 'Crema hidratante 200ml', 'Dermocosmetica', 7, 180, 1260],
  ['2026-03-03', 'BLQ60', 'Bloqueador solar FPS60', 'Dermocosmetica', 5, 320, 1600],
  ['2026-03-03', 'PCT500', 'Paracetamol 500mg caja', 'OTC', 22, 45, 990],
  ['2026-03-04', 'ASP100', 'Aspirina 100mg caja', 'OTC', 9, 38, 342],
  ['2026-03-05', 'AMX500', 'Amoxicilina 500mg caja', 'Etico', 3, 220, 660],
  ['2026-03-05', 'IBU400', 'Ibuprofeno 400mg caja', 'OTC', 14, 58, 812],
  ['2026-03-06', 'LOR10', 'Loratadina 10mg caja', 'OTC', 8, 72, 576],
  ['2026-03-08', 'PCT500', 'Paracetamol 500mg caja', 'OTC', 25, 45, 1125],
  ['2026-03-09', 'CRM200', 'Crema hidratante 200ml', 'Dermocosmetica', 6, 180, 1080],
  ['2026-03-10', 'OMP20', 'Omeprazol 20mg caja', 'Etico', 5, 145, 725],
  ['2026-03-11', 'BLQ60', 'Bloqueador solar FPS60', 'Dermocosmetica', 4, 320, 1280],
  ['2026-03-12', 'IBU400', 'Ibuprofeno 400mg caja', 'OTC', 11, 58, 638],
  ['2026-03-13', 'PCT500', 'Paracetamol 500mg caja', 'OTC', 20, 45, 900],
  ['2026-03-15', 'AMX500', 'Amoxicilina 500mg caja', 'Etico', 5, 220, 1100],
  ['2026-03-16', 'LOR10', 'Loratadina 10mg caja', 'OTC', 10, 72, 720],
  ['2026-03-17', 'JBE120', 'Jarabe expectorante 120ml', 'OTC', 7, 95, 665],
  ['2026-03-18', 'CRM200', 'Crema hidratante 200ml', 'Dermocosmetica', 5, 180, 900],
  ['2026-03-19', 'ASP100', 'Aspirina 100mg caja', 'OTC', 12, 38, 456],
  ['2026-03-20', 'PCT500', 'Paracetamol 500mg caja', 'OTC', 19, 45, 855],
  ['2026-03-22', 'OMP20', 'Omeprazol 20mg caja', 'Etico', 4, 145, 580],
  ['2026-03-23', 'BLQ60', 'Bloqueador solar FPS60', 'Dermocosmetica', 3, 320, 960],
  ['2026-03-24', 'IBU400', 'Ibuprofeno 400mg caja', 'OTC', 15, 58, 870],
  ['2026-03-25', 'LOR10', 'Loratadina 10mg caja', 'OTC', 9, 72, 648],
  ['2026-03-26', 'JBE120', 'Jarabe expectorante 120ml', 'OTC', 6, 95, 570],
  ['2026-03-27', 'AMX500', 'Amoxicilina 500mg caja', 'Etico', 6, 220, 1320],
  ['2026-03-28', 'CRM200', 'Crema hidratante 200ml', 'Dermocosmetica', 8, 180, 1440],
  ['2026-03-29', 'PCT500', 'Paracetamol 500mg caja', 'OTC', 21, 45, 945],
  [],
  ['Total ventas marzo 2026', '', '', '', 303, '', 27448],
];

const inventarioRows = [
  ['Farmacia San Miguel - Inventario al 31 marzo 2026'],
  [],
  ['sku', 'producto', 'existencia_actual', 'punto_reorden', 'proveedor'],
  ['PCT500', 'Paracetamol 500mg caja', 42, 30, 'Genomma Lab'],
  ['IBU400', 'Ibuprofeno 400mg caja', 38, 25, 'Genomma Lab'],
  ['AMX500', 'Amoxicilina 500mg caja', 8, 15, 'Farmacias Similares'],
  ['CRM200', 'Crema hidratante 200ml', 22, 10, 'Eucerin MX'],
  ['BLQ60', 'Bloqueador solar FPS60', 14, 10, 'La Roche-Posay'],
  ['ASP100', 'Aspirina 100mg caja', 45, 30, 'Bayer'],
  ['LOR10', 'Loratadina 10mg caja', 28, 20, 'Genomma Lab'],
  ['OMP20', 'Omeprazol 20mg caja', 11, 15, 'Sanofi MX'],
  ['JBE120', 'Jarabe expectorante 120ml', 18, 10, 'Boiron MX'],
  ['VIT500', 'Vitamina C 500mg caja', 55, 25, 'Genomma Lab'],
  ['ANT250', 'Antibiotico 250mg caja', 6, 10, 'Farmacias Similares'],
  ['GEL90', 'Gel antibacterial 90ml', 40, 20, 'Maskeraid'],
  ['CUB50', 'Cubrebocas x50', 120, 50, 'Medline MX'],
  ['TER60', 'Termometro digital', 9, 5, 'Omron'],
  ['VEN10', 'Vendas elasticas x10', 35, 15, 'JeanCoutu'],
  ['ALG500', 'Algodon hidrofilo 500g', 22, 10, 'Kleenex'],
  ['ALC70', 'Alcohol 70% 500ml', 48, 25, 'Genomma Lab'],
  ['AGU250', 'Agua oxigenada 250ml', 32, 15, 'Genomma Lab'],
  ['PAS10', 'Pastillas garganta x10', 65, 30, 'Halls'],
  ['SUE60', 'Suero oral 600ml', 28, 15, 'Electrolit'],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ventasRows), 'Ventas Marzo');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inventarioRows), 'Inventario');

const outPath = resolve(__dirname, 'farmacia_demo.xlsx');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(outPath, buf);
console.log('✅ farmacia_demo.xlsx generado en', outPath);
