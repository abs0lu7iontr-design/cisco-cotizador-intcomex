// ============================================================================
// CISCO AUTOMATED - QUICK BOM INGEST MODAL
// Ingestión y extracción rápida desde texto plano, correos y portapapeles
// ============================================================================

import React, { useState } from 'react';
import {
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

interface ParsedIngestItem {
  partNumber: string;
  qty: number;
  netPrice: number;
  description: string;
}

interface QuickBomIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadIntoQuickCalc?: (item: { partNumber: string; qty: number; netPrice: number; description: string }) => void;
}

export const QuickBomIngestModal: React.FC<QuickBomIngestModalProps> = ({
  isOpen,
  onClose,
  onLoadIntoQuickCalc,
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedIngestItem[]>([]);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedItems([]);
      return;
    }

    const lines = text.split('\n');
    const results: ParsedIngestItem[] = [];

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.length < 3) return;

      // Buscar candidato a Part Number Cisco (contiene guiones o mayúsculas y números)
      // ej: C9200L-24P-4G-E, MR46-HW, CON-SNT-C9200L24, DNA-E, LIC-ENT-1YR
      const pnMatch = cleanLine.match(/([A-Z0-9]{2,}[A-Z0-9-]{2,}[A-Z0-9=])/i);
      if (!pnMatch) return;

      const partNumber = pnMatch[1].toUpperCase();

      // Buscar Cantidad (ej: "2 uds", "qty: 2", "cant 5", "x 3", o número al lado)
      let qty = 1;
      const qtyMatch = cleanLine.match(/(?:qty|cant|cantidad|x|\*)\s*[:=]?\s*(\d+)/i) ||
                       cleanLine.match(/\b(\d+)\s*(?:uds?|unidades?|pcs?|units?)\b/i);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10) || 1;
      }

      // Buscar Precio (ej: "$1,250.00", "USD 1250", "$ 500")
      let netPrice = 0;
      const priceMatch = cleanLine.match(/(?:\$|USD|usd)\s*([\d,.]+)/i) ||
                         cleanLine.match(/([\d,.]+)\s*(?:USD|usd|\$)/i);
      if (priceMatch) {
        const rawNum = priceMatch[1].replace(/,/g, '');
        netPrice = parseFloat(rawNum) || 0;
      }

      results.push({
        partNumber,
        qty,
        netPrice,
        description: cleanLine.replace(partNumber, '').slice(0, 50).trim(),
      });
    });

    setParsedItems(results);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleParse(text);
    } catch {
      // Fallback si no hay permiso de portapapeles
    }
  };

  const handleLoadFirstIntoCalc = (item: ParsedIngestItem) => {
    if (onLoadIntoQuickCalc) {
      onLoadIntoQuickCalc(item);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Ingreso Rápido desde Portapapeles / Texto</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  Quick Ingest
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pega texto libre de correos o mensajes de chat para detectar SKUs, cantidades y precios al instante.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input Area */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                Pegar texto con Part Numbers Cisco:
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Pegar del portapapeles</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="Ejemplo:&#10;C9200L-24P-4G-E (2 uds) $1250.00&#10;CON-SNT-C9200L24 x 2 $180&#10;MR46-HW cant: 5 USD 650"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Parsed Results */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Ítems Detectados ({parsedItems.length}):</span>
                <span className="text-emerald-400 text-[11px] font-mono">
                  Total Detectado: $
                  {parsedItems
                    .reduce((acc, it) => acc + it.qty * it.netPrice, 0)
                    .toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Part Number</th>
                      <th className="p-2.5 text-center">Cant.</th>
                      <th className="p-2.5 text-right">Net Cisco</th>
                      <th className="p-2.5 text-right">Extendido</th>
                      <th className="p-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-indigo-300">{item.partNumber}</td>
                        <td className="p-2.5 text-center text-white">{item.qty}</td>
                        <td className="p-2.5 text-right text-slate-300">
                          ${item.netPrice.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right text-emerald-400 font-bold">
                          ${(item.qty * item.netPrice).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          {onLoadIntoQuickCalc && (
                            <button
                              type="button"
                              onClick={() => handleLoadFirstIntoCalc(item)}
                              className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-[10px] font-sans font-bold transition-colors cursor-pointer"
                              title="Simular en la Calculadora Rápida"
                            >
                              Simular &rarr;
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setRawText('');
              setParsedItems([]);
            }}
            className="px-3.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
