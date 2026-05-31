
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ScanLine, AlertCircle, CheckCircle, Search, Loader2, Mail, Download, FileText, RotateCcw, Upload } from 'lucide-react';
import { MedicalDevice, DeviceFile } from '../types';

interface DocumentScannerProps {
  devices: MedicalDevice[];
  onSave: (deviceId: string, file: DeviceFile) => void;
  onClose: () => void;
}

type ScanStatus = 'camera' | 'processing' | 'review' | 'manual' | 'saving' | 'done' | 'error';
type InputMode = 'camera' | 'pdf';

const DocumentScanner: React.FC<DocumentScannerProps> = ({ devices, onSave, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<ScanStatus>('camera');
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [capturedImage, setCapturedImage] = useState('');
  const [pdfData, setPdfData] = useState('');       // base64 PDF
  const [pdfFileName, setPdfFileName] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [matchedDevice, setMatchedDevice] = useState<MedicalDevice | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<MedicalDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MedicalDevice[]>([]);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<DeviceFile['type']>('report');
  const [errorMsg, setErrorMsg] = useState('');
  const [emailSent, setEmailSent] = useState(false);
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

  // Match serial numbers from text against device list
  const matchDevice = useCallback((text: string): MedicalDevice | null => {
    const sorted = [...devices]
      .filter(d => d.serialNumber && d.serialNumber !== 'N/A' && d.serialNumber.length >= 3)
      .sort((a, b) => b.serialNumber.length - a.serialNumber.length);
    return sorted.find(d => text.toLowerCase().includes(d.serialNumber.toLowerCase().trim())) || null;
  }, [devices]);

  const finishProcessing = useCallback((text: string, fileLabel: string) => {
    const found = matchDevice(text);
    if (found) {
      setMatchedDevice(found);
      setSelectedDevice(found);
      setDocName(`${fileLabel}_${found.serialNumber}_${new Date().toISOString().split('T')[0]}`);
      setStatus('review');
    } else {
      setDocName(`${fileLabel}_${new Date().toISOString().split('T')[0]}`);
      setStatus('manual');
    }
  }, [matchDevice]);

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
      finishProcessing(result.data.text, 'Scan');
    } catch {
      setDocName(`Scan_${new Date().toISOString().split('T')[0]}`);
      setStatus('manual');
    }
  }, [stopCamera, finishProcessing]);

  // PDF upload + PDF.js text extraction
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

      // Store as base64 for saving
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(new Blob([arrayBuffer], { type: 'application/pdf' }));
      });
      setPdfData(base64);

      // Extract text with PDF.js
      setOcrStatusText('Extracting text from PDF...');
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      let fullText = '';

      for (let i = 1; i <= totalPages; i++) {
        setOcrStatusText(`Extracting page ${i} of ${totalPages}...`);
        setOcrProgress(Math.round((i / totalPages) * 100));
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';

        // Early exit if we already found a match
        if (matchDevice(fullText)) break;
      }

      finishProcessing(fullText, file.name.replace('.pdf', ''));
    } catch (err) {
      setDocName(`PDF_${new Date().toISOString().split('T')[0]}`);
      setStatus('manual');
    }

    // Reset input so same file can be re-uploaded
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }, [stopCamera, matchDevice, finishProcessing]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const lower = q.toLowerCase();
    setSearchResults(
      devices.filter(d =>
        d.serialNumber?.toLowerCase().includes(lower) ||
        d.name?.toLowerCase().includes(lower) ||
        d.model?.toLowerCase().includes(lower)
      ).slice(0, 6)
    );
  }, [devices]);

  const handleSave = useCallback(async () => {
    if (!selectedDevice) return;
    const fileUrl = inputMode === 'pdf' ? pdfData : capturedImage;
    if (!fileUrl) return;
    setStatus('saving');
    const file: DeviceFile = {
      id: crypto.randomUUID(),
      name: docName || `Doc_${selectedDevice.serialNumber}_${new Date().toISOString().split('T')[0]}`,
      type: docType,
      url: fileUrl,
      dateAdded: new Date().toISOString().split('T')[0],
    };
    await onSave(selectedDevice.id, file);
    setStatus('done');
  }, [selectedDevice, inputMode, pdfData, capturedImage, docName, docType, onSave]);

  const handleDownload = useCallback(() => {
    const url = inputMode === 'pdf' ? pdfData : capturedImage;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = inputMode === 'pdf' ? `${docName || 'document'}.pdf` : `${docName || 'scan'}.jpg`;
    a.click();
  }, [inputMode, pdfData, capturedImage, docName]);

  const handleEmail = useCallback(() => {
    if (!selectedDevice) return;
    handleDownload();
    const subject = encodeURIComponent(`Document — ${selectedDevice.name} (SN: ${selectedDevice.serialNumber})`);
    const body = encodeURIComponent(
      `Document details:\n\nDevice: ${selectedDevice.name}\nSerial Number: ${selectedDevice.serialNumber}\nDepartment: ${selectedDevice.department}\nDate: ${new Date().toLocaleDateString()}\n\nThe file has been downloaded to your device — please attach it to this email.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setEmailSent(true);
  }, [selectedDevice, handleDownload]);

  const handleRetry = useCallback(() => {
    setCapturedImage('');
    setPdfData('');
    setPdfFileName('');
    setMatchedDevice(null);
    setSelectedDevice(null);
    setSearchQuery('');
    setSearchResults([]);
    setDocName('');
    setEmailSent(false);
    setOcrProgress(0);
    setCameraError('');
    setStatus('camera');
    startCamera();
  }, [startCamera]);

  // Shared device selection snippet
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

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-5 bg-black/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
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

        {/* CAMERA VIEW */}
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
                {/* Document frame guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[85%] max-w-xl aspect-[1.414/1] border-2 border-white/40 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-bold tracking-widest uppercase whitespace-nowrap">Align document within frame</p>
                  </div>
                </div>
                {/* Capture button */}
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

            {/* PDF Upload button — always visible */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center gap-2.5 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-widest backdrop-blur-sm transition active:scale-95"
              >
                <Upload className="w-4 h-4" />
                Upload PDF
              </button>
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {status === 'processing' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
            {inputMode === 'pdf' ? (
              <div className="p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <FileText className="w-16 h-16 text-blue-400 mx-auto" />
                <p className="text-white/60 text-xs font-mono text-center mt-3 max-w-[200px] truncate">{pdfFileName}</p>
              </div>
            ) : (
              capturedImage && <img src={capturedImage} alt="Captured" className="w-full max-w-sm rounded-xl object-contain max-h-48 opacity-60" />
            )}
            <div className="w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
                  {inputMode === 'pdf' ? 'Extracting PDF Text...' : 'OCR Processing...'}
                </p>
                <p className="text-blue-400 text-xs font-black">{ocrProgress}%</p>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest capitalize">{ocrStatusText}</p>
            </div>
          </div>
        )}

        {/* REVIEW — device found automatically */}
        {status === 'review' && matchedDevice && (
          <div className="p-6 space-y-5 max-w-lg mx-auto">
            {inputMode === 'camera' && capturedImage && (
              <img src={capturedImage} alt="Scanned" className="w-full rounded-xl object-contain max-h-48" />
            )}
            {inputMode === 'pdf' && (
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                <FileText className="w-8 h-8 text-blue-400 shrink-0" />
                <p className="text-white/60 text-sm font-mono truncate">{pdfFileName}</p>
              </div>
            )}

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-400 font-black text-sm uppercase tracking-tight">Device Matched</p>
                <p className="text-white/70 text-xs mt-1">{matchedDevice.name}</p>
                <p className="text-white/40 text-[10px] font-mono mt-0.5">SN: {matchedDevice.serialNumber}</p>
                <p className="text-white/40 text-[10px] mt-0.5">{matchedDevice.department}</p>
              </div>
            </div>

            <DeviceFields />

            <div className="flex gap-3">
              <button onClick={handleRetry} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button onClick={() => setStatus('manual')} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Change Device
              </button>
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Save File
              </button>
            </div>
          </div>
        )}

        {/* MANUAL — no match found */}
        {status === 'manual' && (
          <div className="p-6 space-y-5 max-w-lg mx-auto">
            {inputMode === 'camera' && capturedImage && (
              <img src={capturedImage} alt="Scanned" className="w-full rounded-xl object-contain max-h-40" />
            )}
            {inputMode === 'pdf' && (
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                <FileText className="w-8 h-8 text-blue-400 shrink-0" />
                <p className="text-white/60 text-sm font-mono truncate">{pdfFileName}</p>
              </div>
            )}

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-black text-sm uppercase tracking-tight">No Device Detected</p>
                <p className="text-white/60 text-xs mt-1">Serial number not found. Search for the device manually.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-white/50 text-[10px] font-black uppercase tracking-widest block mb-1.5">Search Device</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Serial number, name or model..."
                    className="w-full bg-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 placeholder:text-white/20"
                  />
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {searchResults.map(d => (
                    <button key={d.id} onClick={() => { setSelectedDevice(d); setSearchResults([]); setSearchQuery(d.serialNumber); setDocName(`${inputMode === 'pdf' ? pdfFileName.replace('.pdf','') : 'Scan'}_${d.serialNumber}_${new Date().toISOString().split('T')[0]}`); }}
                      className={`w-full text-left p-3 rounded-xl border transition ${selectedDevice?.id === d.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <p className="text-white text-sm font-bold">{d.name}</p>
                      <p className="text-white/50 text-[10px] font-mono">SN: {d.serialNumber} · {d.department}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedDevice && (
                <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                  <p className="text-blue-400 text-xs font-black uppercase tracking-tight">Selected: {selectedDevice.name}</p>
                  <p className="text-white/40 text-[10px] font-mono mt-0.5">SN: {selectedDevice.serialNumber}</p>
                </div>
              )}

              <DeviceFields />
            </div>

            <div className="flex gap-3">
              <button onClick={handleRetry} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button onClick={handleSave} disabled={!selectedDevice} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Save File
              </button>
            </div>
          </div>
        )}

        {/* SAVING */}
        {status === 'saving' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Saving document...</p>
          </div>
        )}

        {/* DONE */}
        {status === 'done' && selectedDevice && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
            <div className="p-6 bg-emerald-500/20 rounded-full">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-black text-xl uppercase tracking-tight">File Saved!</p>
              <p className="text-white/50 text-sm">{docName}</p>
              <p className="text-white/30 text-xs font-mono">→ {selectedDevice.name} · SN: {selectedDevice.serialNumber}</p>
            </div>

            {inputMode === 'camera' && capturedImage && (
              <img src={capturedImage} alt="Saved doc" className="w-full max-w-xs rounded-xl object-contain max-h-40 opacity-80" />
            )}
            {inputMode === 'pdf' && (
              <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-xl">
                <FileText className="w-8 h-8 text-blue-400 shrink-0" />
                <p className="text-white/60 text-sm font-mono truncate">{pdfFileName}</p>
              </div>
            )}

            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={handleDownload} className="flex-1 py-3 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                <Download className="w-4 h-4" />
                Download
              </button>
              <button onClick={handleEmail} className="flex-1 py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                <Mail className="w-4 h-4" />
                {emailSent ? 'Sent!' : 'Email'}
              </button>
            </div>
            {emailSent && (
              <p className="text-white/40 text-[10px] text-center max-w-xs">File downloaded. Attach it to the email that just opened in your mail client.</p>
            )}

            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={handleRetry} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Scan Another
              </button>
              <button onClick={() => { stopCamera(); onClose(); }} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition">
                Close
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
            <div className="p-6 bg-red-500/10 rounded-full">
              <AlertCircle className="w-16 h-16 text-red-400" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-white font-black text-lg uppercase tracking-tight">Error</p>
              <p className="text-white/60 text-sm max-w-xs leading-relaxed">{errorMsg}</p>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;
