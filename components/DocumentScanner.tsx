
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ScanLine, AlertCircle, CheckCircle, Search, Loader2, Mail, Download, FileText, RotateCcw, Upload, Scissors, Copy } from 'lucide-react';
import { MedicalDevice, DeviceFile } from '../types';

interface DocumentScannerProps {
  devices: MedicalDevice[];
  onSave: (deviceId: string, file: DeviceFile) => void;
  onClose: () => void;
}

type ScanStatus = 'camera' | 'processing' | 'review' | 'manual' | 'saving' | 'done' | 'error';
type InputMode = 'camera' | 'pdf';
type SaveMode = 'full' | 'split';

interface PageDeviceMap {
  [pageIndex: number]: string; // page index → device id
}

const DocumentScanner: React.FC<DocumentScannerProps> = ({ devices, onSave, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null); // keep original PDF bytes for splitting

  const [status, setStatus] = useState<ScanStatus>('camera');
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [capturedImage, setCapturedImage] = useState('');
  const [pdfData, setPdfData] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [saveMode, setSaveMode] = useState<SaveMode>('full');

  // page index → device id (for split mode)
  const [pageDeviceMap, setPageDeviceMap] = useState<PageDeviceMap>({});
  // devices found across all pages
  const [matchedDevices, setMatchedDevices] = useState<MedicalDevice[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());

  // manual search
  const [selectedDevice, setSelectedDevice] = useState<MedicalDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MedicalDevice[]>([]);

  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<DeviceFile['type']>('report');
  const [savedCount, setSavedCount] = useState(0);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NotSupportedError' });
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') setCameraError('Camera permission denied.');
      else if (name === 'NotFoundError') setCameraError('No camera found on this device.');
      else if (name === 'NotReadableError') setCameraError('Camera is in use by another app.');
      else setCameraError(`Camera error: ${name || err?.message || 'unknown'}`);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => { if (active) await startCamera(); };
    run();
    return () => { active = false; stopCamera(); };
  }, [startCamera, stopCamera]);

  const matchAllDevices = useCallback((text: string): MedicalDevice[] => {
    const lower = text.toLowerCase();
    const sorted = [...devices]
      .filter(d => d.serialNumber && d.serialNumber !== 'N/A' && d.serialNumber.length >= 3)
      .sort((a, b) => b.serialNumber.length - a.serialNumber.length);
    const seen = new Set<string>();
    return sorted.filter(d => {
      if (!seen.has(d.id) && lower.includes(d.serialNumber.toLowerCase().trim())) {
        seen.add(d.id);
        return true;
      }
      return false;
    });
  }, [devices]);

  const matchFirstDevice = useCallback((text: string): MedicalDevice | null => {
    return matchAllDevices(text)[0] || null;
  }, [matchAllDevices]);

  const finishProcessing = useCallback((
    allText: string,
    pageTexts: string[],
    fileLabel: string
  ) => {
    const found = matchAllDevices(allText);
    setDocName(fileLabel + '_' + new Date().toISOString().split('T')[0]);

    // Build page → device map
    const map: PageDeviceMap = {};
    pageTexts.forEach((pt, i) => {
      const d = matchFirstDevice(pt);
      if (d) map[i] = d.id;
    });
    setPageDeviceMap(map);

    if (found.length > 0) {
      setMatchedDevices(found);
      setSelectedDeviceIds(new Set(found.map(d => d.id)));
      // Auto-enable split mode if multiple devices found across pages
      const uniqueInPages = new Set(Object.values(map));
      if (uniqueInPages.size > 1) setSaveMode('split');
      else setSaveMode('full');
      setStatus('review');
    } else {
      setStatus('manual');
    }
  }, [matchAllDevices, matchFirstDevice]);

  // Camera capture + Tesseract OCR
  const captureAndProcess = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(imageData);
    setInputMode('camera');
    stopCamera();
    setStatus('processing');
    setOcrProgress(0);
    setOcrStatusText('Loading OCR engine...');
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(imageData, 'eng', {
        logger: (m: any) => {
          setOcrStatusText(m.status || '');
          if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
        }
      });
      finishProcessing(result.data.text, [result.data.text], 'Scan');
    } catch {
      setDocName(`Scan_${new Date().toISOString().split('T')[0]}`);
      setStatus('manual');
    }
  }, [stopCamera, finishProcessing]);

  // PDF upload — extract text per page
  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    setPdfFileName(file.name);
    setInputMode('pdf');
    stopCamera();
    setStatus('processing');
    setOcrProgress(0);
    setOcrStatusText('Reading PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfBytesRef.current = arrayBuffer;

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(new Blob([arrayBuffer], { type: 'application/pdf' }));
      });
      setPdfData(base64);

      setOcrStatusText('Extracting text from PDF...');
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const pageTexts: string[] = [];
      let fullText = '';

      for (let i = 1; i <= totalPages; i++) {
        setOcrStatusText(`Extracting page ${i} of ${totalPages}...`);
        setOcrProgress(Math.round((i / totalPages) * 100));
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        pageTexts.push(pageText);
        fullText += pageText + '\n';
      }

      finishProcessing(fullText, pageTexts, file.name.replace('.pdf', ''));
    } catch {
      setDocName(`PDF_${new Date().toISOString().split('T')[0]}`);
      setStatus('manual');
    }
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }, [stopCamera, finishProcessing]);

  // Split PDF bytes into per-device sub-PDFs using pdf-lib
  const splitAndSave = useCallback(async () => {
    if (!pdfBytesRef.current) return;
    setStatus('saving');

    try {
      const { PDFDocument } = await import('pdf-lib');
      const srcPdf = await PDFDocument.load(pdfBytesRef.current);

      // Group pages by device
      const devicePages: Map<string, number[]> = new Map();
      Object.entries(pageDeviceMap).forEach(([pageIdx, deviceId]) => {
        if (!selectedDeviceIds.has(deviceId)) return;
        if (!devicePages.has(deviceId)) devicePages.set(deviceId, []);
        devicePages.get(deviceId)!.push(Number(pageIdx));
      });

      let count = 0;
      for (const [deviceId, pageIndices] of devicePages) {
        const newPdf = await PDFDocument.create();
        const copied = await newPdf.copyPages(srcPdf, pageIndices);
        copied.forEach(p => newPdf.addPage(p));
        const pdfBytes = await newPdf.save();

        // Convert to base64 data URL
        const base64 = btoa(
          Array.from(new Uint8Array(pdfBytes)).map(b => String.fromCharCode(b)).join('')
        );
        const dataUrl = `data:application/pdf;base64,${base64}`;

        const device = devices.find(d => d.id === deviceId);
        const fileRecord: DeviceFile = {
          id: crypto.randomUUID(),
          name: `${docName}_p${pageIndices.map(i => i + 1).join('-')}`,
          type: docType,
          url: dataUrl,
          dateAdded: new Date().toISOString().split('T')[0],
        };
        await onSave(deviceId, fileRecord);
        count++;
      }

      // Save unassigned pages to manually selected devices (if any)
      const assignedPages = new Set(Object.keys(pageDeviceMap).map(Number));
      const srcPageCount = srcPdf.getPageCount();
      const unassignedPages = Array.from({ length: srcPageCount }, (_, i) => i).filter(i => !assignedPages.has(i));
      if (unassignedPages.length > 0) {
        const extraDevices = matchedDevices.filter(d => selectedDeviceIds.has(d.id) && !devicePages.has(d.id));
        for (const device of extraDevices) {
          const newPdf = await PDFDocument.create();
          const copied = await newPdf.copyPages(srcPdf, unassignedPages);
          copied.forEach(p => newPdf.addPage(p));
          const pdfBytes = await newPdf.save();
          const base64 = btoa(Array.from(new Uint8Array(pdfBytes)).map(b => String.fromCharCode(b)).join(''));
          const dataUrl = `data:application/pdf;base64,${base64}`;
          await onSave(device.id, {
            id: crypto.randomUUID(),
            name: `${docName}_unassigned`,
            type: docType,
            url: dataUrl,
            dateAdded: new Date().toISOString().split('T')[0],
          });
          count++;
        }
      }

      setSavedCount(count);
      setStatus('done');
    } catch {
      setStatus('review');
    }
  }, [pageDeviceMap, selectedDeviceIds, devices, docName, docType, onSave, matchedDevices]);

  const handleSave = useCallback(async () => {
    if (inputMode === 'pdf' && saveMode === 'split' && pdfBytesRef.current) {
      await splitAndSave();
      return;
    }
    // Full PDF / image save to all selected devices
    const fileUrl = inputMode === 'pdf' ? pdfData : capturedImage;
    if (!fileUrl) return;
    const targets = matchedDevices.length > 0
      ? matchedDevices.filter(d => selectedDeviceIds.has(d.id))
      : selectedDevice ? [selectedDevice] : [];
    if (targets.length === 0) return;
    setStatus('saving');
    for (const device of targets) {
      await onSave(device.id, {
        id: crypto.randomUUID(),
        name: docName || `Doc_${device.serialNumber}_${new Date().toISOString().split('T')[0]}`,
        type: docType,
        url: fileUrl,
        dateAdded: new Date().toISOString().split('T')[0],
      });
    }
    setSavedCount(targets.length);
    setStatus('done');
  }, [inputMode, saveMode, splitAndSave, pdfData, capturedImage, matchedDevices, selectedDeviceIds, selectedDevice, docName, docType, onSave]);

  const toggleDeviceSelection = useCallback((id: string) => {
    setSelectedDeviceIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const lower = q.toLowerCase();
    setSearchResults(devices.filter(d => d.serialNumber?.toLowerCase().includes(lower) || d.name?.toLowerCase().includes(lower) || d.model?.toLowerCase().includes(lower)).slice(0, 6));
  }, [devices]);

  const handleDownload = useCallback(() => {
    const url = inputMode === 'pdf' ? pdfData : capturedImage;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = inputMode === 'pdf' ? `${docName || 'document'}.pdf` : `${docName || 'scan'}.jpg`;
    a.click();
  }, [inputMode, pdfData, capturedImage, docName]);

  const handleEmail = useCallback(() => {
    handleDownload();
    const deviceList = matchedDevices.filter(d => selectedDeviceIds.has(d.id)).map(d => `• ${d.name} (SN: ${d.serialNumber})`).join('\n');
    const subject = encodeURIComponent(`Document — ${savedCount} device(s)`);
    const body = encodeURIComponent(`Saved for:\n\n${deviceList}\n\nDate: ${new Date().toLocaleDateString()}\n\nFile downloaded — please attach to this email.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [handleDownload, matchedDevices, selectedDeviceIds, savedCount]);

  const handleRetry = useCallback(() => {
    setCapturedImage(''); setPdfData(''); setPdfFileName('');
    setMatchedDevices([]); setSelectedDeviceIds(new Set());
    setSelectedDevice(null); setSearchQuery(''); setSearchResults([]);
    setDocName(''); setSavedCount(0); setOcrProgress(0);
    setCameraError(''); setPageDeviceMap({}); setSaveMode('full');
    pdfBytesRef.current = null;
    setStatus('camera');
    startCamera();
  }, [startCamera]);

  // How many pages are mapped per device
  const getPageCountForDevice = (deviceId: string) =>
    Object.values(pageDeviceMap).filter(id => id === deviceId).length;

  const hasMultipleDevicesInPages = new Set(Object.values(pageDeviceMap)).size > 1;

  const DeviceFields = () => (
    <div className="space-y-3">
      <div>
        <label className="text-white/50 text-[10px] font-black uppercase tracking-widest block mb-1.5">File Name</label>
        <input value={docName} onChange={e => setDocName(e.target.value)} className="w-full bg-white/10 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10" />
      </div>
      <div>
        <label className="text-white/50 text-[10px] font-black uppercase tracking-widest block mb-1.5">Document Type</label>
        <select value={docType} onChange={e => setDocType(e.target.value as DeviceFile['type'])} className="w-full bg-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10">
          <option value="report" className="bg-slate-900">Report</option>
          <option value="manual" className="bg-slate-900">Manual</option>
          <option value="image" className="bg-slate-900">Image</option>
          <option value="other" className="bg-slate-900">Other</option>
        </select>
      </div>
    </div>
  );

  const FilePreview = () => (
    inputMode === 'pdf' ? (
      <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
        <FileText className="w-8 h-8 text-blue-400 shrink-0" />
        <p className="text-white/60 text-sm font-mono truncate">{pdfFileName}</p>
      </div>
    ) : capturedImage ? (
      <img src={capturedImage} alt="Scanned" className="w-full rounded-xl object-contain max-h-40" />
    ) : null
  );

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col">
      <div className="flex items-center justify-between p-5 bg-black/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl"><ScanLine className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Document Scanner</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">MediTrack · OCR Engine</p>
          </div>
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {status === 'camera' && (
          <div className="relative h-full min-h-[500px]">
            {cameraError ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <p className="text-white/60 text-sm text-center">{cameraError}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[85%] max-w-xl aspect-[1.414/1] border-2 border-white/40 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-bold tracking-widest uppercase whitespace-nowrap">Align document within frame</p>
                  </div>
                </div>
                <div className="absolute bottom-24 left-0 right-0 flex justify-center">
                  <button onClick={captureAndProcess} className="w-20 h-20 bg-white rounded-full border-4 border-blue-500 shadow-2xl active:scale-95 transition-transform flex items-center justify-center">
                    <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
                      <ScanLine className="w-7 h-7 text-white" />
                    </div>
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
              <button onClick={() => pdfInputRef.current?.click()} className="flex items-center gap-2.5 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-widest backdrop-blur-sm transition active:scale-95">
                <Upload className="w-4 h-4" />Upload PDF
              </button>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
            {inputMode === 'pdf' ? (
              <div className="p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <FileText className="w-16 h-16 text-blue-400 mx-auto" />
                <p className="text-white/60 text-xs font-mono text-center mt-3 max-w-[200px] truncate">{pdfFileName}</p>
              </div>
            ) : capturedImage && <img src={capturedImage} alt="Captured" className="w-full max-w-sm rounded-xl object-contain max-h-48 opacity-60" />}
            <div className="w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{inputMode === 'pdf' ? 'Extracting PDF Text...' : 'OCR Processing...'}</p>
                <p className="text-blue-400 text-xs font-black">{ocrProgress}%</p>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest capitalize">{ocrStatusText}</p>
            </div>
          </div>
        )}

        {status === 'review' && matchedDevices.length > 0 && (
          <div className="p-6 space-y-5 max-w-lg mx-auto">
            <FilePreview />

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-400 font-black text-sm uppercase tracking-tight">
                  {matchedDevices.length === 1 ? 'Device Matched' : `${matchedDevices.length} Devices Found`}
                </p>
                <p className="text-white/50 text-xs mt-1">
                  {matchedDevices.length === 1 ? 'Select how to save this file.' : 'Multiple devices detected across pages.'}
                </p>
              </div>
            </div>

            {/* Save mode toggle — only for PDFs with multiple devices */}
            {inputMode === 'pdf' && hasMultipleDevicesInPages && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSaveMode('full')}
                  className={`p-3 rounded-xl border text-left transition ${saveMode === 'full' ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Copy className="w-4 h-4 text-blue-400" />
                    <p className="text-white text-xs font-black uppercase tracking-tight">Full PDF</p>
                  </div>
                  <p className="text-white/40 text-[10px]">Same file saved to each device</p>
                </button>
                <button
                  onClick={() => setSaveMode('split')}
                  className={`p-3 rounded-xl border text-left transition ${saveMode === 'split' ? 'bg-emerald-600/20 border-emerald-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Scissors className="w-4 h-4 text-emerald-400" />
                    <p className="text-white text-xs font-black uppercase tracking-tight">Split PDF</p>
                  </div>
                  <p className="text-white/40 text-[10px]">Each device gets only its pages</p>
                </button>
              </div>
            )}

            {/* Device list with page counts */}
            <div className="space-y-2">
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                {matchedDevices.length === 1 ? 'Matched Device' : `Matched Devices (${selectedDeviceIds.size} selected)`}
              </p>
              {matchedDevices.map(d => {
                const pageCount = getPageCountForDevice(d.id);
                return (
                  <button key={d.id} onClick={() => toggleDeviceSelection(d.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${selectedDeviceIds.has(d.id) ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${selectedDeviceIds.has(d.id) ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}>
                      {selectedDeviceIds.has(d.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{d.name}</p>
                      <p className="text-white/50 text-[10px] font-mono">SN: {d.serialNumber} · {d.department}</p>
                    </div>
                    {saveMode === 'split' && pageCount > 0 && (
                      <span className="shrink-0 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg">
                        {pageCount}p
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <DeviceFields />

            <div className="flex gap-3">
              <button onClick={handleRetry} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button onClick={() => setStatus('manual')} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Add More
              </button>
              <button onClick={handleSave} disabled={selectedDeviceIds.size === 0} className={`flex-1 py-3 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 ${saveMode === 'split' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saveMode === 'split' ? <Scissors className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {saveMode === 'split' ? 'Split & Save' : `Save to ${selectedDeviceIds.size > 1 ? `${selectedDeviceIds.size} Devices` : 'Device'}`}
              </button>
            </div>
          </div>
        )}

        {status === 'manual' && (
          <div className="p-6 space-y-5 max-w-lg mx-auto">
            <FilePreview />
            {matchedDevices.length > 0 ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3">
                <Search className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-300 text-xs">Add more devices to associate with this document.</p>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 font-black text-sm uppercase tracking-tight">No Device Detected</p>
                  <p className="text-white/60 text-xs mt-1">No serial numbers found. Search manually.</p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-white/50 text-[10px] font-black uppercase tracking-widest block mb-1.5">Search Device</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input value={searchQuery} onChange={e => handleSearch(e.target.value)} placeholder="Serial number, name or model..."
                    className="w-full bg-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 placeholder:text-white/20" />
                </div>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {searchResults.map(d => (
                    <button key={d.id} onClick={() => {
                      setSelectedDevice(d);
                      setMatchedDevices(prev => prev.find(x => x.id === d.id) ? prev : [...prev, d]);
                      setSelectedDeviceIds(prev => new Set([...prev, d.id]));
                      setSearchResults([]); setSearchQuery('');
                    }} className="w-full text-left p-3 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 transition">
                      <p className="text-white text-sm font-bold">{d.name}</p>
                      <p className="text-white/50 text-[10px] font-mono">SN: {d.serialNumber} · {d.department}</p>
                    </button>
                  ))}
                </div>
              )}
              {matchedDevices.filter(d => selectedDeviceIds.has(d.id)).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Selected</p>
                  {matchedDevices.filter(d => selectedDeviceIds.has(d.id)).map(d => (
                    <div key={d.id} className="flex items-center gap-2 p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                      <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                      <p className="text-white/70 text-xs flex-1 truncate">{d.name} <span className="font-mono text-white/40">· {d.serialNumber}</span></p>
                      <button onClick={() => { setMatchedDevices(prev => prev.filter(x => x.id !== d.id)); setSelectedDeviceIds(prev => { const n = new Set(prev); n.delete(d.id); return n; }); }} className="text-white/30 hover:text-red-400 transition text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <DeviceFields />
            </div>
            <div className="flex gap-3">
              <button onClick={handleRetry} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"><RotateCcw className="w-5 h-5" /></button>
              {matchedDevices.length > 0 && (
                <button onClick={() => setStatus('review')} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">Back</button>
              )}
              <button onClick={handleSave} disabled={matchedDevices.filter(d => selectedDeviceIds.has(d.id)).length === 0}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Save File
              </button>
            </div>
          </div>
        )}

        {status === 'saving' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-white/60 text-sm font-bold uppercase tracking-widest">
              {saveMode === 'split' ? 'Splitting & saving PDF...' : 'Saving document...'}
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
            <div className="p-6 bg-emerald-500/20 rounded-full">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-black text-xl uppercase tracking-tight">
                {saveMode === 'split' ? 'PDF Split & Saved!' : 'File Saved!'}
              </p>
              <p className="text-white/50 text-sm">{docName}</p>
              <p className="text-white/40 text-xs mt-1">Saved to {savedCount} device{savedCount !== 1 ? 's' : ''}</p>
            </div>
            {savedCount > 1 && (
              <div className="w-full max-w-xs space-y-1.5">
                {matchedDevices.filter(d => selectedDeviceIds.has(d.id)).map(d => (
                  <div key={d.id} className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <p className="text-white/60 text-xs truncate">{d.name} <span className="font-mono text-white/30">· {d.serialNumber}</span></p>
                    {saveMode === 'split' && <span className="shrink-0 text-emerald-400 text-[10px] font-black">{getPageCountForDevice(d.id)}p</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={handleDownload} className="flex-1 py-3 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                <Download className="w-4 h-4" />Download
              </button>
              <button onClick={handleEmail} className="flex-1 py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                <Mail className="w-4 h-4" />Email
              </button>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={handleRetry} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">Scan Another</button>
              <button onClick={() => { stopCamera(); onClose(); }} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">Close</button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
            <div className="p-6 bg-red-500/10 rounded-full"><AlertCircle className="w-16 h-16 text-red-400" /></div>
            <p className="text-white/60 text-sm max-w-xs text-center">{cameraError}</p>
            <button onClick={() => { stopCamera(); onClose(); }} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest">Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;
