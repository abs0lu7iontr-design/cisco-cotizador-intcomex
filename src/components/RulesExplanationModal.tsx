// ============================================================================
// CISCO AUTOMATED v2.1 - BUSINESS RULES & ARCHITECTURE SPECIFICATIONS
// ============================================================================

import React from 'react';
import { X, CheckCircle2, ShieldAlert, FileText, Truck, DollarSign, Calculator, Sparkles, Layers } from 'lucide-react';

interface RulesExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesExplanationModal: React.FC<RulesExplanationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-800 overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Reglas de Negocio & Especificaciones &bull; Cisco Automated v2.1
              </h2>
              <p className="text-xs text-slate-400">
                Automatización integral de cotizaciones Cisco CCW para Intcomex Chile
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1: 3-State Cycle */}
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <Layers className="w-4 h-4" />
                <span>1. Sistema de 3 Reglas Cíclicas</span>
              </div>
              <ul className="space-y-1.5 text-slate-400 text-[11px]">
                <li>
                  <strong className="text-white">&bull; Equipo Estándar:</strong> +7% Internación, +5% Margen.
                </li>
                <li>
                  <strong className="text-amber-300">&bull; Intangibles (SW/Lic):</strong> 0% Internación, +5% Margen.
                </li>
                <li>
                  <strong className="text-purple-300">&bull; Arancel '=':</strong> +7% Internación, +6% Arancel, +5% Margen.
                </li>
                <li className="text-indigo-300 pt-1">
                  <em>Alterna con clic derecho sobre cualquier fila en la tabla interactiva o vista de Excel.</em>
                </li>
              </ul>
            </div>

            {/* Rule 2: Lead Times */}
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <Truck className="w-4 h-4" />
                <span>2. Tiempos de Entrega (Lead Time)</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Transformación inteligente de días calendario a semanas laborales con buffer de internación:
              </p>
              <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-300 border border-slate-800 space-y-1">
                <div>• Días &le; 2 &rarr; Celda en blanco (Stock inmediato)</div>
                <div>• Total 3 semanas (base + 2 sem) &rarr; <span className="text-amber-300 font-bold">"4 semanas a pedido"</span></div>
                <div>• Total 4 semanas (base + 2 sem) &rarr; <span className="text-cyan-300 font-bold">"4 a 5 semanas a pedido"</span></div>
                <div>• Total $\ge$ 5 semanas &rarr; "X semanas a pedido"</div>
              </div>
            </div>

            {/* Rule 3: Single 14-Day Notice */}
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>3. Validez de Oferta Estricta (14 días)</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                La leyenda: <em>"Validez de la Oferta: Esta cotización tiene una validez de 14 días corridos a contar de su fecha de emisión."</em> se inyecta exactamente <strong>una sola vez</strong> en la esquina inferior izquierda del archivo exportado.
              </p>
            </div>

            {/* Rule 4: RBAC & PM Role */}
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-purple-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>4. RBAC & Roles (PM por Defecto)</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Usuarios asignados al rol <strong>Product Manager (PM)</strong> por defecto, con control total de roles administrado por <strong>Mauricio Skill (mskill)</strong> y contraseñas cifradas con algoritmo seguro bcrypt.
              </p>
            </div>
          </div>

          {/* Architecture Box */}
          <div className="p-4 bg-indigo-950/30 rounded-2xl border border-indigo-500/20 text-indigo-200 space-y-1 text-xs">
            <span className="font-bold text-white block">Arquitectura Desacoplada & Shared Core (v2.1)</span>
            <p className="text-slate-400 text-[11px]">
              Toda la lógica de negocio vive en <code className="text-indigo-300">src/core/</code>, compartida directamente entre la versión Web y la Aplicación de Escritorio nativa, con mallas de seguridad Error Boundary y preparación completa para despliegue en la nube (Docker / VPS / Kubernetes).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
