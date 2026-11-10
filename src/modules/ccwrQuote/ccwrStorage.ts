// ============================================================================
// CISCO AUTOMATED v2.9 - CCW-R STORAGE & CROSS-MODULE SYNC
// Persistencia Local de Cotizaciones CCW-R y Cruce con Forecast & Pipeline
// ============================================================================

import { ProcessedCcwrQuote } from './ccwrTypes';
import { ForecastRecord } from '../forecast/forecastTypes';
import { saveForecastRecord, getForecastRecords } from '../forecast/forecastStorage';
import { findMatchingForecastRecord } from '../forecast/forecastService';
import { PipelineDealRecord } from '../pipeline/pipelineTypes';
import { savePipelineDeal, getPipelineDeals } from '../pipeline/pipelineStorage';
import { findMatchingPipelineDeal } from '../pipeline/pipelineService';

const CCWR_STORAGE_KEY = 'cisco_ccwr_processed_quotes_v1';

/**
 * Guarda una cotización CCW-R procesada en el historial local
 */
export async function saveCcwrQuoteHistory(quote: ProcessedCcwrQuote): Promise<void> {
  try {
    const existing = await getCcwrQuoteHistory();
    const filtered = existing.filter(
      (q) => q.headerInfo.quoteNumber !== quote.headerInfo.quoteNumber
    );
    const updated = [quote, ...filtered].slice(0, 50); // Guardar últimas 50
    localStorage.setItem(CCWR_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[ccwrStorage] Error guardando historial:', err);
  }
}

/**
 * Obtiene el historial de cotizaciones CCW-R guardadas
 */
export async function getCcwrQuoteHistory(): Promise<ProcessedCcwrQuote[]> {
  try {
    const raw = localStorage.getItem(CCWR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[ccwrStorage] Error leyendo historial:', err);
    return [];
  }
}

/**
 * Vincula la cotización CCW-R con el Forecast Comercial aplicando el motor Anti-Duplicación
 */
export async function linkCcwrToForecast(
  quote: ProcessedCcwrQuote,
  partnerName: string = 'Intcomex'
): Promise<{ record: ForecastRecord; isNew: boolean }> {
  const existingRecords = await getForecastRecords();
  const quoteNumber = quote.headerInfo.quoteNumber;
  const clientName = quote.headerInfo.endCustomerName || 'Cliente Final';
  const totalUsd = quote.summary.totalPrecioVenta;
  const nowIso = new Date().toISOString();

  // Buscar coincidencia para no duplicar
  const match = findMatchingForecastRecord(existingRecords, {
    dealId: quoteNumber,
    partner: partnerName,
    endUser: clientName,
    usd: totalUsd,
  });

  if (match) {
    const updated: ForecastRecord = {
      ...match,
      deal: quoteNumber || match.deal,
      usdIntcomex: totalUsd > 0 ? totalUsd : match.usdIntcomex,
      servicios: totalUsd > 0 ? totalUsd : match.servicios,
      endCustomerName: clientName,
      endCustomerAddress1: quote.headerInfo.endCustomerAddressLine1 || match.endCustomerAddress1,
      observacion: `Renovación CCW-R #${quoteNumber} | ${quote.summary.totalQuantity} dispositivos`,
      priceProtectionExpiryDate: quote.headerInfo.priceProtectionExpiryDate || match.priceProtectionExpiryDate,
      updatedAt: nowIso,
    };
    await saveForecastRecord(updated);
    return { record: updated, isNew: false };
  }

  // Si no existe, crear registro nuevo
  const newId = `FC-${String(existingRecords.length + 1).padStart(4, '0')}`;
  const newRec: ForecastRecord = {
    id: newId,
    fechaLevantamiento: quote.headerInfo.quoteDate || nowIso.slice(0, 10),
    fechaCotizacion: quote.headerInfo.quoteDate || nowIso.slice(0, 10),
    marca: 'CISCO',
    pmResponsable: quote.params.sellerName || 'Mauricio Skill',
    partner: partnerName,
    ejecutivoPartner: 'Preventa Cisco',
    endUser: clientName,
    usdIntcomex: totalUsd,
    emailEjecutivoPartner: '',
    mesFacturacion: 'Diciembre',
    emailClienteFinal: '',
    detalleProductos: `Renovación CCW-R SmartNet #${quoteNumber} (${quote.summary.totalQuantity} seriales)`,
    oc: '',
    deal: quoteNumber,
    productos: 0,
    suscripciones: 0,
    servicios: totalUsd,
    meraki: 0,
    am: '',
    grupoVentas: 'Enterprise',
    observacion: `Generado desde Cotizador CCW-R Servicios & Licencias`,
    dsvSubmission: '',
    po: '',
    so: '',
    submittedDate: '',
    clienteCisco: clientName,
    promotionAuthorizationNumber: '',
    endCustomerName: clientName,
    endCustomerAddress1: quote.headerInfo.endCustomerAddressLine1 || '',
    numeroVenta: '',
    bodega: 'ED', // Intangibles / Servicios van a ED
    caso: '',
    priceProtectionExpiryDate: quote.headerInfo.priceProtectionExpiryDate || '',
    credit: 'Aprobado',
    nuevoCaso: '',
    confirmacionCredito: '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await saveForecastRecord(newRec);
  return { record: newRec, isNew: true };
}

/**
 * Vincula la cotización CCW-R con el Pipeline Comercial aplicando el motor Anti-Duplicación
 */
export async function linkCcwrToPipeline(
  quote: ProcessedCcwrQuote,
  partnerName: string = 'Intcomex'
): Promise<{ deal: PipelineDealRecord; isNew: boolean }> {
  const existingDeals = await getPipelineDeals();
  const quoteNumber = quote.headerInfo.quoteNumber;
  const clientName = quote.headerInfo.endCustomerName || 'Cliente Final';
  const totalUsd = quote.summary.totalPrecioVenta;
  const now = new Date().toISOString();

  const match = findMatchingPipelineDeal(existingDeals, {
    dealId: quoteNumber,
    partner: partnerName,
    endUser: clientName,
    usd: totalUsd,
  });

  if (match) {
    const updated: PipelineDealRecord = {
      ...match,
      dealId: quoteNumber || match.dealId,
      usd: totalUsd > 0 ? totalUsd : match.usd,
      servicios: totalUsd > 0 ? totalUsd : match.servicios,
      notas: `Renovación CCW-R #${quoteNumber} (${quote.summary.totalQuantity} unidades)`,
      priceProtectionExpiryDate: quote.headerInfo.priceProtectionExpiryDate || match.priceProtectionExpiryDate,
      updatedAt: now,
    };
    await savePipelineDeal(updated);
    return { deal: updated, isNew: false };
  }

  const newDeal: PipelineDealRecord = {
    id: `deal_ccwr_${Date.now()}`,
    fechaLevantamiento: quote.headerInfo.quoteDate || now.slice(0, 10),
    fechaCotizacion: quote.headerInfo.quoteDate || now.slice(0, 10),
    marca: 'Cisco',
    pmResponsable: quote.params.sellerName || 'Mauricio Skill',
    partner: partnerName,
    ejecutivoPartner: 'Preventa Cisco',
    endUser: clientName,
    usd: totalUsd,
    mesCierre: 'Diciembre',
    mesFacturacion: 'Diciembre',
    porcentajeAvance: 50,
    dealId: quoteNumber,
    productosSuscripciones: 0,
    servicios: totalUsd,
    meraki: 0,
    am: '',
    grupoVentas: 'Enterprise',
    notas: `Renovación CCW-R Servicios & Licencias #${quoteNumber}`,
    priceProtectionExpiryDate: quote.headerInfo.priceProtectionExpiryDate || '',
    createdAt: now,
    updatedAt: now,
  };

  await savePipelineDeal(newDeal);
  return { deal: newDeal, isNew: true };
}
