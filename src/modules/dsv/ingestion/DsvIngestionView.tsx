// ============================================================================
// CISCO AUTOMATED v2.1 - ONEDRIVE DSV INGESTION & DUAL-ENGINE CONSOLIDATION VIEW
// ============================================================================

import React, { useState, useRef } from 'react';
import {
  FolderSync,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  FileSpreadsheet,
  MapPin,
  FileText,
  Play,
  RefreshCw,
  Search,
  Filter,
  Check,
  Copy,
  Cpu,
} from 'lucide-react';
import { scanOneDriveDsvDirectory as motorClasico } from './dsvFolderConnector';
import { processFilesFromInput as motorAvanzado } from './emlWorkerConnector';
import { ConsolidatedDealRecord, ConsolidationStatus } from './types';

interface DsvIngestionViewProps {
  onGenerateDsvForRecord?: (record: ConsolidatedDealRecord) => void;
  onBackToManual?: () => void;
}

export const DsvIngestionView: React.FC<DsvIngestionViewProps> = ({
  onGenerateDsvForRecord,
  onBackToManual,
}) => {
  const [records, setRecords] = useState<ConsolidatedDealRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeMotor, setActiveMotor] = useState<'clasico' | 'avanzado' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);

  const hiddenFileInput = useRef<HTMLInputElement>(null);

  // Motor 1: Síncrono Original (showDirectoryPicker)
  const handleMotorClasico = async () => {
    setErrorMessage(null);
    setIsScanning(true);
    setActiveMotor('clasico');

    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const consolidated = await motorClasico();
        setRecords(consolidated);
      } else {
        // Fallback para navegadores sin showDirectoryPicker
        hiddenFileInput.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error en motor clásico', err);
        setErrorMessage(err.message || 'Error en motor clásico (showDirectoryPicker)');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Motor 2: Asíncrono V2 (Input Fallback + Web Workers + Zod)
  const handleMotorAvanzado = () => {
    setActiveMotor('avanzado');
    hiddenFileInput.current?.click();
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsScanning(true);
      setErrorMessage(null);
      try {
        const consolidated = await motorAvanzado(e.target.files);
        setRecords(consolidated);
      } catch (err: any) {
        console.error('Error en motor avanzado', err);
        setErrorMessage(err.message || 'Error al procesar archivos con Web Worker y Zod');
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleCopyDealId = (dealId: string) => {
    navigator.clipboard.writeText(dealId);
    setCopiedDealId(dealId);
    setTimeout(() => setCopiedDealId(null), 2000);
  };

  // Filtrado de registros
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.dealId.includes(searchTerm) ||
      (r.jorge?.poNumber && r.jorge.poNumber.includes(searchTerm)) ||
      (r.jorge?.soNumber && r.jorge.soNumber.includes(searchTerm)) ||
      (r.cisco?.address?.street && r.cisco.address.street.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Métricas
  const totalCount = records.length;
  const readyCount = records.filter((r) => r.status === 'READY').length;
  const pendingCount = records.filter((r) => r.status.startsWith('PENDING_')).length;
  const invalidCount = records.filter((r) => r.status === 'INVALID_FORMAT').length;

  const renderStatusBadge = (status: ConsolidationStatus, errors: string[]) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Listo para DSV</span>
          </span>
        );
      case 'PENDING_JORGE':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50 shadow-sm cursor-help"
            title={errors.join('\n')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Esperando PO/SO Jorge</span>
          </span>
        );
      case 'PENDING_CISCO_BOM':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50 shadow-sm cursor-help"
            title={errors.join('\n')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Falta BOM Cisco (.xls)</span>
          </span>
        );
      case 'PENDING_ADDRESS':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50 shadow-sm cursor-help"
            title={errors.join('\n')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Falta Dirección Correo</span>
          </span>
        );
      case 'INVALID_FORMAT':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/50 shadow-sm cursor-help"
            title={errors.join('\n')}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            <span>Formato Inválido</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden input for folder fallback / Motor Avanzado */}
      <input
        type="file"
        ref={hiddenFileInput}
        style={{ display: 'none' }}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={onFilesSelected}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FolderSync className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Ingesta OneDrive & Consolidación DSV</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                Aislamiento por Deal ID
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Escanea subcarpetas <code className="text-indigo-300">cisco/</code> (BOM y correos de cliente) y <code className="text-indigo-300">jorge/</code> (PO y SO) cruzando únicamente por Deal ID exacto de 8 dígitos.
            </p>
          </div>
        </div>

        {/* Action Controls - Doble Motor (A/B Architecture) */}
        <div className="flex flex-wrap items-center gap-3">
          {onBackToManual && (
            <button
              onClick={onBackToManual}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Volver al Generador Manual
            </button>
          )}

          {/* Motor 1: Síncrono Original (showDirectoryPicker) */}
          <button
            onClick={handleMotorClasico}
            disabled={isScanning}
            className="inline-flex items-center space-x-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50"
            title="Motor 1: API nativa showDirectoryPicker (Síncrono)"
          >
            {isScanning && activeMotor === 'clasico' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <FolderOpen className="w-4 h-4 text-slate-400" />
            )}
            <span>Escaneo Rápido (Local)</span>
          </button>

          {/* Motor 2: Asíncrono V2 (Input Fallback + Web Workers + Zod) */}
          <button
            onClick={handleMotorAvanzado}
            disabled={isScanning}
            className="inline-flex items-center space-x-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all cursor-pointer disabled:opacity-50"
            title="Motor 2: Web Worker en segundo plano + Validación Zod + Input Fallback"
          >
            {isScanning && activeMotor === 'avanzado' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Cpu className="w-4 h-4 text-indigo-200" />
            )}
            <span>Escaneo Profundo (SafeMode)</span>
          </button>
        </div>
      </div>

      {/* Active Motor Badge */}
      {activeMotor && records.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
          <span className="text-slate-400">Motor activo:</span>
          {activeMotor === 'clasico' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
              <FolderOpen className="w-3 h-3 text-slate-400" />
              <span>Motor 1: Escaneo Rápido (API Nativa)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-700/40 px-2 py-0.5 rounded-md">
              <Cpu className="w-3 h-3 text-indigo-400" />
              <span>Motor 2: Escaneo Profundo (Web Workers + Zod)</span>
            </span>
          )}
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Deals Detectados</p>
          <p className="text-2xl font-black text-white mt-1">{totalCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Listos para Generar</span>
          </p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{readyCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Incompletos / Pendientes</span>
          </p>
          <p className="text-2xl font-black text-amber-400 mt-1">{pendingCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Formato Inválido</span>
          </p>
          <p className="text-2xl font-black text-rose-400 mt-1">{invalidCount}</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por Deal ID, PO, SO o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="READY">Solo Listos (BOM + Jorge + Dirección)</option>
              <option value="PENDING_JORGE">Pendiente Jorge (Falta PO/SO)</option>
              <option value="PENDING_CISCO_BOM">Falta BOM Cisco</option>
              <option value="PENDING_ADDRESS">Falta Dirección</option>
              <option value="INVALID_FORMAT">Formato Inválido</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {records.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
              <FolderSync className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Ninguna carpeta escaneada aún</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Utiliza el botón <strong className="text-slate-200">"Escaneo Rápido (Local)"</strong> para seleccionar la carpeta raíz sincronizada de OneDrive, o <strong className="text-indigo-300">"Escaneo Profundo (SafeMode)"</strong> para procesar con Web Workers y validación estricta Zod.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-slate-800 bg-slate-950/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Deal ID</th>
                  <th className="py-3 px-4">PO Number (6 Dig)</th>
                  <th className="py-3 px-4">SO Number (9 Dig)</th>
                  <th className="py-3 px-4">BOM Cisco (.xls)</th>
                  <th className="py-3 px-4">Dirección Despacho</th>
                  <th className="py-3 px-3">Última Actualización</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                      No se encontraron registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const isReady = record.status === 'READY';
                    const hasBom = Boolean(record.cisco?.bomFile);
                    const hasAddr = Boolean(record.cisco?.address?.street);

                    return (
                      <tr
                        key={record.dealId}
                        className="hover:bg-slate-900/60 transition-colors group"
                      >
                        {/* Deal ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-indigo-400">#</span>
                            <span>{record.dealId}</span>
                            <button
                              onClick={() => handleCopyDealId(record.dealId)}
                              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
                              title="Copiar Deal ID"
                            >
                              {copiedDealId === record.dealId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* PO */}
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {record.jorge?.poNumber ? (
                            <span className="text-slate-200 font-semibold">{record.jorge.poNumber}</span>
                          ) : (
                            <span className="text-slate-600 italic">No detectado</span>
                          )}
                        </td>

                        {/* SO */}
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {record.jorge?.soNumber ? (
                            <span className="text-slate-200 font-semibold">{record.jorge.soNumber}</span>
                          ) : (
                            <span className="text-slate-600 italic">No detectado</span>
                          )}
                        </td>

                        {/* BOM */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {hasBom ? (
                            <div className="flex items-center space-x-1.5 text-emerald-400" title={record.cisco!.bomFile!.fileName}>
                              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[140px] text-xs">
                                {record.cisco!.bomFile!.fileName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-500 italic flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Falta BOM</span>
                            </span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3.5 px-4">
                          {hasAddr ? (
                            <div className="flex items-start space-x-1.5 text-slate-300 max-w-[200px]" title={record.cisco!.address!.street}>
                              <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                              <span className="truncate text-xs">
                                {record.cisco!.address!.street}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Sin dirección</span>
                          )}
                        </td>

                        {/* Last Updated */}
                        <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>
                              {new Date(record.lastUpdated).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderStatusBadge(record.status, record.validationErrors)}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => onGenerateDsvForRecord && onGenerateDsvForRecord(record)}
                            disabled={!isReady}
                            className={`inline-flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                              isReady
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                            }`}
                            title={
                              isReady
                                ? 'Generar plantilla DSV oficial de 48 columnas'
                                : record.validationErrors.join(', ') || 'Incompleto'
                            }
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Generar DSV</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
