
import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { MedicalDevice, DeviceStatus, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, DeviceCategory } from '../types';
import { Search, Eye, Trash2, Box, FileSpreadsheet, Download, Edit2, X, Check, ChevronDown, Calendar, Info, Filter, PlusCircle, ShieldAlert, Hash, Fingerprint, AlertCircle, ShieldOff, RotateCcw, Layers, Loader2, FileText, Save, Building2, Tag, Plus } from 'lucide-react';

const exportToExcel = async (devices: MedicalDevice[]) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MediTrack';
  wb.created = new Date();

  const TOTAL_COLS = 13;
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
  ];

  // Title row
  const titleRow = ws.addRow(['MEDITRACK — DEVICE INVENTORY REPORT', ...Array(TOTAL_COLS - 1).fill('')]);
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  titleRow.height = 42;
  titleRow.getCell(1).style = {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  // Subtitle row
  const subRow = ws.addRow([
    `Fleet Management System  •  Generated: ${new Date().toLocaleString()}  •  ${devices.length} devices`,
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
    { col: 5,  span: 2,  label: 'MAINTENANCE',   value: statusCounts['In Maintenance'] || 0, color: 'FFD97706' },
    { col: 7,  span: 2,  label: 'BROKEN',        value: statusCounts['Broken'] || 0,     color: 'FFDC2626' },
    { col: 9,  span: 2,  label: 'RETIRED',       value: statusCounts['Retired'] || 0,    color: 'FF64748B' },
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
  const headers = ['#', 'Device Name', 'Category', 'Manufacturer', 'Model', 'Serial No.', 'Department', 'Status', 'Purchase Date', 'Warranty Exp.', 'Next PM', 'CNCAN', 'Notes'];
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
      device.status || 'N/A',
      device.purchaseDate || '—',
      device.warrantyExpiration || '—',
      device.nextMaintenanceDate || '—',
      device.isCNCAN ? 'YES' : 'NO',
      device.notes || '',
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

  addSectionTitle('MEDITRACK — REPORT SUMMARY');
  wsSummary.addRow([]);
  addSummaryRow('Generated', new Date().toLocaleString());
  addSummaryRow('Total Devices', devices.length, true);
  addSummaryRow('CNCAN Devices', cncanCount, true);
  wsSummary.addRow([]);

  addSectionTitle('STATUS BREAKDOWN');
  Object.entries(statusCounts).forEach(([s, c]) => addSummaryRow(s, c));
  wsSummary.addRow([]);

  addSectionTitle('DEPARTMENT BREAKDOWN');
  const deptCounts: Record<string, number> = {};
  devices.forEach(d => { const k = d.department || 'Unknown'; deptCounts[k] = (deptCounts[k] || 0) + 1; });
  Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).forEach(([dept, c]) => addSummaryRow(dept, c));
  wsSummary.addRow([]);

  addSectionTitle('CATEGORY BREAKDOWN');
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
      <td><span class="badge" style="background:${statusBadgeColor(d.status)}20;color:${statusBadgeColor(d.status)};border:1px solid ${statusBadgeColor(d.status)}40">${d.status}</span></td>
      <td>${d.purchaseDate || 'N/A'}</td>
      <td>${d.nextMaintenanceDate || '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MediTrack Device Report</title>
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
      <h1>MediTrack &mdash; Device Inventory Report</h1>
      <p>Fleet Management System &bull; Biomedical Engineering</p>
    </div>
    <div class="header-right">
      <strong>${devices.length} Devices</strong>
      Generated: ${date}
    </div>
  </div>

  <div class="summary">
    <div class="stat"><div class="val">${devices.length}</div><div class="lbl">Total Devices</div></div>
    ${Object.entries(statusCounts).map(([s, c]) => `<div class="stat"><div class="val" style="color:${statusBadgeColor(s)}">${c}</div><div class="lbl">${s}</div></div>`).join('')}
    <div class="stat"><div class="val">${devices.filter(d => d.isCNCAN).length}</div><div class="lbl">CNCAN Devices</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Device Name</th>
        <th>Category</th>
        <th>Manufacturer</th>
        <th>Model</th>
        <th>Serial No.</th>
        <th>Department</th>
        <th>Status</th>
        <th>Purchase Date</th>
        <th>Next PM</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>MediTrack Fleet Registry &mdash; Confidential</span>
    <span>Page <span class="pageNumber"></span></span>
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
      {status}
    </span>
  );
});

const DeviceCard = React.memo(({ 
  device, 
  isSelected, 
  onToggleSelection, 
  onSelect, 
  onQuickEdit, 
  onDelete 
}: { 
  device: MedicalDevice, 
  isSelected: boolean, 
  onToggleSelection: (id: string) => void, 
  onSelect: (device: MedicalDevice) => void, 
  onQuickEdit: (e: React.MouseEvent, device: MedicalDevice) => void, 
  onDelete: (e: React.MouseEvent, id: string) => void 
}) => {
  return (
    <div 
      className={`hardware-card group relative flex flex-col md:flex-row items-center gap-6 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 border-l-4 ${isSelected ? 'border-l-blue-600 bg-blue-50/30' : 'border-l-transparent hover:border-l-blue-400'}`}
    >
      {/* Selection Checkbox */}
      <div className="absolute top-6 left-6 md:static">
        <input 
          type="checkbox" 
          className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500 transition-all" 
          checked={isSelected} 
          onChange={() => onToggleSelection(device.id)} 
        />
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
          <h3 className="font-black text-slate-900 text-xl md:text-lg leading-tight truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">
            {device.name || 'Unnamed Asset'}
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
            <span className="text-xs font-black text-slate-700">{device.manufacturer || 'Unknown'}</span>
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

        <div className="flex items-center gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
            <Layers className="w-3 h-3" /> {device.category || 'Altele'}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {device.id.slice(0, 12)}...</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center z-[100]">
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 shadow-sm border border-slate-200 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onQuickEdit(e, device)}
          title="Quick Edit"
        >
          <Edit2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Edit</span>
        </button>
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-200 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onDelete(e, device.id)}
          title="Purge Asset"
        >
          <Trash2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Purge</span>
        </button>
      </div>
    </div>
  );
});

const DeviceList: React.FC<DeviceListProps> = ({ devices, onSelectDevice, onUpdateDevice, onBulkUpdate, onAddDevice, onDelete, searchQuery: externalSearch = '' }) => {
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'ALL'>('ALL');
  const [filterDept, setFilterDept] = useState<string | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string | 'ALL'>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDevice, setEditingDevice] = useState<MedicalDevice | null>(null);
  
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

  const effectiveSearch = (localSearch || externalSearch).toLowerCase().trim();

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
      
      return matchSearch && matchStatus && matchDept && matchCategory;
    });
  }, [devices, effectiveSearch, filterStatus, filterDept, filterCategory]);

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

  return (
    <div className="space-y-8 pb-24 relative animate-slide-up">
      {/* QUICK EDIT OVERLAY */}
      {editingDevice && (
        <div className="fixed inset-0 z-[500] bg-slate-900/40 flex items-center justify-center p-4">
          <div className="hardware-card p-10 w-full max-w-xl rounded-[2.5rem] shadow-2xl animate-slide-up">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Registry Quick Update</h3>
                   <p className="tech-label mt-1">ID: {editingDevice.id}</p>
                </div>
                <button onClick={() => setEditingDevice(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition text-slate-400"><X className="w-6 h-6" /></button>
             </div>
             
             <div className="space-y-6 mb-10">
                <div className="space-y-1">
                   <label className="tech-label ml-1">Asset Nomenclature</label>
                   <input name="name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.name} onChange={handleQuickEditChange} />
                </div>
                <div className="space-y-1">
                   <label className="tech-label ml-1">Serial Identifier</label>
                   <input name="serialNumber" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.serialNumber} onChange={handleQuickEditChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="tech-label ml-1">Unit Assignment</label>
                    <div className="relative">
                      <select name="department" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold appearance-none outline-none focus:border-blue-500 transition-colors" value={quickEditForm.department} onChange={handleQuickEditChange}>
                          {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="tech-label ml-1">Registry Status</label>
                    <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.status} onChange={handleQuickEditChange}>
                        {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
             </div>

             <div className="flex gap-4">
                <button onClick={() => setEditingDevice(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition">Discard</button>
                <button onClick={handleSaveQuickEdit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-3">
                   <Save className="w-5 h-5" /> Commit Data
                </button>
             </div>
          </div>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="hardware-card p-8 rounded-[2.5rem] flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
          <div className="relative flex-1 w-full group">
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${effectiveSearch ? 'text-blue-600' : 'text-slate-300'}`} />
            <input 
              type="text"
              placeholder="Search registry by name, category, serial, or unit..."
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 focus:bg-white rounded-2xl text-sm font-bold focus:outline-none transition-all shadow-inner"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => { setLocalSearch(''); setFilterStatus('ALL'); setFilterDept('ALL'); setFilterCategory('ALL'); }}
            className="px-4 py-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-inner flex items-center justify-center"
            title="Reset Filters"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
          <div className="space-y-1">
            <label className="tech-label ml-1">Department</label>
            <select className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="ALL">ALL DEPTS</option>
              {allAvailableDepartments.map(dept => <option key={dept} value={dept}>{dept.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Category</label>
            <select className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="ALL">ALL CATEGORIES</option>
              {DEVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Status</label>
            <select className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
              <option value="ALL">ALL STATUSES</option>
              {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-8 py-2 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 px-3 py-1 rounded-lg text-white font-mono text-xs font-black">
              {filteredDevices.length}
            </div>
            <span className="tech-label">Assets Identified</span>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <>
                <span className="tech-label text-blue-600 font-black">{selectedIds.size} Selected</span>
                <button className="px-4 py-2 bg-red-50 text-red-600 rounded-xl tech-label hover:bg-red-100 transition-colors border border-red-100">Bulk Purge</button>
              </>
            )}
            <button
              onClick={() => exportToExcel(filteredDevices)}
              disabled={filteredDevices.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition active:scale-95 shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => exportToPDF(filteredDevices)}
              disabled={filteredDevices.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export to PDF"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard 
              key={device.id}
              device={device}
              isSelected={selectedIds.has(device.id)}
              onToggleSelection={toggleSelection}
              onSelect={onSelectDevice}
              onQuickEdit={handleOpenQuickEdit}
              onDelete={handleDeleteClick}
            />
          ))}

          {filteredDevices.length === 0 && (
            <div className="hardware-card py-32 text-center rounded-[2.5rem]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <Box className="w-10 h-10 text-slate-200" />
              </div>
              <p className="tech-label mb-8 text-slate-400">No matching assets found in the registry</p>
              <button 
                onClick={onAddDevice}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition flex items-center gap-3 mx-auto active:scale-95"
              >
                <Plus className="w-5 h-5" /> Register New Asset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceList;
