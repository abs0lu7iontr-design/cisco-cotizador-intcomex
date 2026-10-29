import fs from 'fs';
import { generateExecutivePresentationPptx } from '../src/core/pptxEngine';
import { ProcessedEstimateResult, QuoteParameters, EstimateLineItem } from '../src/core/types';

const complexItems: EstimateLineItem[] = [];
for (let i = 1; i <= 15; i++) {
  complexItems.push({
    rowIdx: i,
    lineNumber: `${i}.0`,
    partNumber: `C9300-48P-A-${i}`,
    description: `Switch Catalyst & PoE+ 48P "Advantage" <Tier ${i}> & cables`,
    qty: i,
    netCiscoUnit: 1000 * i,
    costoInternacion: 70 * i,
    costoArancel: 60 * i,
    costoTotalUnitario: 1130 * i,
    precioVentaUnitario: 1189.47 * i,
    precioVentaExtendido: 1189.47 * i * i,
    isIntangible: i % 2 === 0,
    llevaArancel: i % 3 === 0,
    effectiveInternacionPct: 7,
    effectiveArancelPct: 6,
    effectiveMargenPct: 5,
    transformedLeadTime: i % 2 === 0 ? 'En Stock (Miami)' : '14 semanas a pedido',
  } as unknown as EstimateLineItem);
}

const dummyEstimate: ProcessedEstimateResult = {
  fileName: 'Estimate_COMPLEX_TEST.xlsx',
  originalProductTotal: 45000,
  calculatedProductTotal: 52450.80,
  finalTotalPrice: 52450.80,
  serviceTotal: 0,
  subscriptionTotal: 0,
  headerRowIndex: 0,
  items: complexItems,
  headerInfo: {
    dealId: 'DEAL-889900-CL',
    estimateId: 'EST-998877-CL',
    companyName: 'Partner & Solutions "Chile" S.A.',
    customerName: 'Cliente Final <Banco & Seguros>',
  } as any,
} as unknown as ProcessedEstimateResult;

const dummyParams: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
};

async function main() {
  const blob = await generateExecutivePresentationPptx(
    dummyEstimate,
    dummyParams,
    'Partner & Solutions "Chile" S.A.',
    'Cliente Final <Banco & Seguros>'
  );
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync('sample_complex_test.pptx', buffer);
  console.log('sample_complex_test.pptx written, size:', buffer.length);
}

main().catch(console.error);
