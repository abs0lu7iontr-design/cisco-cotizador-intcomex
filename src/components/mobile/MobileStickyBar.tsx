import React, { useState } from 'react';
import { Share2, Download, FileCheck, Check, Sparkles } from 'lucide-react';
import { shareQuote, ShareQuoteData } from '../../utils/mobileShareHelper';
import { useCiscoAutomatedStore } from '../../core/store';

interface MobileStickyBarProps {
  clientName?: string;
  dealId?: string;
  totalUsd: number;
  totalClp?: number;
  marginPct?: number;
  itemsCount: number;
  fileName?: string;
  onDownloadClick?: () => void;
  onDsvClick?: () => void;
  formatCurrency: (val: number) => string;
}

export const MobileStickyBar: React.FC<MobileStickyBarProps> = ({
  clientName,
  dealId,
  totalUsd,
  totalClp,
  marginPct,
  itemsCount,
  fileName,
  onDownloadClick,
  onDsvClick,
  formatCurrency,
}) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { isClientMode } = useCiscoAutomatedStore();

  const handleShare = async () => {
    const data: ShareQuoteData = {
      clientName,
      dealId,
      itemsCount,
      totalUsd,
      totalClp,
      marginPct,
      fileName,
    };

    const res = await shareQuote(data);
    setToastMsg(res.message);
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-2xl flex items-center justify-between border border-indigo-400/40 animate-in fade-in slide-in-from-top-4">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-white/80 hover:text-white">
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sticky Quick Bar for Mobile */}
      <div className="md:hidden sticky top-[61px] z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 p-2.5 mb-3 flex items-center justify-between gap-2 shadow-lg">
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block truncate">
            {clientName || (dealId ? `Deal: ${dealId}` : 'Cotización Activa')} ({itemsCount} ítems)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-black text-emerald-400 text-sm">
              {formatCurrency(totalUsd)}
            </span>
            {marginPct !== undefined && !isClientMode && (
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                ({marginPct}%)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            title="Compartir por WhatsApp o Correo"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-[10px]">Compartir</span>
          </button>

          {onDownloadClick && (
            <button
              type="button"
              onClick={onDownloadClick}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              title="Descargar Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[10px]">Excel</span>
            </button>
          )}

          {onDsvClick && (
            <button
              type="button"
              onClick={onDsvClick}
              className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-amber-600/30 transition-all cursor-pointer"
              title="Generar DSV"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span className="text-[10px]">DSV</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
