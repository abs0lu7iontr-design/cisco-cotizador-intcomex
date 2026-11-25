// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/mining-audit
// Microservicio Edge para Auditoría Comercial de Minería & Servicios Cisco
// ============================================================================

import { runMiningAudit } from '../../src/modules/mining/miningAuditor';
import { CustomerMatchInput } from '../../src/modules/mining/customerMatcher';
import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS', 'Content-Type'),
  });
};

export const onRequestPost: PagesFunction = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS', 'Content-Type');
  try {
    const body: any = await context.request.json();

    if (!body || !Array.isArray(body.items)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payload inválido: se requiere un array de items.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const customerInput: CustomerMatchInput = {
      customerName: body.customerName || '',
      companyName: body.companyName || '',
      fileName: body.fileName || '',
      dealName: body.dealName || '',
    };

    const bomTotalUsd = typeof body.bomTotalUsd === 'number' ? body.bomTotalUsd : (body.totalUsd || 0);

    const report = runMiningAudit(customerInput, body.items, bomTotalUsd);

    return new Response(
      JSON.stringify({
        success: true,
        report,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error en microservicio mining-audit:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno evaluando auditoría minera.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
};
