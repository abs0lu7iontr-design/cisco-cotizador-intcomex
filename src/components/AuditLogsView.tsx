// ============================================================================
// CISCO AUTOMATED v2.1 - AUDIT LOGS VIEW
// ============================================================================

import React, { useState, useEffect } from 'react';
import { AuditLog } from '../core/types';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      if ((window as any).pywebview?.api?.get_audit_logs) {
        const data = await (window as any).pywebview.api.get_audit_logs();
        if (data && Array.isArray(data)) {
          setLogs(data);
          return;
        }
      }

      setLogs([
        {
          id: 'log-1',
          username: 'mskill',
          action: 'LOGIN',
          details: 'Inicio de sesión exitoso en Cisco Automated v2.1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'log-2',
          username: 'mskill',
          action: 'MIGRATE_ROLES',
          details: 'Migración automática de usuarios no-admin al rol PM (Product Manager)',
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: 'log-3',
          username: 'mskill',
          action: 'UPLOAD_ESTIMATE',
          details: 'Archivo Intcomex_BancoDeChile_011682708571Z_Madasme_2026-08.xlsx procesado y almacenado',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'log-4',
          username: 'mskill',
          action: 'EXPORT_EXCEL',
          details: 'Cotización exportada con logo oficial y validez de 14 días',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'bg-emerald-950/70 text-emerald-400 border-emerald-700/40';
      case 'LOGOUT':
        return 'bg-slate-950 text-slate-400 border-slate-800';
      case 'LOGIN_FAILED':
        return 'bg-rose-950/70 text-rose-300 border-rose-700/40';
      case 'UPLOAD_ESTIMATE':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-700/40';
      case 'EXPORT_EXCEL':
      case 'EXPORT_CSV':
        return 'bg-amber-950/70 text-amber-300 border-amber-700/40';
      case 'CREATE_USER':
      case 'RESET_PASSWORD':
      case 'UPDATE_USER_ROLE':
      case 'TOGGLE_USER_STATUS':
        return 'bg-purple-950/70 text-purple-300 border-purple-700/40';
      default:
        return 'bg-slate-950 text-slate-300 border-slate-800';
    }
  };

  const filtered = logs.filter((l) => {
    const q = searchTerm.toLowerCase();
    return (
      (l.username || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            <span>Registro de Auditoría &bull; Cisco Automated v2.1</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Historial de eventos de seguridad, cambios de roles, subidas y exportaciones.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar Logs</span>
        </button>
      </div>

      {/* Filter */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por usuario, acción o detalle..."
            className="w-full bg-slate-950 border border-slate-700/70 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Fecha y Hora</th>
                <th className="px-5 py-3.5">Usuario</th>
                <th className="px-5 py-3.5">Acción</th>
                <th className="px-5 py-3.5">Detalles del Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                    {isLoading ? 'Cargando registros...' : 'No hay registros de auditoría que coincidan.'}
                  </td>
                </tr>
              ) : (
                filtered.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.created_at ? log.created_at.substring(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold text-white font-mono">{log.username}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300 leading-relaxed max-w-xl break-words">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
