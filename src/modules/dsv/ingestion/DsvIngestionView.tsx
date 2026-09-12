// ============================================================================
// CISCO AUTOMATED v2.1 - ONEDRIVE DSV INGESTION & CONSOLIDATION VIEW
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
} from 'lucide-react';
import { scanOneDriveDsvDirectory, scanFileListDsvDirectory } from './dsvFolderConnector';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);

  const fallbackFolderInputRef = useRef<HTMLInputElement>(null);

  const handleConnectFolder = async () => {
    setErrorMessage(null);
    setIsScanning(true);

    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const consolidated = await scanOneDriveDsvDirectory();
        setRecords(consolidated);
      } else {
        // Fallback para navegadores sin showDirectoryPicker
        fallbackFolderInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Error al escanear carpeta de OneDrive');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFallbackFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsScanning(true);
    setErrorMessage(null);
    try {
      const consolidated = await scanFileListDsvDirectory(e.target.files);
      setRecords(consolidated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar archivos de carpeta');
    } finally {
      setIsScanning(false);
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
      {/* Hidden input for folder fallback */}
      <input
        type="file"
        ref={fallbackFolderInputRef}
        onChange={handleFallbackFolderChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
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

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {onBackToManual && (
            <button
              onClick={onBackToManual}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Volver al Generador Manual
            </button>
          )}

          <button
            onClick={handleConnectFolder}
            disabled={isScanning}
            className="inline-flex items-center space-x-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Escaneando OneDrive...</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4" />
                <span>Conectar Carpeta OneDrive</span>
              </>
            )}
          </button>
        </div>
      </div>

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
            <span>Pendientes de Cruce</span>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Deal ID, PO, SO o Dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="READY">Solo Listos (READY)</option>
            <option value="PENDING_JORGE">Esperando Jorge (PO/SO)</option>
            <option value="PENDING_CISCO_BOM">Falta BOM Cisco</option>
            <option value="PENDING_ADDRESS">Falta Dirección</option>
            <option value="INVALID_FORMAT">Formato Inválido</option>
          </select>
        </div>
      </div>

      {/* Main Consolidated Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
        {records.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white">No hay Deals cargados desde OneDrive</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Haz clic en <strong>"Conectar Carpeta OneDrive"</strong> para escanear las subcarpetas <code className="text-indigo-300">cisco/</code> y <code className="text-indigo-300">jorge/</code>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Deal ID (8 Dígitos)</th>
                  <th className="py-3.5 px-3">PO Jorge (6d)</th>
                  <th className="py-3.5 px-3">SO Jorge (9d)</th>
                  <th className="py-3.5 px-4">BOM Cisco</th>
                  <th className="py-3.5 px-4">Dirección Despacho</th>
                  <th className="py-3.5 px-3">Última Act.</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      No se encontraron Deals con el filtro aplicado.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const isReady = record.status === 'READY';
                    const hasBom = !!record.cisco?.bomFile;
                    const hasPo = !!record.jorge?.poNumber;
                    const hasSo = !!record.jorge?.soNumber;
                    const hasAddr = !!record.cisco?.address;

                    return (
                      <tr
                        key={record.dealId}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Deal ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                              {record.dealId}
                            </span>
                            <button
                              onClick={() => handleCopyDealId(record.dealId)}
                              className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                              title="Copiar Deal ID"
                            >
                              {copiedDealId === record.dealId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* PO */}
                        <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                          {hasPo ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                record.jorge!.poNumber.length === 6
                                  ? 'bg-blue-950/70 text-blue-300 border border-blue-800/40'
                                  : 'bg-rose-950/70 text-rose-300 border border-rose-800/40'
                              }`}
                            >
                              {record.jorge!.poNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No detectado</span>
                          )}
                        </td>

                        {/* SO */}
                        <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                          {hasSo ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                record.jorge!.soNumber.length === 9
                                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/40'
                                  : 'bg-rose-950/70 text-rose-300 border border-rose-800/40'
                              }`}
                            >
                              {record.jorge!.soNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No detectado</span>
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
                            <div className="flex items-start space-x-1.5 text-slate-300 max-w-[200px]" title={`${record.cisco!.address!.street}, ${record.cisco!.address!.city}, ${record.cisco!.address!.country}`}>
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
