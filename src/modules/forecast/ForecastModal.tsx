// ============================================================================
// CISCO AUTOMATED v2.9 - MODAL DE EDICIÓN Y CREACIÓN DE FORECAST (36 COLUMNAS)
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
  Layers,
  Sparkles,
  AlertTriangle,
  Clock,
  Briefcase,
  Truck,
  Hash,
} from 'lucide-react';
import {
  ForecastRecord,
  FORECAST_PM_LIST,
  FORECAST_BODEGA_OPTIONS,
  FORECAST_CREDIT_STATUSES,
} from './forecastTypes';
import { parseFlexibleNumber } from './forecastService';

interface ForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ForecastRecord) => Promise<void>;
  initialRecord?: Partial<ForecastRecord> | null;
  mode?: 'create' | 'edit';
}

type ModalTab = 'comercial' | 'montos' | 'cisco_dsv' | 'operaciones' | 'casos';

export function ForecastModal({
  isOpen,
  onClose,
  onSave,
  initialRecord,
  mode = 'create',
}: ForecastModalProps) {
  const [formData, setFormData] = useState<Partial<ForecastRecord>>({});
  const [moneyInputs, setMoneyInputs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ModalTab>('comercial');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const defaultDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      const rec = {
        id: initialRecord?.id || `FC-${Date.now().toString().slice(-4)}`,
        fechaLevantamiento: initialRecord?.fechaLevantamiento || defaultDate,
        fechaCotizacion: initialRecord?.fechaCotizacion || defaultDate,
        marca: initialRecord?.marca || 'CISCO',
        pmResponsable: initialRecord?.pmResponsable || 'Raul Cuevas',
        partner: initialRecord?.partner || '',
        ejecutivoPartner: initialRecord?.ejecutivoPartner || '',
        endUser: initialRecord?.endUser || '',
        usdIntcomex: initialRecord?.usdIntcomex || 0,
        emailEjecutivoPartner: initialRecord?.emailEjecutivoPartner || '',
        mesFacturacion: initialRecord?.mesFacturacion || '',
        emailClienteFinal: initialRecord?.emailClienteFinal || '',
        detalleProductos: initialRecord?.detalleProductos || '',
        oc: initialRecord?.oc || '',
        deal: initialRecord?.deal || '',
        productos: initialRecord?.productos || 0,
        suscripciones: initialRecord?.suscripciones || 0,
        servicios: initialRecord?.servicios || 0,
        meraki: initialRecord?.meraki || 0,
        am: initialRecord?.am || '',
        grupoVentas: initialRecord?.grupoVentas || 'Top Volume',
        observacion: initialRecord?.observacion || '',
        dsvSubmission: initialRecord?.dsvSubmission || '',
        po: initialRecord?.po || '',
        so: initialRecord?.so || '',
        submittedDate: initialRecord?.submittedDate || '',
        clienteCisco: initialRecord?.clienteCisco || '',
        promotionAuthorizationNumber: initialRecord?.promotionAuthorizationNumber || '',
        endCustomerName: initialRecord?.endCustomerName || initialRecord?.endUser || '',
        endCustomerAddress1: initialRecord?.endCustomerAddress1 || '',
        numeroVenta: initialRecord?.numeroVenta || '',
        bodega: initialRecord?.bodega || 'E1',
        caso: initialRecord?.caso || '',
        priceProtectionExpiryDate: initialRecord?.priceProtectionExpiryDate || '',
        credit: initialRecord?.credit || 'Aprobado',
        nuevoCaso: initialRecord?.nuevoCaso || '',
        confirmacionCredito: initialRecord?.confirmacionCredito || '',
        createdAt: initialRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setFormData(rec);
      setMoneyInputs({
        usdIntcomex: rec.usdIntcomex ? String(rec.usdIntcomex) : '',
        productos: rec.productos ? String(rec.productos) : '',
        suscripciones: rec.suscripciones ? String(rec.suscripciones) : '',
        servicios: rec.servicios ? String(rec.servicios) : '',
        meraki: rec.meraki ? String(rec.meraki) : '',
      });
      setActiveTab('comercial');
      setValidationError(null);
    }
  }, [isOpen, initialRecord]);

  if (!isOpen) return null;

  const handleChange = (field: keyof ForecastRecord, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMoneyChange = (field: keyof ForecastRecord, rawText: string) => {
    setMoneyInputs((prev) => ({ ...prev, [field]: rawText }));
    const parsed = parseFlexibleNumber(rawText);
    setFormData((prev) => ({ ...prev, [field]: parsed }));
  };

  const handleSumTotals = () => {
    const sum =
      (formData.productos || 0) +
      (formData.suscripciones || 0) +
      (formData.servicios || 0) +
      (formData.meraki || 0);
    const rounded = Number(sum.toFixed(2));
    handleChange('usdIntcomex', rounded);
    setMoneyInputs((prev) => ({ ...prev, usdIntcomex: String(rounded) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.partner?.trim()) {
      setActiveTab('comercial');
      setValidationError('El nombre del Partner es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData as ForecastRecord);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Error guardando registro de Forecast');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {mode === 'create' ? 'Nuevo Registro de Forecast' : `Editar Registro: ${formData.id}`}
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  36 Columnas
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Estructura oficial Intcomex con cruce directo CCW, BO y DSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('comercial')}
            className={`px-3 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'comercial'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            1. Datos Comerciales
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('montos')}
            className={`px-3 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'montos'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            2. Montos & BOM
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cisco_dsv')}
            className={`px-3 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'cisco_dsv'
                ? 'bg-slate-800 text-sky-400 border-t-2 border-sky-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            3. Cisco CCW & DSV
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operaciones')}
            className={`px-3 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'operaciones'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            4. Facturación & Logística
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('casos')}
            className={`px-3 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'casos'
                ? 'bg-slate-800 text-amber-400 border-t-2 border-amber-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            5. Casos & Recordatorios
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {validationError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* TAB 1: COMERCIAL */}
          {activeTab === 'comercial' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  1. Fecha de Levantamiento
                </label>
                <input
                  type="text"
                  value={formData.fechaLevantamiento || ''}
                  onChange={(e) => handleChange('fechaLevantamiento', e.target.value)}
                  placeholder="DD-MM-YYYY"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  2. Fecha de Cotización
                </label>
                <input
                  type="text"
                  value={formData.fechaCotizacion || ''}
                  onChange={(e) => handleChange('fechaCotizacion', e.target.value)}
                  placeholder="DD-MM-YYYY"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  3. Marca
                </label>
                <input
                  type="text"
                  value={formData.marca || 'CISCO'}
                  onChange={(e) => handleChange('marca', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  4. PM Responsable
                </label>
                <select
                  value={formData.pmResponsable || 'Raul Cuevas'}
                  onChange={(e) => handleChange('pmResponsable', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {FORECAST_PM_LIST.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  5. Partner / Reseller <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.partner || ''}
                  onChange={(e) => handleChange('partner', e.target.value)}
                  placeholder="Ej. Advisers TIC, Claro, Comtec"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  6. Ejecutivo Partner
                </label>
                <input
                  type="text"
                  value={formData.ejecutivoPartner || ''}
                  onChange={(e) => handleChange('ejecutivoPartner', e.target.value)}
                  placeholder="Nombre del KAM o contacto"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  7. End User (Cliente Final)
                </label>
                <input
                  type="text"
                  value={formData.endUser || ''}
                  onChange={(e) => {
                    handleChange('endUser', e.target.value);
                    if (!formData.endCustomerName) handleChange('endCustomerName', e.target.value);
                  }}
                  placeholder="Ej. SAESA, BHP, Banco Estado"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  9. e-mail Ejecutivo Partner
                </label>
                <input
                  type="email"
                  value={formData.emailEjecutivoPartner || ''}
                  onChange={(e) => handleChange('emailEjecutivoPartner', e.target.value)}
                  placeholder="contacto@partner.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  11. e-mail Cliente Final
                </label>
                <input
                  type="email"
                  value={formData.emailClienteFinal || ''}
                  onChange={(e) => handleChange('emailClienteFinal', e.target.value)}
                  placeholder="cliente@enduser.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  19. Cisco Account Manager (AM)
                </label>
                <input
                  type="text"
                  value={formData.am || ''}
                  onChange={(e) => handleChange('am', e.target.value)}
                  placeholder="Ej. J. Galloni, P. Alvarez, L. Defranchis"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  20. Grupo de Ventas
                </label>
                <select
                  value={formData.grupoVentas || 'Top Volume'}
                  onChange={(e) => handleChange('grupoVentas', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Top Volume">Top Volume</option>
                  <option value="Enterprise">Enterprise</option>
                  <option value="Grupo3">Grupo3</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  21. Observación Comercial
                </label>
                <input
                  type="text"
                  value={formData.observacion || ''}
                  onChange={(e) => handleChange('observacion', e.target.value)}
                  placeholder="Ej. RR, Adjudicado, Regularizar compra"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: MONTOS & BOM */}
          {activeTab === 'montos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div>
                  <span className="text-xs font-semibold text-emerald-400">Total USD Intcomex</span>
                  <p className="text-xl font-bold text-white">
                    ${(formData.usdIntcomex || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSumTotals}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Sumar Subtotales
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      8. USD Intcomex (Monto Total)
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      ${(formData.usdIntcomex || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="text"
                      value={moneyInputs['usdIntcomex'] ?? (formData.usdIntcomex != null ? String(formData.usdIntcomex) : '')}
                      onChange={(e) => handleMoneyChange('usdIntcomex', e.target.value)}
                      placeholder="Ej. 107,849.40 o 107.849,40"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Acepta formato con puntos o comas (ej. $1.085.000 o 107,849.40)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    12. Detalle Productos (SKUs / BOM)
                  </label>
                  <input
                    type="text"
                    value={formData.detalleProductos || ''}
                    onChange={(e) => handleChange('detalleProductos', e.target.value)}
                    placeholder="Ej. C9200L-24P-4G-E, IR8340-K9"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      15. Productos (Hardware / SaaS)
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      ${(formData.productos || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="text"
                      value={moneyInputs['productos'] ?? (formData.productos != null ? String(formData.productos) : '')}
                      onChange={(e) => handleMoneyChange('productos', e.target.value)}
                      placeholder="Ej. 250,000.00 o 250.000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      16. Suscripciones
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      ${(formData.suscripciones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="text"
                      value={moneyInputs['suscripciones'] ?? (formData.suscripciones != null ? String(formData.suscripciones) : '')}
                      onChange={(e) => handleMoneyChange('suscripciones', e.target.value)}
                      placeholder="Ej. 45,000.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      17. Servicios (SmartNet / CX)
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      ${(formData.servicios || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="text"
                      value={moneyInputs['servicios'] ?? (formData.servicios != null ? String(formData.servicios) : '')}
                      onChange={(e) => handleMoneyChange('servicios', e.target.value)}
                      placeholder="Ej. 190,000.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      18. Meraki Cloud
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      ${(formData.meraki || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="text"
                      value={moneyInputs['meraki'] ?? (formData.meraki != null ? String(formData.meraki) : '')}
                      onChange={(e) => handleMoneyChange('meraki', e.target.value)}
                      placeholder="Ej. 12,500.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CISCO CCW & DSV */}
          {activeTab === 'cisco_dsv' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  14. Deal ID (# Registro Oportunidad CCW)
                </label>
                <input
                  type="text"
                  value={formData.deal || ''}
                  onChange={(e) => handleChange('deal', e.target.value)}
                  placeholder="Ej. 84365221 o PP-Fast-170729-01820"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  22. DSV Submission (N° Envío / Estado)
                </label>
                <input
                  type="text"
                  value={formData.dsvSubmission || ''}
                  onChange={(e) => handleChange('dsvSubmission', e.target.value)}
                  placeholder="Ej. 12316007 o Web"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  23. PO (Cisco Purchase Order)
                </label>
                <input
                  type="text"
                  value={formData.po || ''}
                  onChange={(e) => handleChange('po', e.target.value)}
                  placeholder="Ej. 329692"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  24. SO (Cisco Sales Order)
                </label>
                <input
                  type="text"
                  value={formData.so || ''}
                  onChange={(e) => handleChange('so', e.target.value)}
                  placeholder="Ej. 120636454 o 4977892"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  25. Submitted Date (Fecha Envío DSV)
                </label>
                <input
                  type="text"
                  value={formData.submittedDate || ''}
                  onChange={(e) => handleChange('submittedDate', e.target.value)}
                  placeholder="MM/DD/YYYY o DD-MM-YYYY"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  26. # Cliente Cisco (XCL / XCLN)
                </label>
                <input
                  type="text"
                  value={formData.clienteCisco || ''}
                  onChange={(e) => handleChange('clienteCisco', e.target.value)}
                  placeholder="Ej. XCLN17128, XCL002411"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  27. Promotion Authorization Number
                </label>
                <input
                  type="text"
                  value={formData.promotionAuthorizationNumber || ''}
                  onChange={(e) => handleChange('promotionAuthorizationNumber', e.target.value)}
                  placeholder="Ej. PP-Fast-170729-01820"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  28. End Customer Name (Según Cisco)
                </label>
                <input
                  type="text"
                  value={formData.endCustomerName || ''}
                  onChange={(e) => handleChange('endCustomerName', e.target.value)}
                  placeholder="Nombre de cliente registrado en Cisco"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  29. End Customer Address1
                </label>
                <input
                  type="text"
                  value={formData.endCustomerAddress1 || ''}
                  onChange={(e) => handleChange('endCustomerAddress1', e.target.value)}
                  placeholder="Dirección fiscal o de entrega"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* TAB 4: FACTURACIÓN & LOGÍSTICA */}
          {activeTab === 'operaciones' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  10. Mes de Facturación
                </label>
                <input
                  type="text"
                  value={formData.mesFacturacion || ''}
                  onChange={(e) => handleChange('mesFacturacion', e.target.value)}
                  placeholder="Ej. Octubre, Noviembre, o DD-MM-YYYY"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  13. OC (Orden de Compra Partner)
                </label>
                <input
                  type="text"
                  value={formData.oc || ''}
                  onChange={(e) => handleChange('oc', e.target.value)}
                  placeholder="Ej. 41537, 2903"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  30. Número de Venta (NV Intcomex)
                </label>
                <input
                  type="text"
                  value={formData.numeroVenta || ''}
                  onChange={(e) => handleChange('numeroVenta', e.target.value)}
                  placeholder="Ej. 4977892, 5005918"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  31. Bodega
                </label>
                <select
                  value={formData.bodega || 'E1'}
                  onChange={(e) => handleChange('bodega', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {FORECAST_BODEGA_OPTIONS.map((bod) => (
                    <option key={bod} value={bod}>
                      {bod} {bod === 'E1' ? '(Hardware / Mixto)' : bod === 'ED' ? '(Digital / Licencias)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  34. Credit (Estado de Crédito)
                </label>
                <select
                  value={formData.credit || 'Aprobado'}
                  onChange={(e) => handleChange('credit', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {FORECAST_CREDIT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  36. Confirmación Crédito
                </label>
                <input
                  type="text"
                  value={formData.confirmacionCredito || ''}
                  onChange={(e) => handleChange('confirmacionCredito', e.target.value)}
                  placeholder="Notas de aprobación o fecha de liberación"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: CASOS & RECORDATORIOS */}
          {activeTab === 'casos' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Motor de Recordatorios Activo:</strong> Las fechas de Price Protection se auditan automáticamente. Si la fecha expira o está dentro de 7 días, se generará una alerta prioritaria en la tabla y en el panel de recordatorios.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    33. Price Protection Expiry Date
                  </label>
                  <input
                    type="text"
                    value={formData.priceProtectionExpiryDate || ''}
                    onChange={(e) => handleChange('priceProtectionExpiryDate', e.target.value)}
                    placeholder="DD-MM-YYYY o MM/DD/YYYY"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    32. Caso (Ticket TAC / Logístico)
                  </label>
                  <input
                    type="text"
                    value={formData.caso || ''}
                    onChange={(e) => handleChange('caso', e.target.value)}
                    placeholder="Ej. CAS-88992-K o Regularizar compra"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    35. Nuevo Caso (Ticket de Seguimiento)
                  </label>
                  <input
                    type="text"
                    value={formData.nuevoCaso || ''}
                    onChange={(e) => handleChange('nuevoCaso', e.target.value)}
                    placeholder="Ej. Ticket seguimiento Cisco TAC / Trámite Aduanal"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <span className="text-xs text-slate-500">
              ID Registro: <span className="font-mono text-slate-400">{formData.id}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/30"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear Registro' : 'Actualizar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
