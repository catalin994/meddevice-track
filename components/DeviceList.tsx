
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { MedicalDevice, DeviceStatus, DEVICE_STATUS_RO, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, calculateNextMaintenanceDate } from '../types';
import { Search, Trash2, Box, FileSpreadsheet, Edit2, X, ShieldAlert, RotateCcw, Layers, FileText, Save, Building2, Plus, Upload, CheckCircle, AlertTriangle, QrCode, Tag, ChevronLeft, ChevronRight, LayoutGrid, Rows3, SlidersHorizontal } from 'lucide-react';

import Portal from './Portal';
const QRLabelSheet = React.lazy(() => import('./QRLabelSheet'));

const PAGE_SIZES = [10, 20, 50, 100];

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
      className="w-full px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wide shadow-inner"
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
  page: 1,
};

const exportToExcel = async (devices: MedicalDevice[]) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MediTrack';
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
  const titleRow = ws.addRow(['MEDITRACK — RAPORT INVENTAR DISPOZITIVE', ...Array(TOTAL_COLS - 1).fill('')]);
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

  addSectionTitle('MEDITRACK — SUMAR RAPORT');
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
  a.download = `MediTrack_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
        onDone([], { added: 0, updated: 0, skipped: 0, errors: ['Nu am gasit randul de antet. Asigurati-va ca importati un export Excel MediTrack.'] });
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
  <title>MediTrack - Raport Dispozitive</title>
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
      <h1>MediTrack &mdash; Raport Inventar Dispozitive</h1>
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
    <span>MediTrack &mdash; Registru Echipamente &mdash; Confidential</span>
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
    <span className={`px-3 py-1.5 rounded-xl tech-label text-[8px] border flex items-center gap-2 w-fit ${styles}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot} ${status === DeviceStatus.ACTIVE ? 'animate-pulse' : ''}`} />
      {DEVICE_STATUS_RO[status] || status}
    </span>
  );
});

/** Column track shared by the compact list's header and its rows so they line up. */
const LIST_GRID = 'md:grid md:grid-cols-[1.25rem_2.5rem_minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_5.5rem] md:items-center md:gap-4';

const DeviceRow = React.memo(({
  device,
  index,
  isSelected,
  onToggleSelection,
  onSelect,
  onQuickEdit,
  onDelete
}: {
  device: MedicalDevice,
  index: number,
  isSelected: boolean,
  onToggleSelection: (id: string) => void,
  onSelect: (device: MedicalDevice) => void,
  onQuickEdit: (e: React.MouseEvent, device: MedicalDevice) => void,
  onDelete: (e: React.MouseEvent, id: string) => void
}) => (
  <div className={`group flex md:flex-none items-start md:items-center gap-3 px-3 sm:px-5 py-3 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'} ${LIST_GRID}`}>
    <input
      type="checkbox"
      className="w-5 h-5 mt-0.5 md:mt-0 shrink-0 rounded-md border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500"
      checked={isSelected}
      onChange={() => onToggleSelection(device.id)}
    />

    <span className="shrink-0 mt-0.5 md:mt-0 font-mono text-[11px] font-black text-slate-400 tabular-nums md:text-center">
      {index}
    </span>

    {/* On phones the four data columns collapse into one stacked block */}
    <div className="flex-1 min-w-0 md:contents cursor-pointer" onClick={() => onSelect(device)}>
      <div className="min-w-0">
        <h3 className="font-black text-slate-900 text-sm leading-snug break-words uppercase tracking-tight group-hover:text-blue-600 transition-colors">
          {device.name || 'Dispozitiv fara nume'}
          {device.isCNCAN && <ShieldAlert className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5 text-amber-500" />}
        </h3>
        {/* Phones get status and the rest of the data stacked here, so the name
            keeps the full width of the row instead of a narrow column */}
        <div className="md:hidden mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge status={device.status || DeviceStatus.ACTIVE} />
          <span className="text-[10px] font-mono font-bold text-slate-400 break-words">
            {[device.department, device.model, device.serialNumber].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
      <span className="hidden md:block text-xs font-bold text-slate-500 truncate">{device.department || '—'}</span>
      <span className="hidden md:block text-xs font-black text-blue-600 truncate">{device.model || '—'}</span>
      <span className="hidden md:block text-xs font-mono font-black text-slate-900 truncate">{device.serialNumber || '—'}</span>
      <div className="hidden md:block"><StatusBadge status={device.status || DeviceStatus.ACTIVE} /></div>
    </div>

    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={(e) => onQuickEdit(e, device)}
        className="p-2.5 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition active:scale-90"
        title="Editare rapida"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => onDelete(e, device.id)}
        className="p-2.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-xl transition active:scale-90"
        title="Sterge dispozitiv"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>
));

/** Page numbers to show: always first and last, plus a window around the current one. */
const pageWindow = (page: number, pageCount: number): (number | '…')[] => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter(n => n > 1 && n < pageCount);
  const out: (number | '…')[] = [1];
  if (around[0] > 2) out.push('…');
  out.push(...around);
  if (around[around.length - 1] < pageCount - 1) out.push('…');
  out.push(pageCount);
  return out;
};

const Pager = React.memo(({ page, pageCount, pageSize, total, onGoTo }: {
  page: number; pageCount: number; pageSize: number; total: number; onGoTo: (p: number) => void;
}) => {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="hardware-card rounded-3xl px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="tech-label text-center sm:text-left">
        {from}–{to} din {total}{pageCount > 1 ? ` · pagina ${page} / ${pageCount}` : ''}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => onGoTo(page - 1)}
            disabled={page === 1}
            className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-white hover:bg-slate-900 hover:border-slate-900 transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
            title="Pagina anterioara"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageWindow(page, pageCount).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-300 font-black">…</span>
            ) : (
              <button
                key={n}
                onClick={() => onGoTo(n)}
                className={`min-w-[2.5rem] px-2 py-2.5 rounded-xl text-[11px] font-black transition active:scale-90 ${
                  n === page
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {n}
              </button>
            )
          )}
          <button
            onClick={() => onGoTo(page + 1)}
            disabled={page === pageCount}
            className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-white hover:bg-slate-900 hover:border-slate-900 transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
            title="Pagina urmatoare"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

const DeviceCard = React.memo(({
  device, 
  index,
  isSelected, 
  onToggleSelection, 
  onSelect, 
  onQuickEdit, 
  onDelete 
}: { 
  device: MedicalDevice, 
  index: number,
  isSelected: boolean, 
  onToggleSelection: (id: string) => void, 
  onSelect: (device: MedicalDevice) => void, 
  onQuickEdit: (e: React.MouseEvent, device: MedicalDevice) => void, 
  onDelete: (e: React.MouseEvent, id: string) => void 
}) => {
  // `auto` in containIntrinsicSize lets the browser remember each card's real
  // height, so cards whose name wraps to two lines don't make the scrollbar
  // jump around as they mount.
  return (
    <div
      className={`hardware-card group relative flex flex-col md:flex-row items-center gap-6 p-6 transition-[transform,box-shadow,border-color,background-color] duration-200 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 border-l-4 ${isSelected ? 'border-l-blue-600 bg-blue-50/30' : 'border-l-transparent hover:border-l-blue-400'}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 160px' } as React.CSSProperties}
    >
      {/* Selection checkbox, with the device's position in the list under it */}
      <div className="absolute top-6 left-6 md:static flex items-center gap-2 md:flex-col md:gap-1.5">
        <input 
          type="checkbox" 
          className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500 transition-all" 
          checked={isSelected} 
          onChange={() => onToggleSelection(device.id)} 
        />
        <span className="font-mono text-[11px] font-black text-slate-400 tabular-nums">{index}</span>
      </div>

      {/* Asset Image/Icon */}
      <div 
        className="w-24 h-24 md:w-20 md:h-20 rounded-2xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center relative shadow-sm group-hover:scale-105 transition-transform shrink-0 cursor-pointer"
        onClick={() => onSelect(device)}
      >
        {device.image ? (
          <img src={device.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <Box className="w-10 h-10 text-slate-200" />
        )}
        {device.isCNCAN && (
          <div className="absolute top-0 right-0 p-1.5 bg-amber-500 rounded-bl-xl shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Asset Info */}
      <div className="flex-1 min-w-0 cursor-pointer space-y-2" onClick={() => onSelect(device)}>
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          {/* No truncation — a long device name wraps and stays fully readable */}
          <h3 className="font-black text-slate-900 text-lg sm:text-xl md:text-lg leading-tight break-words group-hover:text-blue-600 transition-colors uppercase tracking-tight md:min-w-0">
            {device.name || 'Dispozitiv fara nume'}
          </h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={device.status || DeviceStatus.ACTIVE} />
            <span className="px-3 py-1 bg-slate-100 rounded-lg tech-label text-[9px] text-slate-600 border border-slate-200">
              {device.department || 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="tech-label text-[10px] text-slate-500 uppercase tracking-wider font-bold">MFR:</span>
            <span className="text-xs font-black text-slate-700">{device.manufacturer || 'Necunoscut'}</span>
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="tech-label text-[10px] text-slate-500 uppercase tracking-wider font-bold">MODEL:</span>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{device.model || 'N/A'}</span>
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="tech-label text-[10px] text-slate-500 uppercase tracking-wider font-bold">SN:</span>
            <span className="text-xs font-mono font-black text-slate-900 tracking-tighter">{device.serialNumber || 'N/A'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
            <Layers className="w-3 h-3" /> {device.category || 'Altele'}
          </span>
          {(device.tags || []).slice(0, 4).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-wider">
              <Tag className="w-2.5 h-2.5" /> {tag}
            </span>
          ))}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {device.id.slice(0, 12)}...</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center z-[100]">
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 shadow-sm border border-slate-200 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onQuickEdit(e, device)}
          title="Editare rapida"
        >
          <Edit2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Editeaza</span>
        </button>
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-200 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onDelete(e, device.id)}
          title="Sterge dispozitiv"
        >
          <Trash2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Sterge</span>
        </button>
      </div>
    </div>
  );
});

const DeviceList = React.memo<DeviceListProps>(({ devices, onSelectDevice, onUpdateDevice, onBulkUpdate, onAddDevice, onDelete, searchQuery: externalSearch = '' }) => {
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'ALL'>(listState.status);
  const [filterDept, setFilterDept] = useState<string | 'ALL'>(listState.dept);
  const [filterCategory, setFilterCategory] = useState<string | 'ALL'>(listState.category);
  const [filterTag, setFilterTag] = useState<string | 'ALL'>(listState.tag);
  const [localSearch, setLocalSearch] = useState(listState.search);
  const [showQRSheet, setShowQRSheet] = useState(false);

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
    (filterStatus !== 'ALL' ? 1 : 0) + (filterTag !== 'ALL' ? 1 : 0);
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

      return matchSearch && matchStatus && matchDept && matchCategory && matchTag;
    });
  }, [devices, effectiveSearch, filterStatus, filterDept, filterCategory, filterTag]);

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

  const handleDeleteClick = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(deviceId);
  }, [onDelete]);

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
        <div className="fixed inset-0 z-[500] bg-slate-900/40 flex items-center justify-center p-4">
          <div className="hardware-card p-5 sm:p-10 w-full max-w-xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl animate-slide-up modal-shell overflow-y-auto overscroll-contain custom-scrollbar">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Editare rapida</h3>
                   <p className="tech-label mt-1">ID: {editingDevice.id}</p>
                </div>
                <button onClick={() => setEditingDevice(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition text-slate-400"><X className="w-6 h-6" /></button>
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
                  <div className="space-y-1">
                    <label className="tech-label ml-1">Departament</label>
                    <div className="relative">
                      <select name="department" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold appearance-none outline-none focus:border-blue-500 transition-colors" value={quickEditForm.department} onChange={handleQuickEditChange}>
                          {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
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
            <Search className={`absolute left-3.5 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 transition-colors ${effectiveSearch ? 'text-blue-600' : 'text-slate-300'}`} />
            <input 
              type="text"
              placeholder={isNarrow ? 'Cauta dispozitiv...' : 'Cauta dupa nume, categorie, serie sau departament...'}
              className="w-full pl-10 sm:pl-14 pr-3 sm:pr-6 py-3 sm:py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 focus:bg-white rounded-xl sm:rounded-2xl text-sm font-bold focus:outline-none transition-all shadow-inner"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`sm:hidden relative shrink-0 p-3 rounded-xl transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}
            title="Filtre"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 bg-slate-900 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setLocalSearch(''); setFilterStatus('ALL'); setFilterDept('ALL'); setFilterCategory('ALL'); setFilterTag('ALL'); }}
            className="shrink-0 p-3 sm:px-4 sm:py-4 bg-slate-50 text-slate-400 rounded-xl sm:rounded-2xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-inner flex items-center justify-center"
            title="Reseteaza filtrele"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} sm:grid grid-cols-2 gap-2 sm:gap-4 w-full ${allTags.length > 0 ? 'xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <FilterSelect label="Departament" value={filterDept} onChange={setFilterDept} options={allAvailableDepartments} />
          <FilterSelect label="Categorie" value={filterCategory} onChange={setFilterCategory} options={DEVICE_CATEGORIES as readonly string[]} />
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as any)}
            options={Object.values(DeviceStatus)}
            labelFor={(s) => DEVICE_STATUS_RO[s as DeviceStatus] || s}
          />
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
            <label className="flex items-center gap-2">
              <span className="tech-label">Pe pagina</span>
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[11px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner cursor-pointer"
                title="Cate dispozitive se afiseaza pe o pagina"
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
              <button
                onClick={() => changeViewMode('cards')}
                className={`p-3 rounded-xl transition active:scale-95 ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vizualizare carduri"
              >
                <LayoutGrid className="w-6 h-6" />
              </button>
              <button
                onClick={() => changeViewMode('list')}
                className={`p-3 rounded-xl transition active:scale-95 ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vizualizare lista compacta"
              >
                <Rows3 className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <span className="tech-label text-blue-600 font-black">{selectedIds.size} selectate</span>
                <button className="px-4 py-2 bg-red-50 text-red-600 rounded-xl tech-label hover:bg-red-100 transition-colors border border-red-100">Sterge selectia</button>
              </>
            )}
            <button
              onClick={() => exportToExcel(filteredDevices)}
              disabled={filteredDevices.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition active:scale-95 shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exporta in Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => exportToPDF(filteredDevices)}
              disabled={filteredDevices.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exporta in PDF"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition active:scale-95 shadow-lg shadow-blue-600/20"
              title="Importa din Excel"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowQRSheet(true)}
              disabled={filteredDevices.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              title="Genereaza etichete QR printabile pentru dispozitivele filtrate"
            >
              <QrCode className="w-4 h-4" />
              Etichete QR
            </button>
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
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
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
            />
          ))}

          {viewMode === 'list' && pageDevices.length > 0 && (
            <div className="hardware-card rounded-2xl sm:rounded-3xl overflow-hidden">
              <div className={`hidden px-5 py-3 bg-slate-50/80 border-b border-slate-100 tech-label ${LIST_GRID}`}>
                <span />
                <span className="text-center">Nr.</span>
                <span>Denumire</span>
                <span>Departament</span>
                <span>Model</span>
                <span>Serie</span>
                <span>Status</span>
                <span>Actiuni</span>
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
              <p className="tech-label mb-8 text-slate-400">Niciun dispozitiv gasit in registru</p>
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
    </div>
  );
});

export default DeviceList;
