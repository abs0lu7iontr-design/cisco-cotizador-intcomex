// ============================================================================
// CISCO AUTOMATED - MOBILE SHARE HELPER (WHATSAPP, EMAIL & SYSTEM SHEET)
// Uses Web Share API (navigator.share) with automatic clipboard fallback
// ============================================================================

export interface ShareQuoteData {
  clientName?: string;
  partnerName?: string;
  dealId?: string;
  itemsCount: number;
  totalUsd: string | number;
  totalClp?: string | number;
  marginPct?: string | number;
  fileName?: string;
  excelBuffer?: ArrayBuffer | Uint8Array;
}

export interface ShareResult {
  shared: boolean;
  method: 'native_share' | 'clipboard' | 'unsupported';
  message: string;
}

/**
 * Formats a clean executive text summary ready for WhatsApp or Mobile Email
 */
export function formatQuoteShareText(data: ShareQuoteData): string {
  const lines: string[] = [
    '🏢 *Cisco Automated | Intcomex Chile*',
    '📋 *Resumen de Cotización Comercial*',
    '--------------------------------------',
  ];

  if (data.clientName) {
    lines.push(`👤 *Cliente Final:* ${data.clientName}`);
  }
  if (data.partnerName) {
    lines.push(`🤝 *Partner / Reseller:* ${data.partnerName}`);
  }
  if (data.dealId) {
    lines.push(`🎯 *Deal ID:* ${data.dealId}`);
  }

  lines.push(`📦 *Líneas Cotizadas:* ${data.itemsCount}`);
  lines.push(`💵 *Total Venta USD:* US$ ${typeof data.totalUsd === 'number' ? data.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : data.totalUsd}`);

  if (data.totalClp) {
    lines.push(`🇨🇱 *Total Venta CLP:* $${typeof data.totalClp === 'number' ? Math.round(data.totalClp).toLocaleString('es-CL') : data.totalClp} CLP`);
  }

  if (data.marginPct !== undefined) {
    lines.push(`📈 *Margen Objetivo:* ${data.marginPct}%`);
  }

  lines.push('--------------------------------------');
  lines.push('⚡ Cotización procesada con Cisco Automated (Intcomex Chile)');
  lines.push('🌐 https://develop.cisco-automated.pages.dev');

  return lines.join('\n');
}

/**
 * Shares quote via native sheet (WhatsApp, Email, Telegram, AirDrop) or copies to clipboard
 */
export async function shareQuote(data: ShareQuoteData): Promise<ShareResult> {
  const shareText = formatQuoteShareText(data);
  const shareTitle = `Cotización Cisco - ${data.clientName || data.dealId || 'Intcomex'}`;

  // 1. Check if navigator.share is available
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // Try to attach Excel file if provided and supported
      let filesToShare: File[] | undefined = undefined;
      if (data.excelBuffer && typeof File !== 'undefined') {
        try {
          const fileName = data.fileName || `Cotizacion_Cisco_${data.dealId || 'Intcomex'}.xlsx`;
          const file = new File(
            [data.excelBuffer],
            fileName,
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
          );
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            filesToShare = [file];
          }
        } catch {
          // File creation fallback
        }
      }

      if (filesToShare && filesToShare.length > 0) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: filesToShare,
        });
      } else {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: 'https://develop.cisco-automated.pages.dev',
        });
      }

      return {
        shared: true,
        method: 'native_share',
        message: '¡Cotización compartida con éxito!',
      };
    } catch (err: any) {
      // User cancelled share dialog is not an error
      if (err?.name === 'AbortError') {
        return {
          shared: false,
          method: 'native_share',
          message: 'Compartir cancelado por el usuario.',
        };
      }
      // Fall through to clipboard
    }
  }

  // 2. Fallback: Copy formatted text to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      return {
        shared: true,
        method: 'clipboard',
        message: '¡Resumen copiado al portapapeles para pegar en WhatsApp o correo!',
      };
    }
  } catch {
    // Clipboard failed
  }

  return {
    shared: false,
    method: 'unsupported',
    message: 'No se pudo compartir automáticamente en este navegador.',
  };
}
