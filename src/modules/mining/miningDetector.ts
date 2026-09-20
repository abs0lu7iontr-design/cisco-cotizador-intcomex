// ============================================================================
// CISCO AUTOMATED v2.1 - MINING OBSERVER MODULE (DETECTION & DANIEL PEÑA ALERT)
// ============================================================================

// Lista de palabras clave para identificar cuentas mineras en el nombre del archivo
export const MINING_KEYWORDS = [
  'codelco', 'chuquicamata', 'teniente', 'andina', 'radomiro', 'tomic', 'hales', 'salvador', 'gabriela mistral',
  'amsa', 'antofagasta minerals', 'pelambres', 'centinela', 'antucoya', 'zaldivar', 'collahuasi', 
  'lundin', 'candelaria', 'caserones', 'freeport', 'el abra',
  'honeywell', 'rockwell', 'emerson', 'schneider', 'caterpillar', 'bechtel', 'sigdo koppers', 'sk',
  'cap', 'cmp', 'enami', 'molymet', 'sqm', 'finning', 'komatsu', 'albemarle', 'sierra gorda', 'kghm', 'goldfields',
  'anglo', 'american', 'los bronces', 'el soldado', 'chagres', 'mantos', 'copper', 'mantos blancos', 'manto verde', 'capstone',
  'teck', 'quebrada blanca', 'qb2', 'andacollo',
  'glencore', 'lomas bayas', 'altonorte'
];

export interface MiningAlertData {
  isMining: boolean;
  matchedKeyword?: string;
  totalListPrice: number;
  shouldAlert: boolean;
  mailtoUrl?: string;
}

export interface MiningLineItemInput {
  listPrice?: number;
  unitListPrice?: number;
  quantity?: number;
  qty?: number;
}

/**
 * Inspecciona el archivo Estimate de forma pasiva sin alterar sus datos.
 */
export function inspectEstimateForMining(
  fileName: string,
  lineItems: MiningLineItemInput[],
  detectedDealId?: string | null
): MiningAlertData {
  // 1. Detección por nombre de archivo
  const normalizedFileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const matchedKeyword = MINING_KEYWORDS.find((kw) => normalizedFileName.includes(kw));

  // Si no es un cliente minero, salimos inmediatamente
  if (!matchedKeyword) {
    return { isMining: false, totalListPrice: 0, shouldAlert: false };
  }

  // 2. Suma del total de lista sin descuentos (soporta listPrice/unitListPrice y quantity/qty)
  const totalListPrice = lineItems.reduce((acc, item) => {
    const rawPrice = item.listPrice !== undefined ? item.listPrice : item.unitListPrice;
    const rawQty = item.quantity !== undefined ? item.quantity : item.qty;
    const unitPrice = typeof rawPrice === 'number' && !isNaN(rawPrice) ? rawPrice : 0;
    const qty = typeof rawQty === 'number' && !isNaN(rawQty) ? rawQty : 1;
    return acc + (unitPrice * qty);
  }, 0);

  // 3. Umbral estricto: solo alertar a partir de 150.000 USD
  const shouldAlert = totalListPrice >= 150000;

  let mailtoUrl: string | undefined;
  if (shouldAlert) {
    const deal = detectedDealId || '[NUMERO_DEAL]';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : 'Buenas tardes';
    const formattedAmount = totalListPrice.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const subject = encodeURIComponent(`Solicitud de Descuentos Especiales Minería - Deal ${deal}`);
    const body = encodeURIComponent(
      `Estimado Daniel,\n\n` +
      `${greeting}, favor tu ayuda con descuentos para el deal ${deal}.\n\n` +
      `Monto total de lista (sin descuentos): $${formattedAmount} USD.\n\n` +
      `Quedo atento a tus comentarios.\n\n` +
      `Saludos cordiales,\n` +
      `Mauricio Skill\n` +
      `PreSales Engineer - Value | Intcomex`
    );

    mailtoUrl = `mailto:danpena@cisco.com?subject=${subject}&body=${body}`;
  }

  return {
    isMining: true,
    matchedKeyword,
    totalListPrice,
    shouldAlert,
    mailtoUrl,
  };
}
