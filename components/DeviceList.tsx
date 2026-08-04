
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { MedicalDevice, DeviceStatus, DEVICE_STATUS_RO, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, calculateNextMaintenanceDate } from '../types';
import { Search, Trash2, Box, FileSpreadsheet, Edit2, X, ShieldAlert, RotateCcw, Layers, FileText, Save, Building2, Plus, Upload, CheckCircle, AlertTriangle, QrCode, Tag, LayoutGrid, Rows3, SlidersHorizontal, ChevronDown, ShieldCheck } from 'lucide-react';

import Portal from './Portal';
import useEscape from './useEscape';
import Pager, { PAGE_SIZES, PageSizePicker } from './Pager';
import DepartmentPicker from './DepartmentPicker';
import ConfirmDialog from './ConfirmDialog';
const QRLabelSheet = React.lazy(() => import('./QRLabelSheet'));

/**
 * One dropdown per filter. The label above says which filter it is, so the
 * "all" option can stay a short "Toate" and the control fits two-per-row on a
 * phone instead of taking a full row each.
 */
const FilterSelect = React.memo(({ label, value, onChange, options, labelFor }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labelFor?: (v: string) => string;
}) => (
  <div className="space-y-1 min-w-0">
    <label className="tech-label ml-1">{label}</label>
    <select
      aria-label={label}
      className="w-full px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wide shadow-inner"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="ALL">Toate</option>
      {options.map(o => <option key={o} value={o}>{(labelFor ? labelFor(o) : o).toUpperCase()}</option>)}
    </select>
  </div>
));

/**
 * The list unmounts while you look at a device, so without this every trip into
 * a device and back would drop you at the top of page 1 with the filters reset.
 * Kept in module scope (not storage) so it lasts the session and no more.
 */
const listState = {
  search: '',
  status: 'ALL' as DeviceStatus | 'ALL',
  dept: 'ALL' as string,
  category: 'ALL' as string,
  tag: 'ALL' as string,
  metrologie: 'ALL' as FiltruMetrologie,
  page: 1,
};

/**
 * Filtrul de metrologie.
 *
 * "Care aparate au buletinul expirat" e intrebarea care se pune la un control,
 * si pana acum se raspundea deschizand aparatele unul cate unul.
 */
type FiltruMetrologie = 'ALL' | 'EXPIRAT' | 'CURAND' | 'LIPSA' | 'VALABIL';

const FILTRE_METROLOGIE: { id: FiltruMetrologie; text: string }[] = [
  { id: 'ALL', text: 'Toate' },
  { id: 'EXPIRAT', text: 'Metrologie expirata' },
  { id: 'CURAND', text: 'Expira in 45 de zile' },
  { id: 'LIPSA', text: 'Fara buletin trecut' },
  { id: 'VALABIL', text: 'Metrologie valabila' },
];

const zileRamase = (data?: string): number | null => {
  if (!data || Number.isNaN(Date.parse(data))) return null;
  const azi = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
  return Math.ceil((new Date(`${data}T00:00:00`).getTime() - azi.getTime()) / 86400000);
};

const treceFiltrulMetrologic = (d: MedicalDevice, f: FiltruMetrologie): boolean => {
  if (f === 'ALL') return true;
  if (!d.metrologyRequired) return false;
  // Un aparat casat nu mai are termene de respectat. Fara randul asta, filtrul
  // ar arata doua expirate acolo unde Panoul numara una — si cifra care nu se
  // potriveste cu lista de sub ea nu mai e crezuta de nimeni.
  if (d.status === DeviceStatus.RETIRED) return false;
  const z = zileRamase(d.metrologyExpiry);
  if (f === 'LIPSA') return z === null;
  if (z === null) return false;
  if (f === 'EXPIRAT') return z < 0;
  if (f === 'CURAND') return z >= 0 && z <= 45;
  return z >= 0;
};

/**
 * Lista de metrologie, pentru control.
 *
 * Separata de exportul mare intentionat: acolo intrarea unei coloane noi cere
 * retusarea antetelor imbinate, iar hartia care se cere la un control e alta —
 * numai aparatele supuse controlului metrologic, cu buletinul, laboratorul,
 * termenul si cate zile mai are. Se exporta ce se vede: filtrezi la expirate,
 * exporti expiratele.
 */
const exportMetrologie = async (devices: MedicalDevice[]) => {
  const supuse = devices.filter(d => d.metrologyRequired && d.status !== DeviceStatus.RETIRED);
  if (supuse.length === 0) return;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();
  const ws = wb.addWorksheet('Metrologie', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { key: 'no', width: 5 }, { key: 'name', width: 30 }, { key: 'sn', width: 20 },
    { key: 'dept', width: 20 }, { key: 'cert', width: 16 }, { key: 'lab', width: 22 },
    { key: 'data', width: 14 }, { key: 'exp', width: 14 }, { key: 'zile', width: 12 },
    { key: 'stare', width: 18 },
  ];
  const TOTAL = 10;
  const titlu = ws.addRow(['BIOMEDIC — VERIFICARI METROLOGICE', ...Array(TOTAL - 1).fill('')]);
  ws.mergeCells(1, 1, 1, TOTAL);
  titlu.height = 38;
  titlu.getCell(1).style = {
    font: { bold: true, size: 15, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  const sub = ws.addRow([`Generat: ${new Date().toLocaleString('ro-RO')}  •  ${supuse.length} mijloace de masurare`,
    ...Array(TOTAL - 1).fill('')]);
  ws.mergeCells(2, 1, 2, TOTAL);
  sub.getCell(1).style = {
    font: { size: 9, color: { argb: 'FF94A3B8' }, italic: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF263238' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  ws.addRow([]).height = 6;

  const cap = ws.addRow(['#', 'Denumire', 'Numar serie', 'Sectie', 'Nr. buletin', 'Laborator',
                         'Data verificarii', 'Valabil pana la', 'Zile ramase', 'Stare']);
  cap.height = 24;
  cap.eachCell(c => { c.style = {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  }; });

  const ordonate = [...supuse].sort((a, b) => (a.metrologyExpiry || '9999').localeCompare(b.metrologyExpiry || '9999'));
  ordonate.forEach((d, i) => {
    const z = zileRamase(d.metrologyExpiry);
    const stare = z === null ? 'Fara buletin trecut' : z < 0 ? 'EXPIRAT' : z <= 45 ? 'Expira curand' : 'Valabil';
    const culoare = z === null ? 'FFF59E0B' : z < 0 ? 'FFDC2626' : z <= 45 ? 'FFD97706' : 'FF059669';
    const r = ws.addRow([i + 1, d.name, d.serialNumber, d.department,
      d.metrologyCertificate || '', d.metrologyLab || '',
      d.metrologyDate || '', d.metrologyExpiry || '',
      z === null ? '' : z, stare]);
    r.getCell(10).style = { font: { bold: true, color: { argb: culoare } }, alignment: { horizontal: 'center' } };
    r.getCell(9).alignment = { horizontal: 'center' };
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Metrologie_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const exportToExcel = async (devices: MedicalDevice[]) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();

  const TOTAL_COLS = 14;
  const statusColor = (status: string) => {
    if (status === 'Active') return 'FF059669';
    if (status === 'In Maintenance') return 'FFD97706';
    if (status === 'Broken') return 'FFDC2626';
    return 'FF64748B';
  };

  const statusCounts: Record<string, number> = {};
  devices.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });
  const cncanCount = devices.filter(d => d.isCNCAN).length;

  // ── SHEET 1: Device Inventory ─────────────────────────────────────────────
  const ws = wb.addWorksheet('Device Inventory', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { key: 'no',          width: 5  },
    { key: 'name',        width: 28 },
    { key: 'category',    width: 22 },
    { key: 'mfr',         width: 20 },
    { key: 'model',       width: 18 },
    { key: 'sn',          width: 16 },
    { key: 'dept',        width: 20 },
    { key: 'status',      width: 16 },
    { key: 'purchase',    width: 14 },
    { key: 'warranty',    width: 16 },
    { key: 'nextpm',      width: 16 },
    { key: 'cncan',       width: 8  },
    { key: 'notes',       width: 32 },
    { key: 'id',          width: 28 },
  ];

  // Title row
  const titleRow = ws.addRow(['BIOMEDIC — RAPORT INVENTAR DISPOZITIVE', ...Array(TOTAL_COLS - 1).fill('')]);
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  titleRow.height = 42;
  titleRow.getCell(1).style = {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  // Subtitle row
  const subRow = ws.addRow([
    `Sistem de management echipamente medicale  •  Generat: ${new Date().toLocaleString()}  •  ${devices.length} dispozitive`,
    ...Array(TOTAL_COLS - 1).fill(''),
  ]);
  ws.mergeCells(2, 1, 2, TOTAL_COLS);
  subRow.height = 18;
  subRow.getCell(1).style = {
    font: { size: 9, color: { argb: 'FF94A3B8' }, italic: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF263238' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  // Spacer
  ws.addRow([]).height = 8;

  // Summary stats (label row + value row, each spanning groups of columns)
  const summaryGroups = [
    { col: 1,  span: 2,  label: 'TOTAL',        value: devices.length,                  color: 'FF2563EB' },
    { col: 3,  span: 2,  label: 'ACTIVE',        value: statusCounts['Active'] || 0,     color: 'FF059669' },
    { col: 5,  span: 2,  label: 'MENTENANTA',    value: statusCounts['In Maintenance'] || 0, color: 'FFD97706' },
    { col: 7,  span: 2,  label: 'DEFECTE',       value: statusCounts['Broken'] || 0,     color: 'FFDC2626' },
    { col: 9,  span: 2,  label: 'CASATE',        value: statusCounts['Retired'] || 0,    color: 'FF64748B' },
    { col: 11, span: 3,  label: 'CNCAN',         value: cncanCount,                      color: 'FFF59E0B' },
  ];

  const labelRow = ws.addRow(Array(TOTAL_COLS).fill(''));
  labelRow.height = 16;
  const valueRow = ws.addRow(Array(TOTAL_COLS).fill(''));
  valueRow.height = 30;

  summaryGroups.forEach(({ col, span, label, value, color }) => {
    if (span > 1) {
      ws.mergeCells(4, col, 4, col + span - 1);
      ws.mergeCells(5, col, 5, col + span - 1);
    }
    const lc = labelRow.getCell(col);
    lc.value = label;
    lc.style = {
      font: { bold: true, size: 8, color: { argb: color } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'bottom' },
      border: { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
    };
    const vc = valueRow.getCell(col);
    vc.value = value;
    vc.style = {
      font: { bold: true, size: 20, color: { argb: color }, name: 'Arial' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { bottom: { style: 'medium', color: { argb: color } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
    };
  });

  // Spacer
  ws.addRow([]).height = 8;

  // Header row
  const headers = ['#', 'Denumire echipament', 'Categorie', 'Producator', 'Model', 'Numar serie', 'Departament', 'Status', 'Data achizitiei', 'Expirare garantie', 'Urmatoarea mentenanta', 'CNCAN', 'Note', 'ID (nu modificati)'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell(cell => {
    cell.style = {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top:    { style: 'thin',   color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF2563EB' } },
        left:   { style: 'thin',   color: { argb: 'FF334155' } },
        right:  { style: 'thin',   color: { argb: 'FF334155' } },
      },
    };
  });

  // Data rows
  devices.forEach((device, idx) => {
    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const border = {
      top:    { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left:   { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right:  { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    };
    const row = ws.addRow([
      idx + 1,
      device.name || 'N/A',
      device.category || 'N/A',
      device.manufacturer || 'N/A',
      device.model || 'N/A',
      device.serialNumber || 'N/A',
      device.department || 'N/A',
      DEVICE_STATUS_RO[device.status] || device.status || 'N/A',
      device.purchaseDate || '—',
      device.warrantyExpiration || '—',
      device.nextMaintenanceDate || '—',
      device.isCNCAN ? 'DA' : 'NU',
      device.notes || '',
      device.id,
    ]);
    row.height = 20;

    row.eachCell((cell, col) => {
      const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: rowBg } };
      if (col === 1) {
        cell.style = { font: { size: 9, color: { argb: 'FF94A3B8' } }, fill, border, alignment: { horizontal: 'center', vertical: 'middle' } };
      } else if (col === 2) {
        cell.style = { font: { bold: true, size: 9, name: 'Arial' }, fill, border, alignment: { vertical: 'middle' } };
      } else if (col === 6) {
        cell.style = { font: { size: 8, name: 'Courier New', color: { argb: 'FF475569' } }, fill, border, alignment: { horizontal: 'center', vertical: 'middle' } };
      } else if (col === 8) {
        cell.style = { font: { bold: true, size: 8, color: { argb: statusColor(device.status) } }, fill, border, alignment: { horizontal: 'center', vertical: 'middle' } };
      } else if (col === 12) {
        cell.style = { font: { bold: true, size: 8, color: { argb: device.isCNCAN ? 'FFF59E0B' : 'FF94A3B8' } }, fill, border, alignment: { horizontal: 'center', vertical: 'middle' } };
      } else if (col >= 9 && col <= 11) {
        cell.style = { font: { size: 8, color: { argb: 'FF64748B' } }, fill, border, alignment: { horizontal: 'center', vertical: 'middle' } };
      } else if (col === 14) {
        cell.style = { font: { size: 7, name: 'Courier New', color: { argb: 'FFCBD5E1' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } }, border, alignment: { horizontal: 'center', vertical: 'middle' } };
      } else {
        cell.style = { font: { size: 9 }, fill, border, alignment: { vertical: 'middle' } };
      }
    });
  });

  // Freeze rows 1-7 (title + subtitle + spacer + 2 summary rows + spacer + header)
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 7, activeCell: 'A8' }];
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: TOTAL_COLS } };

  // ── SHEET 2: Summary ─────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Summary');
  wsSummary.columns = [{ width: 32 }, { width: 20 }];

  const addSectionTitle = (text: string) => {
    const r = wsSummary.addRow([text, '']);
    wsSummary.mergeCells(r.number, 1, r.number, 2);
    r.height = 26;
    r.getCell(1).style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    };
  };

  const addSummaryRow = (label: string, value: string | number, highlight = false) => {
    const r = wsSummary.addRow([label, value]);
    r.height = 20;
    const bg = highlight ? 'FFEFF6FF' : 'FFFFFFFF';
    const textColor = highlight ? 'FF2563EB' : 'FF64748B';
    r.getCell(1).style = {
      font: { size: 10, color: { argb: highlight ? 'FF1E293B' : 'FF64748B' }, bold: highlight },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
      border: { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
    };
    r.getCell(2).style = {
      font: { size: 10, bold: true, color: { argb: textColor } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
      alignment: { horizontal: 'right', vertical: 'middle', indent: 1 },
      border: { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
    };
  };

  addSectionTitle('BIOMEDIC — SUMAR RAPORT');
  wsSummary.addRow([]);
  addSummaryRow('Generat', new Date().toLocaleString());
  addSummaryRow('Total dispozitive', devices.length, true);
  addSummaryRow('Dispozitive CNCAN', cncanCount, true);
  wsSummary.addRow([]);

  addSectionTitle('REPARTITIE PE STATUS');
  Object.entries(statusCounts).forEach(([s, c]) => addSummaryRow(DEVICE_STATUS_RO[s as DeviceStatus] || s, c));
  wsSummary.addRow([]);

  addSectionTitle('REPARTITIE PE DEPARTAMENTE');
  const deptCounts: Record<string, number> = {};
  devices.forEach(d => { const k = d.department || 'Necunoscut'; deptCounts[k] = (deptCounts[k] || 0) + 1; });
  Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).forEach(([dept, c]) => addSummaryRow(dept, c));
  wsSummary.addRow([]);

  addSectionTitle('REPARTITIE PE CATEGORII');
  const catCounts: Record<string, number> = {};
  devices.forEach(d => { const k = d.category || 'Other'; catCounts[k] = (catCounts[k] || 0) + 1; });
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, c]) => addSummaryRow(cat, c));

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Biomedic_Raport_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

type ImportResult = { added: number; updated: number; skipped: number; errors: string[] };

const importFromExcel = (
  file: File,
  existingDevices: MedicalDevice[],
  onDone: (devices: MedicalDevice[], result: ImportResult) => void
) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const XLSX = await import('xlsx');
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });

      // Find "Device Inventory" sheet, fall back to first sheet
      const sheetName = wb.SheetNames.includes('Device Inventory') ? 'Device Inventory' : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Find the header row: look for a row containing "Device Name" (legacy) or "Denumire echipament"
      const headerRowIdx = rows.findIndex(r => r.some((c: any) => ['Device Name', 'Denumire echipament'].includes(String(c).trim())));
      if (headerRowIdx === -1) {
        onDone([], { added: 0, updated: 0, skipped: 0, errors: ['Nu am gasit randul de antet. Asigurati-va ca importati un export Excel Biomedic.'] });
        return;
      }

      const headers: string[] = rows[headerRowIdx].map((c: any) => String(c).trim());
      // Matches both legacy English headers and current Romanian headers
      const col = (...names: string[]) => headers.findIndex(h => names.includes(h));

      const idCol        = col('ID (do not edit)', 'ID (nu modificati)');
      const nameCol      = col('Device Name', 'Denumire echipament');
      const catCol       = col('Category', 'Categorie');
      const mfrCol       = col('Manufacturer', 'Producator');
      const modelCol     = col('Model');
      const snCol        = col('Serial No.', 'Numar serie');
      const deptCol      = col('Department', 'Departament');
      const statusCol    = col('Status');
      const purchaseCol  = col('Purchase Date', 'Data achizitiei');
      const warrantyCol  = col('Warranty Exp.', 'Expirare garantie');
      const nextPMCol    = col('Next PM', 'Urmatoarea mentenanta');
      const cncanCol     = col('CNCAN');
      const notesCol     = col('Notes', 'Note');

      if (nameCol === -1) {
        onDone([], { added: 0, updated: 0, skipped: 0, errors: ['Coloana "Denumire echipament" nu a fost gasita in fisier.'] });
        return;
      }

      const existingMap = new Map(existingDevices.map(d => [d.id, d]));
      const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };
      const upserted: MedicalDevice[] = [];

      const dataRows = rows.slice(headerRowIdx + 1);
      for (const row of dataRows) {
        const name = String(row[nameCol] ?? '').trim();
        if (!name || name === 'N/A') { result.skipped++; continue; }

        const rawId    = idCol !== -1 ? String(row[idCol] ?? '').trim() : '';
        const statusRaw = String(row[statusCol] ?? 'Active').trim();
        // Accept both stored enum values and Romanian display labels
        const statusFromRo = (Object.keys(DEVICE_STATUS_RO) as DeviceStatus[]).find(k => DEVICE_STATUS_RO[k].toLowerCase() === statusRaw.toLowerCase());
        const status   = (statusFromRo ?? statusRaw) as DeviceStatus;
        const category = String(row[catCol]     ?? 'Altele').trim();
        const purchase = String(row[purchaseCol] ?? '').trim();

        const existing = rawId ? existingMap.get(rawId) : undefined;

        const device: MedicalDevice = {
          ...(existing ?? {
            id: rawId || `DEV-IMP-${crypto.randomUUID()}`,
            maintenanceHistory: [],
            contracts: [],
            files: [],
            components: [],
          }),
          name,
          category,
          manufacturer:        String(row[mfrCol]      ?? '').trim() || existing?.manufacturer || '',
          model:               String(row[modelCol]    ?? '').trim() || existing?.model || '',
          serialNumber:        String(row[snCol]       ?? '').trim() || existing?.serialNumber || '',
          department:          String(row[deptCol]     ?? 'Nealocat').trim(),
          status:              Object.values(DeviceStatus).includes(status) ? status : DeviceStatus.ACTIVE,
          purchaseDate:        purchase || existing?.purchaseDate || new Date().toISOString().split('T')[0],
          warrantyExpiration:  String(row[warrantyCol] ?? '').trim().replace('—', '') || existing?.warrantyExpiration,
          nextMaintenanceDate: String(row[nextPMCol]   ?? '').trim().replace('—', '') || (purchase ? calculateNextMaintenanceDate(purchase, category) : existing?.nextMaintenanceDate),
          isCNCAN:             cncanCol !== -1 ? ['YES', 'DA'].includes(String(row[cncanCol]).trim().toUpperCase()) : (existing?.isCNCAN ?? false),
          notes:               notesCol !== -1 ? String(row[notesCol] ?? '').trim() : (existing?.notes ?? ''),
          updated_at:          new Date().toISOString(),
        } as MedicalDevice;

        upserted.push(device);
        if (existing) result.updated++; else result.added++;
      }

      onDone(upserted, result);
    } catch (err: any) {
      onDone([], { added: 0, updated: 0, skipped: 0, errors: [`Eroare la citirea fisierului: ${err.message}`] });
    }
  };
  reader.readAsArrayBuffer(file);
};

const exportToPDF = (devices: MedicalDevice[]) => {
  const date = new Date().toLocaleString();
  const statusCounts: Record<string, number> = {};
  devices.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });

  const statusBadgeColor = (status: string) => {
    if (status === 'Active') return '#059669';
    if (status === 'In Maintenance') return '#d97706';
    if (status === 'Broken') return '#dc2626';
    return '#64748b';
  };

  const rows = devices.map((d, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${i + 1}</td>
      <td><strong>${d.name || 'N/A'}</strong>${d.isCNCAN ? ' <span class="cncan">CNCAN</span>' : ''}</td>
      <td>${d.category || 'N/A'}</td>
      <td>${d.manufacturer || 'N/A'}</td>
      <td>${d.model || 'N/A'}</td>
      <td class="mono">${d.serialNumber || 'N/A'}</td>
      <td>${d.department || 'N/A'}</td>
      <td><span class="badge" style="background:${statusBadgeColor(d.status)}20;color:${statusBadgeColor(d.status)};border:1px solid ${statusBadgeColor(d.status)}40">${DEVICE_STATUS_RO[d.status] || d.status}</span></td>
      <td>${d.purchaseDate || 'N/A'}</td>
      <td>${d.nextMaintenanceDate || '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Biomedic - Raport Dispozitive</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1e293b; }
    .header-left h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
    .header-left p { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
    .header-right { text-align: right; font-size: 10px; color: #64748b; }
    .header-right strong { display: block; font-size: 13px; color: #1e293b; margin-bottom: 2px; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat { flex: 1; padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .stat .val { font-size: 20px; font-weight: 900; color: #1e293b; font-family: monospace; }
    .stat .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #1e293b; color: #fff; }
    thead th { padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; white-space: nowrap; }
    tbody tr.even { background: #f8fafc; }
    tbody tr.odd { background: #fff; }
    tbody tr:hover { background: #eff6ff; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .mono { font-family: monospace; font-size: 9px; }
    .badge { padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
    .cncan { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; padding: 1px 5px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase; margin-left: 4px; }
    .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Biomedic &mdash; Raport Inventar Dispozitive</h1>
      <p>Sistem de management echipamente medicale &bull; Inginerie biomedicala</p>
    </div>
    <div class="header-right">
      <strong>${devices.length} Dispozitive</strong>
      Generat: ${date}
    </div>
  </div>

  <div class="summary">
    <div class="stat"><div class="val">${devices.length}</div><div class="lbl">Total dispozitive</div></div>
    ${Object.entries(statusCounts).map(([s, c]) => `<div class="stat"><div class="val" style="color:${statusBadgeColor(s)}">${c}</div><div class="lbl">${DEVICE_STATUS_RO[s as DeviceStatus] || s}</div></div>`).join('')}
    <div class="stat"><div class="val">${devices.filter(d => d.isCNCAN).length}</div><div class="lbl">Dispozitive CNCAN</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Denumire echipament</th>
        <th>Categorie</th>
        <th>Producator</th>
        <th>Model</th>
        <th>Numar serie</th>
        <th>Departament</th>
        <th>Status</th>
        <th>Data achizitiei</th>
        <th>Urmatoarea mentenanta</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>Biomedic &mdash; Registru Echipamente &mdash; Confidential</span>
    <span>Pagina <span class="pageNumber"></span></span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};

interface DeviceListProps {
  devices: MedicalDevice[];
  onSelectDevice: (device: MedicalDevice) => void;
  onUpdateDevice: (device: MedicalDevice) => void;
  onBulkUpdate: (devices: MedicalDevice[]) => void;
  onAddDevice: () => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
  canDelete?: boolean;
}

const StatusBadge = React.memo(({ status }: { status: DeviceStatus }) => {
  let styles = "bg-slate-100 text-slate-700 border-slate-200";
  let dot = "bg-slate-400";
  switch(status) {
    case DeviceStatus.ACTIVE: 
      styles = "bg-emerald-50 text-emerald-700 border-emerald-100"; 
      dot = "bg-emerald-500";
      break;
    case DeviceStatus.MAINTENANCE: 
      styles = "bg-amber-50 text-amber-700 border-amber-100"; 
      dot = "bg-amber-500";
      break;
    case DeviceStatus.BROKEN: 
      styles = "bg-red-50 text-red-700 border-red-100"; 
      dot = "bg-red-500";
      break;
    case DeviceStatus.RETIRED: 
      styles = "bg-slate-100 text-slate-500 border-slate-200"; 
      dot = "bg-slate-300";
      break;
  }
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide border flex items-center gap-1.5 w-fit whitespace-nowrap ${styles}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot} ${status === DeviceStatus.ACTIVE ? 'animate-pulse' : ''}`} />
      {DEVICE_STATUS_RO[status] || status}
    </span>
  );
});

/** Column track shared by the compact list's header and its rows so they line up. */
const LIST_GRID = 'md:grid md:grid-cols-[1.25rem_2.25rem_minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_6.5rem_5.5rem] md:items-center md:gap-3 lg:md:gap-4';

const DeviceRow = React.memo(({
  device,
  index,
  isSelected,
  onToggleSelection,
  onSelect,
  onQuickEdit,
  onDelete,
  canDelete
}: {
  device: MedicalDevice,
  index: number,
  isSelected: boolean,
  onToggleSelection: (id: string) => void,
  onSelect: (device: MedicalDevice) => void,
  onQuickEdit: (e: React.MouseEvent, device: MedicalDevice) => void,
  onDelete: (e: React.MouseEvent, id: string) => void,
  canDelete: boolean
}) => (
  <div className={`group flex flex-wrap md:flex-none items-start md:items-center gap-x-3 gap-y-2 px-3 sm:px-5 py-3 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'} ${LIST_GRID}`}>
    <input
      type="checkbox"
      className="w-5 h-5 mt-0.5 md:mt-0 shrink-0 rounded-md border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500"
      checked={isSelected}
      onChange={() => onToggleSelection(device.id)}
    />

    <span className="shrink-0 mt-0.5 md:mt-0 font-mono text-xs font-bold text-slate-500 tabular-nums md:text-center">
      {index}
    </span>

    {/* On phones the four data columns collapse into one stacked block */}
    <div className="flex-1 min-w-0 md:contents cursor-pointer" onClick={() => onSelect(device)}>
      <div className="min-w-0">
        {/* Two lines at most: a long name would otherwise stretch the row to
            three or four while every other column stays on one. */}
        <h3
          title={device.name}
          className="font-extrabold text-slate-900 text-[15px] md:text-[17px] leading-snug line-clamp-2 break-words group-hover:text-blue-600 transition-colors"
        >
          {device.name || 'Dispozitiv fara nume'}
          {device.isCNCAN && <ShieldAlert className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5 text-amber-500" />}
        </h3>
      </div>
      <span className="hidden md:block text-[15px] font-semibold text-slate-600 truncate" title={device.department}>{device.department || '—'}</span>
      <span className="hidden md:flex">
        <span className="px-2.5 py-1 bg-blue-50 rounded-lg text-[13px] font-bold text-blue-600 border border-blue-100 truncate max-w-full">{device.model || '—'}</span>
      </span>
      <span className="hidden md:block text-[15px] font-mono font-bold text-slate-900 truncate">{device.serialNumber || '—'}</span>
      <div className="hidden md:block"><StatusBadge status={device.status || DeviceStatus.ACTIVE} /></div>
    </div>

    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={(e) => onQuickEdit(e, device)}
        className="p-2.5 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 border-2 border-slate-200 rounded-xl transition active:scale-90"
        title="Editare rapida"
       aria-label="Editare rapida">
        <Edit2 className="w-4 h-4" />
      </button>
      {canDelete && (
        <button
          onClick={(e) => onDelete(e, device.id)}
          className="p-2.5 bg-white text-slate-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-2 border-slate-200 rounded-xl transition active:scale-90"
          title="Sterge dispozitiv"
         aria-label="Sterge dispozitiv">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* Status, sectie, model and serial on one line. As a basis-full sibling it
        wraps below the action buttons and gets the row's full width, rather
        than fighting for space inside the name column. */}
    <div
      className="md:hidden basis-full flex items-center gap-1.5 min-w-0 cursor-pointer"
      onClick={() => onSelect(device)}
    >
      <StatusBadge status={device.status || DeviceStatus.ACTIVE} />
      <span className="px-2 py-1 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 border border-slate-200 truncate">
        {device.department || 'N/A'}
      </span>
      <span className="px-2 py-1 shrink-0 bg-blue-50 rounded-lg text-[11px] font-bold text-blue-600 border border-blue-100 whitespace-nowrap">
        {device.model || 'N/A'}
      </span>
      <span className="shrink-0 text-[13px] font-mono font-bold text-slate-900 whitespace-nowrap">
        {device.serialNumber || 'N/A'}
      </span>
    </div>
  </div>
));

const DeviceCard = React.memo(({
  device, 
  index,
  isSelected, 
  onToggleSelection, 
  onSelect, 
  onQuickEdit, 
  onDelete,
  canDelete
}: { 
  device: MedicalDevice, 
  index: number,
  isSelected: boolean, 
  onToggleSelection: (id: string) => void, 
  onSelect: (device: MedicalDevice) => void, 
  onQuickEdit: (e: React.MouseEvent, device: MedicalDevice) => void, 
  onDelete: (e: React.MouseEvent, id: string) => void,
  canDelete: boolean
}) => {
  // `auto` in containIntrinsicSize lets the browser remember each card's real
  // height, so cards whose name wraps to two lines don't make the scrollbar
  // jump around as they mount.
  return (
    <div
      className={`hardware-card group relative flex flex-col md:flex-row items-center gap-6 p-6 transition-[transform,box-shadow,border-color,background-color] duration-200 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 border-l-4 ${isSelected ? 'border-l-blue-600 bg-blue-50/30' : 'border-l-transparent hover:border-l-blue-400'}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 160px' } as React.CSSProperties}
    >
      {/* Selection checkbox, with the device's position in the list under it.
          It used to float over the top-left corner, which was free only while
          an empty photo box pushed the name out of the way. Now it is a row of
          its own on a phone, and the column it always was from md up. */}
      <div className="w-full md:w-auto flex items-center gap-1 md:flex-col md:gap-1.5 shrink-0">
        {/* The box stays 20px — a bigger one would look like a button — but the
            label around it gives the thumb a 44px target. */}
        <label className="p-3 -m-1 cursor-pointer flex items-center" aria-label={`Selecteaza ${device.name}`}>
          <input
            type="checkbox"
            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500 transition-all"
            checked={isSelected}
            onChange={() => onToggleSelection(device.id)}
          />
        </label>
        <span className="font-mono text-xs font-bold text-slate-500 tabular-nums">{index}</span>
      </div>

      {/*
        The photo only takes room when there is a photo. Most devices have
        none, and an empty grey square with a cube in it was costing a hundred
        pixels a card on a phone — pure scrolling for nothing. The radiation
        marker still needs somewhere to live, so it keeps a small box.
      */}
      {device.image ? (
        <div
          className="w-24 h-24 md:w-20 md:h-20 rounded-2xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center relative shadow-sm group-hover:scale-105 transition-transform shrink-0 cursor-pointer"
          onClick={() => onSelect(device)}
        >
          <img src={device.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={device.name} />
          {device.isCNCAN && (
            <div className="absolute top-0 right-0 p-1.5 bg-amber-500 rounded-bl-xl shadow-sm">
              <ShieldAlert className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>
      ) : device.isCNCAN ? (
        <div
          className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
          onClick={() => onSelect(device)}
          title="Sursa de radiatii — evidenta CNCAN"
        >
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
      ) : null}

      {/* Asset Info */}
      <div className="flex-1 min-w-0 cursor-pointer space-y-2" onClick={() => onSelect(device)}>
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          {/* No truncation — a long device name wraps and stays fully readable */}
          <h3 className="font-extrabold text-slate-900 text-xl sm:text-2xl leading-tight break-words group-hover:text-blue-600 transition-colors md:min-w-0">
            {device.name || 'Dispozitiv fara nume'}
          </h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={device.status || DeviceStatus.ACTIVE} />
            <span className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 whitespace-nowrap">
              {device.department || 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Producator</span>
            <span className="text-[15px] font-bold text-slate-800">{device.manufacturer || 'Necunoscut'}</span>
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Model</span>
            <span className="text-[15px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">{device.model || 'N/A'}</span>
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Serie</span>
            <span className="text-[15px] font-mono font-bold text-slate-900">{device.serialNumber || 'N/A'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Layers className="w-3.5 h-3.5" /> {device.category || 'Altele'}
          </span>
          {(device.tags || []).slice(0, 4).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-full border border-blue-100">
              <Tag className="w-3 h-3" /> {tag}
            </span>
          ))}
          <span className="text-[11px] font-medium text-slate-500">ID: {device.id.slice(0, 12)}…</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center z-[100]">
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm border-2 border-slate-200 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onQuickEdit(e, device)}
          title="Editare rapida"
        >
          <Edit2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Editeaza</span>
        </button>
        {canDelete && (
          <button 
            className="flex-1 md:flex-none p-3.5 bg-white text-slate-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200 shadow-sm border-2 border-slate-200 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
            onClick={(e) => onDelete(e, device.id)}
            title="Sterge dispozitiv"
          >
            <Trash2 className="w-4 h-4" />
            <span className="md:hidden tech-label text-[10px]">Sterge</span>
          </button>
        )}
      </div>
    </div>
  );
});

/** One shape for all four desk tools, so none of them shouts louder than the list. */
const ToolButton: React.FC<{
  onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; hint: string;
}> = ({ onClick, disabled, icon, label, hint }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={hint}
    aria-label={hint}
    className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest hover:border-slate-400 hover:bg-slate-50 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {icon}
    {label}
  </button>
);

const DeviceList = React.memo<DeviceListProps>(({ devices, onSelectDevice, onUpdateDevice, onBulkUpdate, onAddDevice, onDelete, searchQuery: externalSearch = '', canDelete = true }) => {
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'ALL'>(listState.status);
  const [filterDept, setFilterDept] = useState<string | 'ALL'>(listState.dept);
  const [filterCategory, setFilterCategory] = useState<string | 'ALL'>(listState.category);
  const [filterTag, setFilterTag] = useState<string | 'ALL'>(listState.tag);
  const [filterMetrologie, setFilterMetrologie] = useState<FiltruMetrologie>(listState.metrologie);
  const [localSearch, setLocalSearch] = useState(listState.search);
  const [showQRSheet, setShowQRSheet] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  // Paged rendering: the user picks how many devices a page holds, which also
  // keeps the DOM small instead of mounting the whole fleet at once.
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = Number(localStorage.getItem('meditrack_page_size'));
    return PAGE_SIZES.includes(stored) ? stored : 20;
  });
  const [page, setPage] = useState(listState.page);
  const listTopRef = useRef<HTMLDivElement>(null);

  // Compact rows drop the photo and the tag/category chips, so far more
  // devices fit on screen at once.
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(
    () => (localStorage.getItem('meditrack_view_mode') === 'list' ? 'list' : 'cards')
  );
  // The four dropdowns take most of a phone screen, so they collapse behind a
  // toggle — opened automatically when a filter is already applied.
  const activeFilterCount =
    (filterDept !== 'ALL' ? 1 : 0) + (filterCategory !== 'ALL' ? 1 : 0) +
    (filterStatus !== 'ALL' ? 1 : 0) + (filterTag !== 'ALL' ? 1 : 0) +
    (filterMetrologie !== 'ALL' ? 1 : 0);
  const [showFilters, setShowFilters] = useState(() => activeFilterCount > 0);

  // A placeholder can't be shortened with CSS, so track the breakpoint itself
  // — otherwise rotating the phone leaves the long desktop text in place.
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const changeViewMode = useCallback((mode: 'cards' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('meditrack_view_mode', mode);
  }, []);

  const changePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
    localStorage.setItem('meditrack_page_size', String(size));
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDevice, setEditingDevice] = useState<MedicalDevice | null>(null);
  // Escape inchide editarea rapida si foaia de etichete
  useEscape(() => { setEditingDevice(null); setShowQRSheet(false); }, !!editingDevice || showQRSheet);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [quickEditForm, setQuickEditForm] = useState({
    name: '',
    serialNumber: '',
    department: '',
    status: DeviceStatus.ACTIVE,
  });

  // Dynamic department list from existing fleet + static list
  const allAvailableDepartments = useMemo(() => {
    const existingDepts = (devices || []).map(d => d.department).filter(Boolean);
    const combined = Array.from(new Set([...HOSPITAL_DEPARTMENTS, ...existingDepts])).sort();
    return combined;
  }, [devices]);

  const [debouncedSearch, setDebouncedSearch] = useState(listState.search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 200);
    return () => clearTimeout(t);
  }, [localSearch]);

  const effectiveSearch = (debouncedSearch || externalSearch).toLowerCase().trim();

  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    return devices.filter(d => {
      const name = (d.name || '').toLowerCase();
      const sn = (d.serialNumber || '').toLowerCase();
      const mfr = (d.manufacturer || '').toLowerCase();
      const model = (d.model || '').toLowerCase();
      const dept = (d.department || '').toLowerCase();
      const cat = (d.category || '').toLowerCase();

      const matchSearch = !effectiveSearch || 
        name.includes(effectiveSearch) || 
        sn.includes(effectiveSearch) ||
        mfr.includes(effectiveSearch) ||
        model.includes(effectiveSearch) ||
        dept.includes(effectiveSearch) ||
        cat.includes(effectiveSearch);
      
      const matchStatus = filterStatus === 'ALL' || d.status === filterStatus;
      const matchDept = filterDept === 'ALL' || d.department === filterDept;
      const matchCategory = filterCategory === 'ALL' || d.category === filterCategory;
      const matchTag = filterTag === 'ALL' || (d.tags || []).includes(filterTag);
      const matchMetrologie = treceFiltrulMetrologic(d, filterMetrologie);

      return matchSearch && matchStatus && matchDept && matchCategory && matchTag && matchMetrologie;
    });
  }, [devices, effectiveSearch, filterStatus, filterDept, filterCategory, filterTag, filterMetrologie]);

  const pageCount = Math.max(1, Math.ceil(filteredDevices.length / pageSize));

  // A narrowed filter can leave the current page past the end of the results
  useEffect(() => {
    setPage(p => Math.min(p, Math.max(1, Math.ceil(filteredDevices.length / pageSize))));
  }, [filteredDevices.length, pageSize]);

  // Back to page 1 whenever the visible set changes (filters/search) — but not
  // on the first render, which would throw away the page we just came back to.
  const filtersSettled = useRef(false);
  useEffect(() => {
    if (!filtersSettled.current) { filtersSettled.current = true; return; }
    setPage(1);
  }, [effectiveSearch, filterStatus, filterDept, filterCategory, filterTag]);

  useEffect(() => {
    listState.search = localSearch;
    listState.status = filterStatus;
    listState.dept = filterDept;
    listState.category = filterCategory;
    listState.tag = filterTag;
    listState.metrologie = filterMetrologie;
    listState.page = page;
  }, [localSearch, filterStatus, filterDept, filterCategory, filterTag, page]);

  const pageDevices = useMemo(
    () => filteredDevices.slice((page - 1) * pageSize, page * pageSize),
    [filteredDevices, page, pageSize]
  );

  // Jumping pages without this leaves you halfway down the previous page
  const goToPage = useCallback((next: number) => {
    setPage(next);
    listTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  // All tags used across the fleet, for the filter dropdown
  const deviceCountByDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    (devices || []).forEach(d => {
      const key = (d.department || '').trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [devices]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (devices || []).forEach(d => (d.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [devices]);

  const handleOpenQuickEdit = useCallback((e: React.MouseEvent, device: MedicalDevice) => {
    e.preventDefault();
    e.stopPropagation();
    
    setEditingDevice(device);
    setQuickEditForm({
      name: device.name || '',
      serialNumber: device.serialNumber || '',
      department: device.department || HOSPITAL_DEPARTMENTS[0],
      status: device.status || DeviceStatus.ACTIVE,
    });
  }, []);

  const handleQuickEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuickEditForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSaveQuickEdit = useCallback(async () => {
    if (!editingDevice) return;
    const updated: MedicalDevice = { ...editingDevice, ...quickEditForm };
    await onUpdateDevice(updated);
    setEditingDevice(null);
  }, [editingDevice, quickEditForm, onUpdateDevice]);

  // The bin sits a thumb's width from the card you tap to open a device, and
  // the delete is not reversible. Ask, the same way the detail page does.
  const handleDeleteClick = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingDelete(deviceId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (pendingDelete) onDelete(pendingDelete);
    setPendingDelete(null);
  }, [pendingDelete, onDelete]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFromExcel(file, devices, (upserted, result) => {
      if (upserted.length > 0) onBulkUpdate(upserted);
      setImportResult(result);
      if (importTimeoutRef.current) clearTimeout(importTimeoutRef.current);
      importTimeoutRef.current = setTimeout(() => setImportResult(null), 6000);
    });
    e.target.value = '';
  }, [devices, onBulkUpdate]);

  return (
    <div className="space-y-8 pb-24 relative animate-fade-in">
      {/* QUICK EDIT OVERLAY */}
      {editingDevice && (
        <Portal>
        <div className="fixed inset-0 z-[500] scrim flex items-center justify-center p-4">
          <div className="hardware-card p-5 sm:p-10 w-full max-w-xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl animate-slide-up modal-shell overflow-y-auto overscroll-contain custom-scrollbar">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Editare rapida</h3>
                   <p className="tech-label mt-1">ID: {editingDevice.id}</p>
                </div>
                <button onClick={() => setEditingDevice(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition text-slate-500"><X className="w-6 h-6" /></button>
             </div>
             
             <div className="space-y-6 mb-10">
                <div className="space-y-1">
                   <label className="tech-label ml-1">Denumire dispozitiv</label>
                   <input name="name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.name} onChange={handleQuickEditChange} />
                </div>
                <div className="space-y-1">
                   <label className="tech-label ml-1">Numar serie</label>
                   <input name="serialNumber" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.serialNumber} onChange={handleQuickEditChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DepartmentPicker
                    value={quickEditForm.department}
                    onChange={(v) => setQuickEditForm(prev => ({ ...prev, department: v }))}
                    options={allAvailableDepartments}
                    counts={deviceCountByDepartment}
                    label="Departament"
                  />
                  <div className="space-y-1">
                    <label className="tech-label ml-1">Status</label>
                    <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.status} onChange={handleQuickEditChange}>
                        {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{DEVICE_STATUS_RO[s].toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
             </div>

             <div className="flex gap-4">
                <button onClick={() => setEditingDevice(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition">Anuleaza</button>
                <button onClick={handleSaveQuickEdit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-3">
                   <Save className="w-5 h-5" /> Salveaza
                </button>
             </div>
          </div>
        </div>
        </Portal>
      )}

      {/* FILTER CONTROLS */}
      <div className="hardware-card p-3 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col gap-3 sm:gap-6">
        <div className="flex items-center gap-2 sm:gap-4 w-full">
          <div className="relative flex-1 min-w-0 group">
            <Search className={`absolute left-3.5 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 transition-colors ${effectiveSearch ? 'text-blue-600' : 'text-slate-500'}`} />
            <input 
              type="text"
              placeholder={isNarrow ? 'Cauta dispozitiv...' : 'Cauta dupa nume, categorie, serie sau departament...'}
              className="w-full pl-10 sm:pl-14 pr-3 sm:pr-6 py-3 sm:py-4 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl text-sm font-bold focus:outline-none transition-all shadow-inner"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`sm:hidden relative shrink-0 p-3 rounded-xl border-2 transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            title="Filtre"
           aria-label="Filtre">
            <SlidersHorizontal className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 bg-slate-900 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setLocalSearch(''); setFilterStatus('ALL'); setFilterDept('ALL'); setFilterCategory('ALL'); setFilterTag('ALL'); }}
            className="shrink-0 p-3 sm:px-4 sm:py-4 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-xl sm:rounded-2xl hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center justify-center"
            title="Reseteaza filtrele"
           aria-label="Reseteaza filtrele">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} sm:grid grid-cols-2 gap-2 sm:gap-4 w-full ${allTags.length > 0 ? 'xl:grid-cols-5' : 'sm:grid-cols-4'}`}>
          <FilterSelect label="Departament" value={filterDept} onChange={setFilterDept} options={allAvailableDepartments} />
          <FilterSelect label="Categorie" value={filterCategory} onChange={setFilterCategory} options={DEVICE_CATEGORIES as readonly string[]} />
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as any)}
            options={Object.values(DeviceStatus)}
            labelFor={(s) => DEVICE_STATUS_RO[s as DeviceStatus] || s}
          />
          {/* "Care aparate au buletinul expirat" — intrebarea de la control. */}
          <div className="space-y-1 min-w-0">
            <label className="tech-label ml-1">Metrologie</label>
            <select
              aria-label="Filtru metrologie"
              className="w-full px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wide shadow-inner"
              value={filterMetrologie}
              onChange={e => setFilterMetrologie(e.target.value as FiltruMetrologie)}
            >
              {FILTRE_METROLOGIE.map(f => <option key={f.id} value={f.id}>{f.text.toUpperCase()}</option>)}
            </select>
          </div>
          {allTags.length > 0 && (
            <FilterSelect label="Eticheta" value={filterTag} onChange={setFilterTag} options={allTags} />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div ref={listTopRef} className="scroll-mt-4" />
        <div className="flex items-center justify-between px-2 sm:px-8 py-2 flex-wrap gap-3">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="bg-slate-900 px-3 py-1 rounded-lg text-white font-mono text-xs font-black">
              {filteredDevices.length}
            </div>
            <span className="tech-label">Dispozitive gasite</span>
            <PageSizePicker value={pageSize} onChange={changePageSize} />
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 border-2 border-slate-200 rounded-2xl">
              <button
                onClick={() => changeViewMode('cards')}
                className={`p-3 rounded-xl transition active:scale-95 ${viewMode === 'cards' ? 'bg-white text-blue-600 border border-slate-200 shadow-sm' : 'text-slate-500 border border-transparent hover:text-slate-700'}`}
                title="Vizualizare carduri"
               aria-label="Vizualizare carduri">
                <LayoutGrid className="w-6 h-6" />
              </button>
              <button
                onClick={() => changeViewMode('list')}
                className={`p-3 rounded-xl transition active:scale-95 ${viewMode === 'list' ? 'bg-white text-blue-600 border border-slate-200 shadow-sm' : 'text-slate-500 border border-transparent hover:text-slate-700'}`}
                title="Vizualizare lista compacta"
               aria-label="Vizualizare lista compacta">
                <Rows3 className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <span className="tech-label text-blue-600 font-black">{selectedIds.size} selectate</span>
                <button className="px-4 py-2.5 bg-red-50 text-red-700 rounded-xl tech-label hover:bg-red-100 transition-colors border border-red-100">Sterge selectia</button>
              </>
            )}

            {/*
              Export, import and label printing are desk work. On a phone they
              were four saturated buttons standing between the search box and
              the first device — and a red "PDF" next to a list where red also
              means delete. They fold away here and stay inline from sm up.
            */}
            <button
              onClick={() => setShowTools(t => !t)}
              aria-expanded={showTools}
              className="sm:hidden flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest transition active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              Export / Import
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${showTools ? 'rotate-180' : ''}`} />
            </button>

            <div className={`${showTools ? 'grid grid-cols-2' : 'hidden'} w-full gap-2 sm:flex sm:w-auto sm:gap-3`}>
              <ToolButton
                onClick={() => exportToExcel(filteredDevices)}
                disabled={filteredDevices.length === 0}
                icon={<FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />}
                label="Excel"
                hint="Exporta lista filtrata in Excel"
              />
              <ToolButton
                onClick={() => exportToPDF(filteredDevices)}
                disabled={filteredDevices.length === 0}
                icon={<FileText className="w-4 h-4 shrink-0 text-red-600" />}
                label="PDF"
                hint="Exporta lista filtrata in PDF"
              />
              <ToolButton
                onClick={() => exportMetrologie(filteredDevices)}
                disabled={filteredDevices.every(d => !d.metrologyRequired)}
                icon={<ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />}
                label="Metrologie"
                hint="Lista de verificari metrologice, pentru control"
              />
              <ToolButton
                onClick={() => importInputRef.current?.click()}
                icon={<Upload className="w-4 h-4 shrink-0 text-blue-600" />}
                label="Import"
                hint="Importa dispozitive dintr-un export Excel Biomedic"
              />
              <ToolButton
                onClick={() => setShowQRSheet(true)}
                disabled={filteredDevices.length === 0}
                icon={<QrCode className="w-4 h-4 shrink-0 text-slate-700" />}
                label="Etichete QR"
                hint="Genereaza etichete QR printabile pentru dispozitivele filtrate"
              />
            </div>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        {importResult && (
          <div className={`mx-2 p-4 rounded-2xl border flex items-start gap-3 animate-fade-in ${importResult.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            {importResult.errors.length > 0
              ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              : <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            }
            <div className="flex-1">
              {importResult.errors.length > 0
                ? <p className="text-xs font-bold text-red-700">{importResult.errors[0]}</p>
                : <p className="text-xs font-bold text-emerald-700">
                    Import finalizat — <span className="text-emerald-600">{importResult.added} adaugate</span>, <span className="text-blue-600">{importResult.updated} actualizate</span>{importResult.skipped > 0 ? `, ${importResult.skipped} sarite` : ''}
                  </p>
              }
            </div>
            <button onClick={() => setImportResult(null)} className="text-slate-500 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {viewMode === 'cards' && pageDevices.map((device, i) => (
            <DeviceCard
              key={device.id}
              device={device}
              index={(page - 1) * pageSize + i + 1}
              isSelected={selectedIds.has(device.id)}
              onToggleSelection={toggleSelection}
              onSelect={onSelectDevice}
              onQuickEdit={handleOpenQuickEdit}
              onDelete={handleDeleteClick}
              canDelete={canDelete}
            />
          ))}

          {viewMode === 'list' && pageDevices.length > 0 && (
            <div className="hardware-card rounded-2xl sm:rounded-3xl overflow-hidden">
              <div className={`hidden px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-500 ${LIST_GRID}`}>
                <span />
                <span className="text-center">Nr.</span>
                <span className="truncate">Denumire</span>
                <span className="truncate">Departament</span>
                <span className="truncate">Model</span>
                <span className="truncate">Serie</span>
                <span className="truncate">Status</span>
                <span className="truncate">Actiuni</span>
              </div>
              <div className="divide-y divide-slate-100">
                {pageDevices.map((device, i) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    index={(page - 1) * pageSize + i + 1}
                    isSelected={selectedIds.has(device.id)}
                    onToggleSelection={toggleSelection}
                    onSelect={onSelectDevice}
                    onQuickEdit={handleOpenQuickEdit}
                    onDelete={handleDeleteClick}
                    canDelete={canDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredDevices.length > 0 && (
            <Pager
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filteredDevices.length}
              onGoTo={goToPage}
            />
          )}

          {filteredDevices.length === 0 && (
            <div className="hardware-card py-32 text-center rounded-[2.5rem]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <Box className="w-10 h-10 text-slate-200" />
              </div>
              <p className="tech-label mb-8 text-slate-500">Niciun dispozitiv gasit in registru</p>
              <button
                onClick={onAddDevice}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition flex items-center gap-3 mx-auto active:scale-95"
              >
                <Plus className="w-5 h-5" /> Inregistreaza Dispozitiv
              </button>
            </div>
          )}
        </div>
      </div>

      {showQRSheet && (
        <React.Suspense fallback={null}>
          <QRLabelSheet devices={filteredDevices} onClose={() => setShowQRSheet(false)} />
        </React.Suspense>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Confirmare stergere"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          Se sterge definitiv{' '}
          <span className="font-black text-slate-900">
            {devices.find(d => d.id === pendingDelete)?.name || 'acest dispozitiv'}
          </span>{' '}
          si tot istoricul de service asociat.
        </>}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
});

export default DeviceList;
