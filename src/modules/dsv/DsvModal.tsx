// ============================================================================
// CISCO AUTOMATED - DSV MODAL (STRICT REAL-TIME VALIDATION & 48 COLS EXPORT)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck,
  X,
  AlertTriangle,
  Download,
  Building,
  Hash,
  Sparkles,
  CheckCircle2,
  MapPin,
  IdCard,
} from 'lucide-react';
import { RawBomParsedResult } from './dsvBomParser';
import { DsvModalFormData, SkuCategoryType, Dsv48LineItem } from './types';
import {
  transformRawBomToDsv,
  generateCleanDsvWorkbook,
  isZeroValueBomItem,
  getFormattedDsvDate,
  generateDsvFilename,
  DsvDiscrepancy,
} from './dsvEngine';
import { DsvDiscrepancyModal } from './DsvDiscrepancyModal';

interface DsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawBom: RawBomParsedResult | null;
  overrides?: Record<string, SkuCategoryType>;
  onSuccess?: (filepathOrFilename: string) => void;
  initialFormData?: Partial<DsvModalFormData>;
}

export const DsvModal: React.FC<DsvModalProps> = ({
  isOpen,
  onClose,
  rawBom,
  overrides = {},
  onSuccess,
  initialFormData,
}) => {
  const [formData, setFormData] = useState<DsvModalFormData>({
    so: '',
    po: '',
    dealId: '',
    partnerId: '',
    endCustomerAddress: 'Chile',
    partnerName: '',
    endCustomerName: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDiscrepancies, setPendingDiscrepancies] = useState<DsvDiscrepancy[]>([]);
  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState(false);

  // Pre-fill Deal ID, Partner Name and End Customer Name when modal opens
  useEffect(() => {
    if (isOpen && rawBom) {
      const initialDealId = (rawBom.dealIdFromBom || rawBom.authorizationNumber || '')
        .replace(/\D/g, '')
        .slice(0, 8);
      const initialPartner = rawBom.resellerName || (rawBom.items && rawBom.items[0]?.resellerName) || '';
      const initialEndUser = rawBom.endUserName || (rawBom.items && rawBom.items[0]?.endUserName) || '';

      setFormData({
        so: initialFormData?.so || '',
        po: initialFormData?.po || '',
        dealId: initialFormData?.dealId || initialDealId,
        partnerId: initialFormData?.partnerId || '',
        endCustomerAddress: initialFormData?.endCustomerAddress || 'Chile',
        partnerName: initialFormData?.partnerName || initialPartner,
        endCustomerName: initialFormData?.endCustomerName || initialEndUser,
      });
      setSuccessMessage(null);
      setIsGenerating(false);
    }
  }, [isOpen, rawBom, initialFormData]);

  // Reactive standardized filename: NumerodeDEAL_DSV_partner_clientefinal_fecha.xlsx
  const previewFilename = useMemo(() => {
    if (!rawBom) return '';
    return generateDsvFilename(
      formData.dealId || rawBom.dealIdFromBom || rawBom.authorizationNumber,
      formData.partnerName || rawBom.resellerName,
      formData.endCustomerName || rawBom.endUserName
    );
  }, [formData.dealId, formData.partnerName, formData.endCustomerName, rawBom]);

  // Statistics of items
  const stats = useMemo(() => {
    if (!rawBom || !rawBom.items) return { valid: 0, discarded: 0, total: 0 };
    let valid = 0;
    let discarded = 0;
    rawBom.items.forEach((item) => {
      if (isZeroValueBomItem(item)) {
        discarded++;
      } else {
        valid++;
      }
    });
    return { valid, discarded, total: rawBom.items.length };
  }, [rawBom]);

  // Validation checks according to Section 7
  const isSoValid = formData.so.length === 9;
  const isPoValid = formData.po.length === 6;
  const isDealIdValid = formData.dealId.length === 8;
  const isPartnerIdValid = formData.partnerId.trim().length > 0;
  const isAddressValid = formData.endCustomerAddress.trim().length > 0;

  const missingWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!isSoValid) {
      warnings.push(`SO Number debe tener exactamente 9 dígitos numéricos (actual: ${formData.so.length}/9)`);
    }
    if (!isPoValid) {
      warnings.push(`PO Number debe tener exactamente 6 dígitos numéricos (actual: ${formData.po.length}/6)`);
    }
    if (!isDealIdValid) {
      warnings.push(`Deal ID debe tener exactamente 8 dígitos numéricos (actual: ${formData.dealId.length}/8)`);
    }
    if (!isPartnerIdValid) {
      warnings.push('Partner Identification está vacío');
    }
    if (!formData.partnerName?.trim()) {
      warnings.push('Partner / Reseller Name está vacío');
    }
    if (!formData.endCustomerName?.trim()) {
      warnings.push('End Customer Name (Cliente Final) está vacío');
    }
    if (!isAddressValid) {
      warnings.push('End Customer Address 1 está vacío');
    }
    return warnings;
  }, [isSoValid, isPoValid, isDealIdValid, isPartnerIdValid, isAddressValid, formData]);

  if (!isOpen || !rawBom) return null;

  // Handlers with strict numeric sanitization
  const handleNumericChange = (field: 'so' | 'po' | 'dealId', rawVal: string, maxLen: number) => {
    const numericOnly = rawVal.replace(/\D/g, '').slice(0, maxLen);
    setFormData((prev) => ({
      ...prev,
      [field]: numericOnly,
    }));
  };

  const handleTextChange = (
    field: 'partnerId' | 'endCustomerAddress' | 'partnerName' | 'endCustomerName',
    rawVal: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: rawVal,
    }));
  };

  const handleExportDsv = async () => {
    if (!rawBom) return;

    // 1. Transform raw BOM to 48 columns DSV with overrides and updated formData
    const summary = transformRawBomToDsv(rawBom, formData, overrides, false);

    // 2. Conciliación Financiera: Si hay discrepancias activas (> $0.02 USD), retener descarga y mostrar modal
    const discrepancies = summary.rows
      .filter((it) => it.discrepancy !== null && it.discrepancy !== undefined)
      .map((it) => it.discrepancy!);

    if (discrepancies.length > 0) {
      setPendingDiscrepancies(discrepancies);
      setIsDiscrepancyModalOpen(true);
      return;
    }

    // 3. Si no hay discrepancias, ejecutar descarga directamente
    await executeExport(summary.rows);
  };

  const handleResolveDiscrepancy = async (decision: 'BOM' | 'MATH') => {
    setIsDiscrepancyModalOpen(false);
    if (!rawBom) return;

    const summary = transformRawBomToDsv(rawBom, formData, overrides, false);

    if (decision === 'MATH') {
      // Sobrescribir colK con calculatedPrice en las filas afectadas
      summary.rows.forEach((it) => {
        if (it.discrepancy) {
          it.reportedNetPrice = it.discrepancy.calculatedPrice;
        }
      });
    }

    await executeExport(summary.rows);
  };

  const handleCancelDiscrepancy = () => {
    setIsDiscrepancyModalOpen(false);
    setIsGenerating(false);
  };

  const executeExport = async (rows: Dsv48LineItem[]) => {
    setIsGenerating(true);
    setSuccessMessage(null);

    try {
      const outputFilename =
        previewFilename ||
        generateDsvFilename(
          formData.dealId,
          formData.partnerName,
          formData.endCustomerName
        );

      // Generate clean Excel with 48 columns
      const { buffer } = await generateCleanDsvWorkbook(rows, outputFilename);

      // Desktop PyWebView vs Web Browser handling
      const isDesktop = Boolean((window as any).pywebview?.api?.save_estimate_structured);

      if (isDesktop) {
        try {
          const uint8 = new Uint8Array(buffer);
          let binary = '';
          const len = uint8.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64Data = btoa(binary);

          const res = await (window as any).pywebview.api.save_estimate_structured(
            base64Data,
            outputFilename,
            'Cisco DSV',
            'Plantillas DSV'
          );

          if (res && res.success) {
            setSuccessMessage(`✅ Archivo DSV guardado en: ${res.filepath}`);
            if (onSuccess) onSuccess(res.filepath);
          } else {
            triggerBlobDownload(buffer, outputFilename);
            setSuccessMessage(`✅ Descargado: ${outputFilename}`);
            if (onSuccess) onSuccess(outputFilename);
          }
        } catch (desktopErr) {
          triggerBlobDownload(buffer, outputFilename);
          setSuccessMessage(`✅ Descargado: ${outputFilename}`);
          if (onSuccess) onSuccess(outputFilename);
        }
      } else {
        triggerBlobDownload(buffer, outputFilename);
        setSuccessMessage(`✅ Descargado exitosamente en tu carpeta de Descargas: ${outputFilename}`);
        if (onSuccess) onSuccess(outputFilename);
      }
    } catch (err: any) {
      console.error('Error generando DSV:', err);
      alert(`Error al generar archivo DSV: ${err?.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerBlobDownload = (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Generador Oficial DSV Cisco
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">
                  48 Columnas (A - AV)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Formulario de Validación de Datos Manuales y Exportación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-200 custom-scrollbar">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-center">
            <div className="p-2 rounded-xl bg-slate-900/60">
              <span className="text-[11px] text-slate-400 block">Total en BOM</span>
              <strong className="text-sm font-bold text-white">{stats.total}</strong>
            </div>
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
              <span className="text-[11px] text-emerald-300 block">Válidos (List Price &gt; $0)</span>
              <strong className="text-sm font-bold text-emerald-400">{stats.valid}</strong>
            </div>
            <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/20">
              <span className="text-[11px] text-rose-300 block">Descartados ($0.00)</span>
              <strong className="text-sm font-bold text-rose-400">{stats.discarded}</strong>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-400" />
              Datos Requeridos con Validación en Tiempo Real
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. SO Number (Col C) - Exact 9 numeric digits */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Distributor SO Number (Col C) <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      isSoValid ? 'text-emerald-400 bg-emerald-950/60' : 'text-amber-400 bg-amber-950/60'
                    }`}
                  >
                    {formData.so.length}/9 dígitos
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 120542228"
                    value={formData.so}
                    onChange={(e) => handleNumericChange('so', e.target.value, 9)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Exactamente 9 dígitos numéricos</p>
              </div>

              {/* 2. PO Number (Col R) - Exact 6 numeric digits */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Reseller PO Number (Col R) <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      isPoValid ? 'text-emerald-400 bg-emerald-950/60' : 'text-amber-400 bg-amber-950/60'
                    }`}
                  >
                    {formData.po.length}/6 dígitos
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 327649"
                    value={formData.po}
                    onChange={(e) => handleNumericChange('po', e.target.value, 6)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Exactamente 6 dígitos numéricos</p>
              </div>

              {/* 3. Deal ID (Col L) - Exact 8 numeric digits */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Deal ID (Col L) <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      isDealIdValid ? 'text-emerald-400 bg-emerald-950/60' : 'text-amber-400 bg-amber-950/60'
                    }`}
                  >
                    {formData.dealId.length}/8 dígitos
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 85890781"
                    value={formData.dealId}
                    onChange={(e) => handleNumericChange('dealId', e.target.value, 8)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Exactamente 8 dígitos numéricos (del BOM)</p>
              </div>

              {/* 4. Partner Identification (Col U) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Partner Identification (Col U) <span className="text-rose-400">*</span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                    <IdCard className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Ej. XCL005331"
                    value={formData.partnerId}
                    onChange={(e) => handleTextChange('partnerId', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Buyer/Reseller Partner Identification</p>
              </div>

              {/* 5. Partner / Reseller Name (Col T & AI) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Partner / Reseller Name (Col T y AI) <span className="text-rose-400">*</span>
                  </label>
                  {Boolean(rawBom.resellerName && formData.partnerName === rawBom.resellerName) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">
                      Auto-detectado del BOM
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                    <Building className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Ej. LOGICALIS CHILE S.A."
                    value={formData.partnerName || ''}
                    onChange={(e) => handleTextChange('partnerName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors font-medium"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Canal / Reseller (asigna Col T, Col AI Ship-To y nombre archivo)</p>
              </div>

              {/* 6. End Customer Name (Col AP) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    End Customer / Cliente Final (Col AP) <span className="text-rose-400">*</span>
                  </label>
                  {Boolean(rawBom.endUserName && formData.endCustomerName === rawBom.endUserName) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">
                      Auto-detectado del BOM
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                    <Building className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Ej. BANCO DE CHILE"
                    value={formData.endCustomerName || ''}
                    onChange={(e) => handleTextChange('endCustomerName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors font-medium"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Cliente final del Deal (asigna Col AP y nombre archivo)</p>
              </div>
            </div>

            {/* 7. End Customer Address 1 (Col AQ) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                End Customer Address 1 (Col AQ) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">
                  <MapPin className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Ej. Chile o Dirección con comas"
                  value={formData.endCustomerAddress}
                  onChange={(e) => handleTextChange('endCustomerAddress', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                Acepta comas libremente. Se sanitiza automáticamente con .trim() al exportar.
              </p>
            </div>

            {/* Standardized Live Filename Preview Card */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-blue-900/40 shadow-inner space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Nombre de Archivo a Descargar (Estandarizado)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  NumerodeDEAL_DSV_partner_clientefinal_fecha.xlsx
                </span>
              </div>
              <div className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono text-emerald-400 font-bold break-all select-all">
                <span>{previewFilename}</span>
              </div>
            </div>
          </div>

          {/* Non-Blocking Warning Card */}
          {missingWarnings.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start space-x-3 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold text-amber-300 block">
                  Advertencias de Validación:
                </strong>
                <ul className="list-disc list-inside text-[11px] text-amber-200/80 space-y-0.5">
                  {missingWarnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <button
            onClick={handleExportDsv}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Generando Matriz DSV (48 Columnas)...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar Plantilla DSV (48 Columnas)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Financial Discrepancy Resolution Modal */}
      <DsvDiscrepancyModal
        isOpen={isDiscrepancyModalOpen}
        discrepancies={pendingDiscrepancies}
        onResolve={handleResolveDiscrepancy}
        onCancel={handleCancelDiscrepancy}
      />
    </div>
  );
};
