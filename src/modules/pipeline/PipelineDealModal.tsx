// ============================================================================
// CISCO AUTOMATED v2.8 - MODAL DE EDICIÓN Y CREACIÓN DE DEALS DEL PIPELINE
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  DollarSign,
  Calendar,
  Building,
  User,
  ShieldCheck,
  FileText,
  Percent,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  PipelineDealRecord,
  PIPELINE_PM_LIST,
  PIPELINE_VENTAS_GRUPOS,
  PIPELINE_STAGE_OPTIONS,
  MESES_ANO,
} from './pipelineTypes';
import { parseFlexibleNumber } from '../forecast/forecastService';

interface PipelineDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deal: PipelineDealRecord) => Promise<void>;
  initialDeal?: Partial<PipelineDealRecord> | null;
  mode?: 'create' | 'edit';
}

export function PipelineDealModal({
  isOpen,
  onClose,
  onSave,
  initialDeal,
  mode = 'create',
}: PipelineDealModalProps) {
  const [formData, setFormData] = useState<Partial<PipelineDealRecord>>({});
  const [moneyInputs, setMoneyInputs] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const defaultDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      const defaultMonth = MESES_ANO[now.getMonth()];

      const initialRec: Partial<PipelineDealRecord> = {
        id: initialDeal?.id || `deal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        fechaLevantamiento: initialDeal?.fechaLevantamiento || defaultDate,
        fechaCotizacion: initialDeal?.fechaCotizacion || defaultDate,
        marca: initialDeal?.marca || 'Cisco',
        pmResponsable: initialDeal?.pmResponsable || 'Raul Cuevas',
        partner: initialDeal?.partner || '',
        ejecutivoPartner: initialDeal?.ejecutivoPartner || '',
        endUser: initialDeal?.endUser || '',
        usd: initialDeal?.usd || 0,
        mesCierre: initialDeal?.mesCierre || defaultMonth,
        mesFacturacion: initialDeal?.mesFacturacion || '',
        porcentajeAvance: initialDeal?.porcentajeAvance !== undefined ? initialDeal.porcentajeAvance : 30,
        dealId: initialDeal?.dealId || '',
        productosSuscripciones: initialDeal?.productosSuscripciones || 0,
        servicios: initialDeal?.servicios || 0,
        meraki: initialDeal?.meraki || 0,
        am: initialDeal?.am || '',
        grupoVentas: initialDeal?.grupoVentas || 'Enterprise',
        notas: initialDeal?.notas || '',
        priceProtectionExpiryDate: initialDeal?.priceProtectionExpiryDate || '',
        sourceEstimateId: initialDeal?.sourceEstimateId,
        sourceEstimateVersion: initialDeal?.sourceEstimateVersion,
        createdAt: initialDeal?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };

      setFormData(initialRec);
      setMoneyInputs({
        usd: initialRec.usd != null && initialRec.usd > 0 ? String(initialRec.usd) : '',
        productosSuscripciones: initialRec.productosSuscripciones != null && initialRec.productosSuscripciones > 0 ? String(initialRec.productosSuscripciones) : '',
        servicios: initialRec.servicios != null && initialRec.servicios > 0 ? String(initialRec.servicios) : '',
        meraki: initialRec.meraki != null && initialRec.meraki > 0 ? String(initialRec.meraki) : '',
      });
      setValidationError(null);
    }
  }, [isOpen, initialDeal]);

  if (!isOpen) return null;

  const handleChange = (field: keyof PipelineDealRecord, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMoneyChange = (field: keyof PipelineDealRecord, rawText: string) => {
    setMoneyInputs((prev) => ({ ...prev, [field]: rawText }));
    const parsed = parseFlexibleNumber(rawText);
    setFormData((prev) => ({ ...prev, [field]: parsed }));
  };

  const handleAutoSumBreakdown = () => {
    const prod = parseFlexibleNumber(formData.productosSuscripciones);
    const serv = parseFlexibleNumber(formData.servicios);
    const meraki = parseFlexibleNumber(formData.meraki);
    const sum = Number((prod + serv + meraki).toFixed(2));
    handleChange('usd', sum);
    setMoneyInputs((prev) => ({ ...prev, usd: String(sum) }));
  };

  const handleAutoDistributeToProd = () => {
    const total = parseFlexibleNumber(formData.usd);
    const serv = parseFlexibleNumber(formData.servicios);
    const meraki = parseFlexibleNumber(formData.meraki);
    const diff = Math.max(0, Number((total - (serv + meraki)).toFixed(2)));
    handleChange('productosSuscripciones', diff);
    setMoneyInputs((prev) => ({ ...prev, productosSuscripciones: String(diff) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.partner?.trim()) {
      setValidationError('Por favor ingresa el nombre del Partner / Reseller.');
      return;
    }
    if (!formData.endUser?.trim()) {
      setValidationError('Por favor ingresa el Cliente Final (End User).');
      return;
    }
    if ((formData.usd || 0) <= 0) {
      setValidationError('El monto USD debe ser mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData as PipelineDealRecord);
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Error al guardar la oportunidad.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {mode === 'create' ? 'Nueva Oportunidad de Pipeline' : 'Editar Oportunidad de Pipeline'}
              </h3>
              <p className="text-xs text-slate-400">
                Registro oficial de negocio para forecasting comercial y seguimiento preventa Cisco.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-300 text-xs">
              ⚠️ {validationError}
            </div>
          )}

          {/* Fila 1: Marca, PM, Grupo de Ventas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Marca
              </label>
              <input
                type="text"
                value={formData.marca || 'Cisco'}
                onChange={(e) => handleChange('marca', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                PM Responsable *
              </label>
              <select
                value={formData.pmResponsable || 'Raul Cuevas'}
                onChange={(e) => handleChange('pmResponsable', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              >
                {PIPELINE_PM_LIST.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Grupo de Ventas
              </label>
              <select
                value={formData.grupoVentas || 'Enterprise'}
                onChange={(e) => handleChange('grupoVentas', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              >
                {PIPELINE_VENTAS_GRUPOS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 2: Partner, Ejecutivo Partner, End User */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Partner / Reseller *
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ej. Claro, Netics, Comtec"
                  value={formData.partner || ''}
                  onChange={(e) => handleChange('partner', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Ejecutivo Partner
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ej. Diego Lopez, Marissa Ulloa"
                  value={formData.ejecutivoPartner || ''}
                  onChange={(e) => handleChange('ejecutivoPartner', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                End User (Cliente Final) *
              </label>
              <input
                type="text"
                placeholder="ej. BHP, Codelco, Banco Estado"
                value={formData.endUser || ''}
                onChange={(e) => handleChange('endUser', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Fila 3: Total USD, % Avance, Mes de Cierre, Mes de Facturación */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Monto Total USD *
                </label>
                <span className="text-[10px] font-mono font-bold text-amber-300">
                  ${(formData.usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-amber-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ej. 107,849.40 o 107.849,40"
                  value={moneyInputs['usd'] ?? (formData.usd != null && formData.usd > 0 ? String(formData.usd) : '')}
                  onChange={(e) => handleMoneyChange('usd', e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/30 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-white focus:border-amber-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">
                % de Avance (Probabilidad)
              </label>
              <select
                value={formData.porcentajeAvance !== undefined ? formData.porcentajeAvance : 30}
                onChange={(e) => handleChange('porcentajeAvance', parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-bold"
              >
                {PIPELINE_STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mes de Cierre
              </label>
              <select
                value={formData.mesCierre || 'Noviembre'}
                onChange={(e) => handleChange('mesCierre', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              >
                {MESES_ANO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mes de Facturación
              </label>
              <select
                value={formData.mesFacturacion || ''}
                onChange={(e) => handleChange('mesFacturacion', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              >
                <option value="">(Sin asignar)</option>
                {MESES_ANO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 4: Desglose Tecnológico (Productos + Suscripciones, Servicios, Meraki) */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Desglose Tecnológico de la Oportunidad
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAutoSumBreakdown}
                  className="text-[11px] text-emerald-400 hover:text-emerald-200 flex items-center space-x-1 cursor-pointer transition-colors"
                  title="Sumar Prod+Sub + Servicios + Meraki y fijarlo como Monto Total USD"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-sumar a Monto Total USD</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoDistributeToProd}
                  className="text-[11px] text-indigo-400 hover:text-indigo-200 flex items-center space-x-1 cursor-pointer transition-colors"
                  title="Asignar la diferencia (Total USD - Servicios - Meraki) a Productos"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Asignar remanente a Productos</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    📦 Productos + Suscripciones (USD)
                  </label>
                  <span className="text-[10px] font-mono font-bold text-sky-400">
                    ${(formData.productosSuscripciones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="0.00"
                  value={moneyInputs['productosSuscripciones'] ?? (formData.productosSuscripciones != null && formData.productosSuscripciones > 0 ? String(formData.productosSuscripciones) : '')}
                  onChange={(e) => handleMoneyChange('productosSuscripciones', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    🛠️ Servicios SmartNet (USD)
                  </label>
                  <span className="text-[10px] font-mono font-bold text-purple-400">
                    ${(formData.servicios || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="0.00"
                  value={moneyInputs['servicios'] ?? (formData.servicios != null && formData.servicios > 0 ? String(formData.servicios) : '')}
                  onChange={(e) => handleMoneyChange('servicios', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    🌐 Meraki Cloud (USD)
                  </label>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    ${(formData.meraki || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="0.00"
                  value={moneyInputs['meraki'] ?? (formData.meraki != null && formData.meraki > 0 ? String(formData.meraki) : '')}
                  onChange={(e) => handleMoneyChange('meraki', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Fila 5: Deal ID Cisco, AM, Price Protection Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                # Registro Oportunidad Marca (Deal ID)
              </label>
              <input
                type="text"
                placeholder="ej. 85755154"
                value={formData.dealId || ''}
                onChange={(e) => handleChange('dealId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                AM Cisco / Intcomex
              </label>
              <input
                type="text"
                placeholder="ej. J. Galloni, D. Peña, P. Alvarez"
                value={formData.am || ''}
                onChange={(e) => handleChange('am', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                Price Protection Expiry Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="MM/DD/YYYY"
                  value={formData.priceProtectionExpiryDate || ''}
                  onChange={(e) => handleChange('priceProtectionExpiryDate', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-amber-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Fila 6: Fecha Levantamiento, Fecha Cotización */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Fecha de Levantamiento
              </label>
              <input
                type="text"
                placeholder="M/D/YYYY"
                value={formData.fechaLevantamiento || ''}
                onChange={(e) => handleChange('fechaLevantamiento', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Fecha de Cotización
              </label>
              <input
                type="text"
                placeholder="M/D/YYYY"
                value={formData.fechaCotizacion || ''}
                onChange={(e) => handleChange('fechaCotizacion', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Fila 7: Notas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Notas & Observaciones
            </label>
            <textarea
              rows={3}
              placeholder="Detalles sobre competencia, estado del Deal, hitos de aprobación o provisiones..."
              value={formData.notas || ''}
              onChange={(e) => handleChange('notas', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Guardando...' : 'Guardar Oportunidad'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
