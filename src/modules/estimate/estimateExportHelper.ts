// ============================================================================
// CISCO AUTOMATED v2.1 - COMMERCIAL ESTIMATE EXPORT HELPER (PDF & EMAIL & SUMMARY)
// ============================================================================

import { EstimateHeaderInfo, EstimateLineItem, QuoteParameters } from '../../core/types';
import {
  checkIsIntangible,
  getMotherLineKey,
  isCloudSubscriptionSku,
} from '../../core/calculations';
import { INTCOMEX_LOGO_RAW_BASE64 } from '../../lib/intcomexLogoBase64';

export interface EstimateExportGroupingOptions {
  groupByLine?: boolean;
  selectedLine?: string; // 'ALL' or specific mother line e.g. '1.0'
  showExecutiveSummary?: boolean; // Default true
  enableClp?: boolean; // Default false
  clpExchangeRate?: number; // Default 950
}

export interface EstimateSolutionSummary {
  hardwareTotal: number;
  hardwareCount: number;
  softwareTotal: number;
  softwareCount: number;
  servicesTotal: number;
  servicesCount: number;
  grandTotal: number;
  totalQty: number;
  motherLines: {
    motherKey: string;
    items: EstimateLineItem[];
    subtotal: number;
    totalQty: number;
    typeBadge: string;
  }[];
}

export const formatUSD = (val: number, decimals: number = 2): string => {
  return (
    '$' +
    Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
};

export const formatCLP = (val: number, decimals: number = 0): string => {
  return (
    '$' +
    Math.round(val || 0).toLocaleString('es-CL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
};

/**
 * Categoriza ítems de cotización en Hardware, Software/Licencias y Soporte/Servicios,
 * agrupando además por Línea Madre.
 */
export function categorizeEstimateItems(
  items: EstimateLineItem[],
  selectedLine?: string
): EstimateSolutionSummary {
  let hardwareTotal = 0;
  let hardwareCount = 0;
  let softwareTotal = 0;
  let softwareCount = 0;
  let servicesTotal = 0;
  let servicesCount = 0;
  let grandTotal = 0;
  let totalQty = 0;

  // Filtrar ítems si se seleccionó una línea madre específica
  let activeItems = items || [];
  if (selectedLine && selectedLine !== 'ALL') {
    activeItems = activeItems.filter((it) => {
      const mKey = getMotherLineKey(it.lineNumber);
      return mKey === selectedLine;
    });
  }

  // Agrupación por Línea Madre
  const motherMap = new Map<string, EstimateLineItem[]>();
  let currentMotherKey = '1.0';

  for (const it of activeItems) {
    if (it.isInfoRow) {
      if (!motherMap.has(currentMotherKey)) {
        motherMap.set(currentMotherKey, []);
      }
      motherMap.get(currentMotherKey)!.push(it);
      continue;
    }

    const mKey = getMotherLineKey(it.lineNumber) || '1.0';
    currentMotherKey = mKey;
    if (!motherMap.has(mKey)) {
      motherMap.set(mKey, []);
    }
    motherMap.get(mKey)!.push(it);

    const extNet = Number(it.precioVentaExtendido) || 0;
    const qty = typeof it.qty === 'number' && !isNaN(it.qty) ? it.qty : 1;
    grandTotal += extNet;
    totalQty += qty;

    const skuUpper = (it.partNumber || '').toUpperCase().trim();
    const descLower = (it.description || '').toLowerCase().trim();

    // Detección de naturaleza
    if (
      skuUpper.startsWith('CON-') ||
      skuUpper.includes('-SVS') ||
      descLower.includes('smartnet') ||
      descLower.includes('support service') ||
      descLower.includes('partner support')
    ) {
      servicesTotal += extNet;
      servicesCount++;
    } else if (
      checkIsIntangible(it.partNumber, it.description) ||
      isCloudSubscriptionSku(it.partNumber)
    ) {
      softwareTotal += extNet;
      softwareCount++;
    } else {
      hardwareTotal += extNet;
      hardwareCount++;
    }
  }

  // Ordenar Líneas Madre
  const sortedMotherKeys = Array.from(motherMap.keys()).sort(
    (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
  );

  const motherLines = sortedMotherKeys.map((motherKey) => {
    const groupItems = motherMap.get(motherKey)!;
    const groupQty = groupItems.reduce(
      (acc, it) => (it.isInfoRow ? acc : acc + (typeof it.qty === 'number' ? it.qty : 1)),
      0
    );
    const subtotal = groupItems.reduce(
      (acc, it) => (it.isInfoRow ? acc : acc + (Number(it.precioVentaExtendido) || 0)),
      0
    );

    const hasHw = groupItems.some(
      (it) => !it.isInfoRow && !checkIsIntangible(it.partNumber, it.description)
    );
    const hasSw = groupItems.some(
      (it) =>
        !it.isInfoRow &&
        (checkIsIntangible(it.partNumber, it.description) || isCloudSubscriptionSku(it.partNumber))
    );

    const typeBadge =
      hasHw && !hasSw
        ? '🔧 Hardware (E1)'
        : !hasHw && hasSw
        ? '☁️ Licencias / SaaS (ED)'
        : '📦 Solución Integrada HW + SW';

    return {
      motherKey,
      items: groupItems,
      subtotal: Math.round(subtotal * 100) / 100,
      totalQty: groupQty,
      typeBadge,
    };
  });

  return {
    hardwareTotal: Math.round(hardwareTotal * 100) / 100,
    hardwareCount,
    softwareTotal: Math.round(softwareTotal * 100) / 100,
    softwareCount,
    servicesTotal: Math.round(servicesTotal * 100) / 100,
    servicesCount,
    grandTotal: Math.round(grandTotal * 100) / 100,
    totalQty,
    motherLines,
  };
}

/**
 * Genera el borrador formal de correo al Partner en formato Texto Plano y HTML enriquecido para Outlook.
 */
export function generatePartnerEmailDraft(options: {
  partnerName: string;
  clientName: string;
  dealId?: string;
  estimateId?: string;
  summary: EstimateSolutionSummary;
  groupingOptions: EstimateExportGroupingOptions;
}): { subject: string; bodyText: string; bodyHtml: string } {
  const { partnerName, clientName, dealId, estimateId, summary, groupingOptions } = options;

  const dealLabel = dealId && dealId !== 'NA' ? dealId : 'Pendiente';
  const estimateLabel = estimateId || 'ESTIMATE';
  const subject = `Cotización Cisco - Deal ${dealLabel} / Estimate ${estimateLabel} - ${clientName || 'Cliente Final'}`;

  const clpActive = Boolean(groupingOptions.enableClp && (groupingOptions.clpExchangeRate || 0) > 0);
  const clpRate = groupingOptions.clpExchangeRate || 950;
  const totalClp = summary.grandTotal * clpRate;

  // Texto Plano
  let bodyText = `Estimados,\n\n`;
  bodyText += `Junto con saludar, compartimos la cotización formal de preventa Cisco para el cliente ${clientName || 'Cliente Final'}.\n\n`;
  bodyText += `DATOS DE LA OPORTUNIDAD:\n`;
  bodyText += `• Canal / Partner: ${partnerName || 'Intcomex'}\n`;
  bodyText += `• Cliente Final: ${clientName || 'Cliente Final'}\n`;
  bodyText += `• Deal ID: ${dealLabel}\n`;
  bodyText += `• Estimate ID: ${estimateLabel}\n\n`;

  bodyText += `RESUMEN ECONÓMICO DE LA SOLUCIÓN:\n`;
  if (summary.hardwareTotal > 0) {
    bodyText += `• Equipamiento Hardware (E1): ${formatUSD(summary.hardwareTotal)} USD (${summary.hardwareCount} ítems)\n`;
  }
  if (summary.softwareTotal > 0) {
    bodyText += `• Licenciamiento / Cloud (ED): ${formatUSD(summary.softwareTotal)} USD (${summary.softwareCount} ítems)\n`;
  }
  if (summary.servicesTotal > 0) {
    bodyText += `• Servicios y Soporte SmartNet: ${formatUSD(summary.servicesTotal)} USD (${summary.servicesCount} ítems)\n`;
  }
  bodyText += `• TOTAL SOLUCIÓN: ${formatUSD(summary.grandTotal)} USD\n`;
  if (clpActive) {
    bodyText += `• TOTAL REFERENCIAL CLP: ${formatCLP(totalClp)} CLP + IVA (T/C: $${clpRate} CLP/USD)\n`;
  }

  if (groupingOptions.groupByLine && summary.motherLines.length > 1) {
    bodyText += `\nDESGLOSE POR LÍNEA MADRE (ÓRDENES DE COMPRA):\n`;
    for (const m of summary.motherLines) {
      bodyText += `• Línea ${m.motherKey} (${m.typeBadge}): ${formatUSD(m.subtotal)} USD [${m.totalQty} unidades]\n`;
    }
  }

  bodyText += `\nCONDICIONES COMERCIALES:\n`;
  bodyText += `1. Validez de la Oferta: 14 días corridos a contar de su fecha de emisión.\n`;
  bodyText += `2. Plazo de entrega: Determinado por el producto con mayor tiempo de espera (lead time) de la orden.\n`;
  bodyText += `3. Validación Técnica y Responsabilidad: La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner.\n\n`;
  bodyText += `Quedamos a su entera disposición ante cualquier consulta o para la recepción de su Orden de Compra.\n\n`;
  bodyText += `Saludos cordiales,\n`;
  bodyText += `Cisco Team Chile | Intcomex\n`;

  // HTML Enriquecido para Outlook
  let summaryRowsHtml = '';
  if (summary.hardwareTotal > 0) {
    summaryRowsHtml += `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">🔧 Equipamiento Hardware (Bodega E1)</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${summary.hardwareCount}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">${formatUSD(summary.hardwareTotal)}</td>
      </tr>`;
  }
  if (summary.softwareTotal > 0) {
    summaryRowsHtml += `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">☁️ Licenciamiento / Cloud (Bodega ED)</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${summary.softwareCount}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">${formatUSD(summary.softwareTotal)}</td>
      </tr>`;
  }
  if (summary.servicesTotal > 0) {
    summaryRowsHtml += `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">🛡️ Servicios y Soporte SmartNet</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${summary.servicesCount}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">${formatUSD(summary.servicesTotal)}</td>
      </tr>`;
  }

  let lineBreakdownHtml = '';
  if (groupingOptions.groupByLine && summary.motherLines.length > 1) {
    lineBreakdownHtml = `
      <div style="margin-top: 16px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 8px 0; font-size: 11pt; color: #1e293b; font-family: Calibri, Arial, sans-serif;">📑 Desglose por Línea Madre (Subtotales por OC):</h4>
        <table style="width: 100%; border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #334155; font-weight: bold; text-align: left;">
              <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1;">Línea</th>
              <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1;">Tipo de Solución</th>
              <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1; text-align: center;">Cantidad</th>
              <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Subtotal USD</th>
            </tr>
          </thead>
          <tbody>
            ${summary.motherLines
              .map(
                (m) => `
              <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Línea ${m.motherKey}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${m.typeBadge}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${m.totalQty}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f172a;">${formatUSD(m.subtotal)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const clpHtmlRow = clpActive
    ? `
      <tr style="background-color: #f0fdf4;">
        <td colspan="2" style="padding: 8px 10px; border-top: 1px dashed #86efac; font-weight: bold; color: #166534;">
          💵 Total Referencial Moneda Local (CLP + IVA):
        </td>
        <td style="padding: 8px 10px; border-top: 1px dashed #86efac; text-align: right; font-weight: bold; color: #166534; font-size: 11pt;">
          ${formatCLP(totalClp)} CLP <span style="font-size: 8.5pt; font-weight: normal; color: #15803d;">(T/C: $${clpRate})</span>
        </td>
      </tr>
    `
    : '';

  const bodyHtml = `
    <div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1f2937; line-height: 1.5; max-width: 680px;">
      <p>Estimados,</p>
      <p>Junto con saludar, compartimos la propuesta comercial formal de preventa Cisco para el cliente <strong>${clientName || 'Cliente Final'}</strong>.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 14px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10pt;">
        <tr>
          <td style="padding: 6px 10px; font-weight: bold; width: 140px; color: #475569;">Canal / Partner:</td>
          <td style="padding: 6px 10px; color: #0f172a; font-weight: 600;">${partnerName || 'Intcomex'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; font-weight: bold; color: #475569;">Cliente Final:</td>
          <td style="padding: 6px 10px; color: #0f172a;">${clientName || 'Cliente Final'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; font-weight: bold; color: #475569;">Deal ID / Estimate ID:</td>
          <td style="padding: 6px 10px; color: #0f172a;">${dealLabel} / <strong>${estimateLabel}</strong></td>
        </tr>
      </table>

      <h4 style="margin: 16px 0 8px 0; font-size: 11pt; color: #0f172a;">📊 Resumen Ejecutivo de la Solución:</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
            <th style="padding: 8px 10px;">Categoría</th>
            <th style="padding: 8px 10px; text-align: center;">Qty</th>
            <th style="padding: 8px 10px; text-align: right;">Total Neto USD</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRowsHtml}
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="2" style="padding: 8px 10px; border-top: 2px solid #94a3b8; color: #0f172a; font-size: 11pt;">TOTAL SOLUCIÓN CISCO:</td>
            <td style="padding: 8px 10px; border-top: 2px solid #94a3b8; text-align: right; color: #0f172a; font-size: 12pt;">${formatUSD(summary.grandTotal)}</td>
          </tr>
          ${clpHtmlRow}
        </tbody>
      </table>

      ${lineBreakdownHtml}

      <div style="margin-top: 18px; padding: 12px; background-color: #f1f5f9; border-left: 4px solid #0284c7; font-size: 8.5pt; color: #334155; line-height: 1.4;">
        <p style="margin: 0 0 6px 0;"><strong>Validez de la Oferta:</strong> Esta cotización tiene una validez de <strong style="color: #b91c1c;">14 días corridos</strong> a contar de su fecha de emisión.</p>
        <p style="margin: 0 0 6px 0;"><strong>Plazo de entrega:</strong> El tiempo final de despacho está determinado por el producto con mayor tiempo de espera (lead time) de la orden.</p>
        <p style="margin: 0;"><strong>Validación Técnica y Responsabilidad:</strong> La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner.</p>
      </div>

      <p style="margin-top: 20px;">Quedamos atentos a sus comentarios o formalización de la Orden de Compra.</p>
      
      <p style="margin-top: 20px; color: #475569; font-size: 9.5pt;">
        Saludos cordiales,<br/>
        <strong>Cisco Team Chile</strong> | Intcomex
      </p>
    </div>
  `;

  return { subject, bodyText, bodyHtml };
}

/**
 * Genera el documento HTML completo de alta resolución para impresión / exportación en PDF Comercial.
 */
export function generateCommercialPdfHtml(options: {
  headerInfo?: EstimateHeaderInfo;
  partnerName: string;
  clientName: string;
  summary: EstimateSolutionSummary;
  groupingOptions: EstimateExportGroupingOptions;
}): string {
  const { headerInfo, partnerName, clientName, summary, groupingOptions } = options;

  const dateStr = headerInfo?.date || new Date().toLocaleDateString('es-CL');
  const dealId = headerInfo?.dealId && headerInfo.dealId !== 'NA' ? headerInfo.dealId : 'N/A';
  const estimateId = headerInfo?.estimateId || 'ESTIMATE';
  const priceList = headerInfo?.priceList || 'GLOBAL PRICE LIST';

  const clpActive = Boolean(groupingOptions.enableClp && (groupingOptions.clpExchangeRate || 0) > 0);
  const clpRate = groupingOptions.clpExchangeRate || 950;
  const totalClp = summary.grandTotal * clpRate;

  // Renderizado de Filas de la Tabla (Continuo vs Agrupado)
  let tableRowsHtml = '';

  if (groupingOptions.groupByLine) {
    for (const group of summary.motherLines) {
      tableRowsHtml += `
        <tr class="group-header">
          <td colspan="7">
            <strong>📦 Bloque Línea ${group.motherKey}</strong> — ${group.typeBadge} 
            <span style="font-weight: normal; color: #475569;">(${group.items.length} ${group.items.length === 1 ? 'ítem' : 'ítems'})</span>
          </td>
        </tr>
      `;

      group.items.forEach((item, idx) => {
        if (item.isInfoRow) {
          tableRowsHtml += `
            <tr class="info-row">
              <td class="text-center"></td>
              <td colspan="6" class="info-cell"><em>${item.description || ''}</em></td>
            </tr>
          `;
          return;
        }

        const isAlt = idx % 2 === 1;
        const isMain = String(item.lineNumber || '').endsWith('.0');
        tableRowsHtml += `
          <tr class="${isAlt ? 'row-alt' : ''}">
            <td class="text-center ${isMain ? 'font-bold' : ''}">${item.lineNumber || ''}</td>
            <td class="${isMain ? 'font-bold' : 'indent-part'}">${item.partNumber || ''}</td>
            <td class="desc-cell">${item.description || ''}</td>
            <td class="text-center text-slate">${item.transformedLeadTime || '-'}</td>
            <td class="text-center">${item.qty ?? 1}</td>
            <td class="text-right">${formatUSD(item.precioVentaUnitario)}</td>
            <td class="text-right font-medium">${formatUSD(item.precioVentaExtendido)}</td>
          </tr>
        `;
      });

      // Fila de Subtotal de Línea Madre
      tableRowsHtml += `
        <tr class="subtotal-row">
          <td colspan="4" class="text-right font-bold">Subtotal Línea ${group.motherKey}:</td>
          <td class="text-center font-bold">${group.totalQty}</td>
          <td class="text-right"></td>
          <td class="text-right font-bold">${formatUSD(group.subtotal)}</td>
        </tr>
      `;
    }
  } else {
    // Continuo estándar
    let currentIdx = 0;
    for (const group of summary.motherLines) {
      group.items.forEach((item) => {
        if (item.isInfoRow) {
          tableRowsHtml += `
            <tr class="info-row">
              <td class="text-center"></td>
              <td colspan="6" class="info-cell"><em>${item.description || ''}</em></td>
            </tr>
          `;
          return;
        }

        const isAlt = currentIdx % 2 === 1;
        currentIdx++;
        const isMain = String(item.lineNumber || '').endsWith('.0');
        tableRowsHtml += `
          <tr class="${isAlt ? 'row-alt' : ''}">
            <td class="text-center ${isMain ? 'font-bold' : ''}">${item.lineNumber || ''}</td>
            <td class="${isMain ? 'font-bold' : 'indent-part'}">${item.partNumber || ''}</td>
            <td class="desc-cell">${item.description || ''}</td>
            <td class="text-center text-slate">${item.transformedLeadTime || '-'}</td>
            <td class="text-center">${item.qty ?? 1}</td>
            <td class="text-right">${formatUSD(item.precioVentaUnitario)}</td>
            <td class="text-right font-medium">${formatUSD(item.precioVentaExtendido)}</td>
          </tr>
        `;
      });
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Cotización Comercial Cisco - ${clientName || 'Cliente Final'}</title>
      <style>
        @page {
          size: letter portrait;
          margin: 12mm 10mm 14mm 10mm;
          @bottom-right {
            content: "Página " counter(page) " de " counter(pages);
            font-size: 7.5pt;
            color: #64748b;
          }
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 16px;
          font-size: 8.5pt;
          line-height: 1.35;
          background: #ffffff;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }
        .logo {
          height: 38px;
          width: auto;
          display: block;
        }
        .title-banner {
          text-align: right;
        }
        .title-banner h1 {
          margin: 0;
          font-size: 15pt;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .title-banner p {
          margin: 2px 0 0 0;
          font-size: 8pt;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
        }
        .meta-card {
          width: 100%;
          border-collapse: collapse;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          margin-bottom: 14px;
        }
        .meta-card td {
          padding: 6px 10px;
          font-size: 8.5pt;
          border-bottom: 1px solid #f1f5f9;
        }
        .meta-label {
          font-weight: 700;
          color: #475569;
          width: 15%;
        }
        .meta-value {
          color: #0f172a;
          width: 35%;
        }
        .exec-card {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
        }
        .exec-card th {
          background: #1e293b;
          color: #ffffff;
          padding: 6px 8px;
          font-size: 8pt;
          text-align: left;
        }
        .exec-card td {
          padding: 5px 8px;
          font-size: 8pt;
          border-bottom: 1px solid #e2e8f0;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 8pt;
        }
        .data-table th {
          background: #e2e8f0;
          color: #1e293b;
          padding: 6px 6px;
          font-weight: 700;
          border-top: 1px solid #94a3b8;
          border-bottom: 2px solid #475569;
          text-align: left;
        }
        .data-table td {
          padding: 4.5px 6px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .row-alt {
          background-color: #f8fafc;
        }
        .group-header {
          background-color: #f1f5f9;
          font-size: 8.5pt;
          color: #0f172a;
          border-top: 1.5px solid #cbd5e1;
          border-bottom: 1.5px solid #cbd5e1;
        }
        .group-header td {
          padding: 6px 8px;
        }
        .subtotal-row {
          background-color: #f8fafc;
          border-top: 1px solid #94a3b8;
          border-bottom: 1.5px solid #475569;
          color: #0f172a;
        }
        .info-row td {
          background: #ffffff;
          padding: 3px 6px;
        }
        .info-cell {
          font-style: italic;
          color: #64748b;
          font-size: 7.5pt;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; color: #000000; }
        .font-medium { font-weight: 600; color: #0f172a; }
        .text-slate { color: #64748b; }
        .indent-part { padding-left: 12px !important; color: #334155; }
        .desc-cell { max-width: 260px; line-height: 1.25; }
        
        .total-box {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .total-box td {
          padding: 8px 10px;
        }
        .grand-total-row {
          background: #f1f5f9;
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          font-weight: 800;
          font-size: 10.5pt;
        }
        .clp-total-row {
          background: #f0fdf4;
          border-bottom: 1px dashed #86efac;
          font-weight: 700;
          color: #166534;
          font-size: 9.5pt;
        }

        .clauses-card {
          background: #f8fafc;
          border-left: 3.5px solid #2563eb;
          border-radius: 4px;
          padding: 10px 12px;
          font-size: 7.5pt;
          color: #334155;
          line-height: 1.45;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .clause-title {
          font-weight: 700;
          color: #0f172a;
        }
        .print-btn-bar {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          gap: 8px;
        }
        .btn-print {
          background: #0284c7;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        @media print {
          .print-btn-bar { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      </div>

      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: middle; width: 50%;">
            <img src="data:image/png;base64,${INTCOMEX_LOGO_RAW_BASE64}" alt="Intcomex Logo" class="logo" />
          </td>
          <td class="title-banner" style="vertical-align: middle; width: 50%;">
            <h1>PROPUESTA COMERCIAL</h1>
            <p>Solución Preventa Cisco Systems</p>
          </td>
        </tr>
      </table>

      <!-- Meta Card -->
      <table class="meta-card">
        <tr>
          <td class="meta-label">Canal / Partner:</td>
          <td class="meta-value"><strong>${partnerName || 'Intcomex'}</strong></td>
          <td class="meta-label">Fecha Emisión:</td>
          <td class="meta-value">${dateStr}</td>
        </tr>
        <tr>
          <td class="meta-label">Cliente Final:</td>
          <td class="meta-value"><strong>${clientName || 'Cliente Final'}</strong></td>
          <td class="meta-label">Estimate ID:</td>
          <td class="meta-value"><strong>${estimateId}</strong></td>
        </tr>
        <tr>
          <td class="meta-label">Price List:</td>
          <td class="meta-value">${priceList}</td>
          <td class="meta-label">Deal ID:</td>
          <td class="meta-value">${dealId}</td>
        </tr>
      </table>

      <!-- Resumen Ejecutivo (Idea 1) -->
      ${
        groupingOptions.showExecutiveSummary !== false
          ? `
        <table class="exec-card">
          <thead>
            <tr>
              <th>Resumen Ejecutivo de la Solución</th>
              <th class="text-center" style="width: 80px;">Ítems</th>
              <th class="text-right" style="width: 130px;">Total Neto USD</th>
            </tr>
          </thead>
          <tbody>
            ${
              summary.hardwareTotal > 0
                ? `<tr>
                    <td>🔧 Equipamiento Físico Hardware (Bodega E1)</td>
                    <td class="text-center">${summary.hardwareCount}</td>
                    <td class="text-right font-medium">${formatUSD(summary.hardwareTotal)}</td>
                  </tr>`
                : ''
            }
            ${
              summary.softwareTotal > 0
                ? `<tr>
                    <td>☁️ Licenciamiento / Cloud SaaS (Bodega ED)</td>
                    <td class="text-center">${summary.softwareCount}</td>
                    <td class="text-right font-medium">${formatUSD(summary.softwareTotal)}</td>
                  </tr>`
                : ''
            }
            ${
              summary.servicesTotal > 0
                ? `<tr>
                    <td>🛡️ Servicios y Soporte SmartNet</td>
                    <td class="text-center">${summary.servicesCount}</td>
                    <td class="text-right font-medium">${formatUSD(summary.servicesTotal)}</td>
                  </tr>`
                : ''
            }
            <tr style="background: #f1f5f9; font-weight: 700;">
              <td>TOTAL SOLUCIÓN</td>
              <td class="text-center">${summary.totalQty} und.</td>
              <td class="text-right">${formatUSD(summary.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      `
          : ''
      }

      <!-- Detailed Items Table -->
      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 45px;">#</th>
            <th style="width: 140px;">Part Number</th>
            <th>Descripción</th>
            <th class="text-center" style="width: 75px;">Lead Time</th>
            <th class="text-center" style="width: 45px;">Qty</th>
            <th class="text-right" style="width: 90px;">Unit Price</th>
            <th class="text-right" style="width: 100px;">Ext Price</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <!-- Totals Box -->
      <table class="total-box">
        <tr class="grand-total-row">
          <td colspan="4" style="text-align: right; width: 70%;">PRICE TOTAL (USD):</td>
          <td class="text-center" style="width: 8%;">${summary.totalQty}</td>
          <td colspan="2" class="text-right" style="width: 22%;">${formatUSD(summary.grandTotal)}</td>
        </tr>
        ${
          clpActive
            ? `
          <tr class="clp-total-row">
            <td colspan="4" style="text-align: right;">Total Solución Referencial Moneda Local:</td>
            <td colspan="3" class="text-right">
              ${formatCLP(totalClp)} CLP + IVA 
              <span style="font-size: 7.5pt; font-weight: normal; color: #15803d;">(T/C Observado: $${clpRate} CLP/USD)</span>
            </td>
          </tr>
        `
            : ''
        }
      </table>

      <!-- Official Clauses -->
      <div class="clauses-card">
        <p style="margin: 0 0 5px 0;">
          <span class="clause-title">Validez de la Oferta:</span> Esta cotización tiene una validez de <strong style="color: #b91c1c;">14 días corridos</strong> a contar de su fecha de emisión.
        </p>
        <p style="margin: 0 0 5px 0;">
          <span class="clause-title">Plazo de entrega:</span> El tiempo final de despacho está determinado por el producto con mayor tiempo de espera (lead time) de la orden.
        </p>
        <p style="margin: 0;">
          <span class="clause-title">Validación Técnica y Responsabilidad:</span> La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner.
        </p>
      </div>

    </body>
    </html>
  `;
}

/**
 * Abre el diálogo de impresión / guardado como PDF en una ventana emergente o iframe.
 */
export function triggerPrintCommercialPdf(htmlContent: string): void {
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    // Si los popups están bloqueados, usar iframe invisible
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 350);
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}
