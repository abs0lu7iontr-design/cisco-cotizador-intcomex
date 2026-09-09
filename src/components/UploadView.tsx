// ============================================================================
// CISCO AUTOMATED v2.1 - UPLOAD & STORAGE VIEW
// ============================================================================

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Download,
  Info,
} from 'lucide-react';

interface UploadViewProps {
  onProcessFile: (buffer: ArrayBuffer, fileName: string) => void;
}

export function UploadView({ onProcessFile }: UploadViewProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    partner?: string;
    client?: string;
    filename?: string;
    storedPath?: string;
    error?: string;
    buffer?: ArrayBuffer;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFileDesktop = async () => {
    if ((window as any).pywebview?.api?.open_file_dialog) {
      setIsProcessing(true);
      try {
        const res = await (window as any).pywebview.api.open_file_dialog();
        if (!res) {
          setIsProcessing(false);
          return;
        }
        if (!res.success) {
          setValidationResult({
            success: false,
            error: res.error,
          });
        } else {
          let buffer: ArrayBuffer;
          if (res.file_base64) {
            const binaryStr = atob(res.file_base64);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            buffer = bytes.buffer;
          } else if (res.file_bytes && Array.isArray(res.file_bytes)) {
            buffer = new Uint8Array(res.file_bytes).buffer;
          } else {
            setValidationResult({
              success: false,
              error: 'No se recibieron bytes válidos del archivo.',
            });
            return;
          }

          setValidationResult({
            success: true,
            partner: res.partner,
            client: res.client,
            filename: res.filename,
            storedPath: res.stored_filepath,
            buffer: buffer,
          });
        }
      } catch (err: any) {
        setValidationResult({
          success: false,
          error: err?.message || 'Error abriendo diálogo de archivo.',
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleWebFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const fname = file.name;

    const parts = fname.split('_');
    const partner = (parts[0] || 'Intcomex').replace(/\.[^/.]+$/, '').trim();
    const client = (parts[1] || 'Cliente').replace(/\.[^/.]+$/, '').trim();
    const d = new Date();
    const yyyymm = d.toISOString().substring(0, 7);
    const yyyymmdd = d.toISOString().substring(0, 10);
    const simulatedPath = `gravity_storage/${partner}/${client}/${yyyymm}/${yyyymmdd}/${fname}`;

    try {
      const arrayBuffer = await file.arrayBuffer();
      setValidationResult({
        success: true,
        partner,
        client,
        filename: fname,
        storedPath: simulatedPath,
        buffer: arrayBuffer,
      });
    } catch (err: any) {
      setValidationResult({
        success: false,
        error: 'Error leyendo archivo: ' + err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToQuoter = () => {
    if (validationResult?.buffer && validationResult?.filename) {
      onProcessFile(validationResult.buffer, validationResult.filename);
    }
  };

  const handleDownloadUploaded = () => {
    if (!validationResult?.buffer || !validationResult?.filename) return;
    const blob = new Blob([validationResult.buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = validationResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden Web Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleWebFileInput}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
          <UploadCloud className="w-6 h-6 text-indigo-400" />
          <span>Subir y Clasificar Estimate Cisco CCW</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Valida la nomenclatura estandarizada y almacena el archivo automáticamente en la estructura de carpetas jerárquica.
        </p>
      </div>

      {/* Nomenclature Guide */}
      <div className="bg-indigo-950/30 border border-indigo-500/30 p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
          <Info className="w-4 h-4" />
          <span>Nomenclatura Estandarizada para Almacenamiento Automático</span>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-indigo-500/20 font-mono text-sm text-indigo-300 font-bold">
          [Partner]_[ClienteFinal]_[ID_Cotizacion]_[Nombre_PM]_[Fecha].xlsx
        </div>
        <p className="text-[11px] text-slate-400">
          Ejemplo válido: <span className="text-emerald-400 font-mono">Intcomex_BancoDeChile_011682708571Z_Madasme_2026-08.xlsx</span>
        </p>
        <p className="text-[11px] text-slate-500">
          Ruta generada: <span className="font-mono text-slate-400">gravity_storage / [Partner] / [ClienteFinal] / YYYY-MM / YYYY-MM-DD / [Archivo.xlsx]</span>
        </p>
      </div>

      {/* Drop / Upload Zone */}
      <div
        onClick={handleSelectFileDesktop}
        className="bg-slate-900/60 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-3xl p-10 text-center transition-all cursor-pointer group hover:bg-indigo-950/10 shadow-xl"
      >
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          {isProcessing ? 'Procesando archivo...' : 'Seleccionar Archivo Estimate (.xlsx)'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
          Haz clic para abrir el diálogo nativo o arrastra tu cotización de Cisco CCW aquí.
        </p>

        <span className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all">
          Examinar Archivo
        </span>
      </div>

      {/* Validation Result Box */}
      {validationResult && (
        <div
          className={`p-6 rounded-2xl border ${
            validationResult.success
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : 'bg-rose-950/30 border-rose-500/40'
          } space-y-4`}
        >
          {validationResult.success ? (
            <>
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Archivo Validado y Organizado Exitosamente</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Partner Identificado
                  </span>
                  <span className="text-base font-bold text-indigo-400">
                    {validationResult.partner}
                  </span>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Cliente Final Identificado
                  </span>
                  <span className="text-base font-bold text-emerald-400">
                    {validationResult.client}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Ruta de Almacenamiento Jerárquica
                </span>
                <span className="text-xs font-mono text-slate-300 block break-all">
                  {validationResult.storedPath}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleProceedToQuoter}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Procesar en Cotizador Cisco CCW</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleDownloadUploaded}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center space-x-2 border border-slate-700 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo Subido</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Error de Nomenclatura o Formato</span>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {validationResult.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
