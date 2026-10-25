// ============================================================================
// CISCO AUTOMATED v2.7 - OPENXML POWERPOINT PRESENTATION GENERATOR (.PPTX)
// Generates official 16:9 widescreen presentation deck using JSZip
// ============================================================================

import JSZip from 'jszip';
import { ProcessedEstimateResult, EstimateLineItem, QuoteParameters, EstimateHeaderInfo } from './types';
import { categorizeEstimateItems, formatUSD } from '../modules/estimate';

function escapeXml(unsafe: string | number | undefined | null): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Genera un archivo PowerPoint (.pptx) completo de 16:9 widescreen
 * con portada ejecutiva, desglose en 3 pilares y tabla de equipamiento.
 */
export async function generateExecutivePresentationPptx(
  data: ProcessedEstimateResult,
  params: QuoteParameters,
  partnerName: string = 'Intcomex Partner',
  clientName: string = 'Cliente Final'
): Promise<Blob> {
  const zip = new JSZip();

  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const dealId = header.dealId || 'N/A';
  const estimateId = header.estimateId || 'N/A';
  const total = data.calculatedProductTotal || 0;

  const categories = categorizeEstimateItems(data.items || []);
  const hwPct = total > 0 ? ((categories.hardwareTotal / total) * 100).toFixed(1) : '0';
  const swPct = total > 0 ? ((categories.softwareTotal / total) * 100).toFixed(1) : '0';
  const svcPct = total > 0 ? ((categories.servicesTotal / total) * 100).toFixed(1) : '0';

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  // 3. ppt/_rels/presentation.xml.rels
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  // 4. ppt/presentation.xml (Widescreen 16:9 - 12192000 x 6858000)
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId4"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
    <p:sldId id="258" r:id="rId3"/>
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  // 5. ppt/slideMasters/_rels/slideMaster1.xml.rels
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
  );

  // 6. ppt/slideMasters/slideMaster1.xml
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`
  );

  // 7. ppt/slideLayouts/slideLayout1.xml
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="blank">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`
  );

  // Slide relationships
  const slideRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsContent);
  zip.file('ppt/slides/_rels/slide2.xml.rels', slideRelsContent);
  zip.file('ppt/slides/_rels/slide3.xml.rels', slideRelsContent);

  // ==========================================================================
  // SLIDE 1: PORTADA EJECUTIVA
  // ==========================================================================
  const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgRef idx="1001">
        <a:schemeClr val="bg1"/>
      </p:bgRef>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>

      <!-- Fondo Rectángulo Superior Intcomex Dark Slate -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="HeaderBg"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="1800000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Título de Cabecera -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="800000" y="450000"/><a:ext cx="10500000" cy="900000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr vert="horz" lIns="0" tIns="0" rIns="0" bIns="0"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="es-CL" sz="3200" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>PROPUESTA COMERCIAL CISCO &bull; INTCOMEX</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr lang="es-CL" sz="1400"><a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill></a:rPr>
              <a:t>Resumen Ejecutivo y Arquitectura de la Solución | Emisión: ${escapeXml(dateStr)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Tarjeta Información del Deal -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="DealCard"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="800000" y="2200000"/><a:ext cx="5200000" cy="4000000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2500"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="250000" tIns="250000" rIns="250000" bIns="250000"/>
          <a:lstStyle/>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1800" b="1"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>Datos de la Cotización</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1300" b="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Partner / Canal: </a:t></a:r>
            <a:r><a:rPr lang="es-CL" sz="1400" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>${escapeXml(partnerName)}</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="400"/></a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1300" b="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Cliente Final: </a:t></a:r>
            <a:r><a:rPr lang="es-CL" sz="1400" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>${escapeXml(clientName)}</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="400"/></a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1300" b="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Deal ID: </a:t></a:r>
            <a:r><a:rPr lang="es-CL" sz="1300"><a:solidFill><a:srgbClr val="4338CA"/></a:solidFill></a:rPr><a:t>${escapeXml(dealId)}</a:t></a:r>
          </a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1300" b="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Estimate CCW: </a:t></a:r>
            <a:r><a:rPr lang="es-CL" sz="1300"><a:solidFill><a:srgbClr val="4338CA"/></a:solidFill></a:rPr><a:t>${escapeXml(estimateId)}</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1100"><a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill></a:rPr><a:t>Distribuidor Mayorista: Intcomex Chile &bull; Av. El Retiro 1255, Renca</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Tarjeta Inversión Total Destacada -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="TotalCard"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="6300000" y="2200000"/><a:ext cx="5100000" cy="4000000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2500"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="1E1B4B"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="4338CA"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="300000" tIns="300000" rIns="300000" bIns="300000"/>
          <a:lstStyle/>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1400" b="1"><a:solidFill><a:srgbClr val="A5B4FC"/></a:solidFill></a:rPr><a:t>TOTAL NETO SUGERIDO DE LA SOLUCIÓN</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="800"/></a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="3800" b="1"><a:solidFill><a:srgbClr val="34D399"/></a:solidFill></a:rPr><a:t>${escapeXml(formatUSD(total))}</a:t></a:r>
          </a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1400"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:rPr><a:t>Valores expresados en Dólares Americanos (USD Netos)</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="800"/></a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:rPr><a:t>&bull; Incluye costos de internación y arancel aduanero chileno.</a:t></a:r>
          </a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:rPr><a:t>&bull; Validez comercial de 30 días calendario.</a:t></a:r>
          </a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:rPr><a:t>&bull; No incluye Impuesto al Valor Agregado (IVA 19%).</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
</p:sld>`;

  // ==========================================================================
  // SLIDE 2: 3 PILARES DE LA SOLUCIÓN CISCO
  // ==========================================================================
  const slide2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvPr></p:nvGrpSpPr>
      <p:grpSpPr/>

      <!-- Header Slide 2 -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="10" name="TitleS2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="800000" y="500000"/><a:ext cx="10500000" cy="800000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
          <a:lstStyle/>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="2400" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>Desglose Estratégico de la Solución (3 Pilares)</a:t></a:r>
          </a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1300"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Distribución de la inversión por arquitectura tecnológica de hardware, software y servicios</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Pilar 1: Infraestructura y Hardware -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="11" name="Pillar1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="800000" y="1600000"/><a:ext cx="3300000" cy="4600000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2000"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="0D9488"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="200000" tIns="250000" rIns="200000" bIns="200000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200" b="1"><a:solidFill><a:srgbClr val="0D9488"/></a:solidFill></a:rPr><a:t>PILAR 1 &bull; ${escapeXml(hwPct)}% DEL TOTAL</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1800" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>Infraestructura &amp; Hardware</a:t></a:r></a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="2400" b="1"><a:solidFill><a:srgbClr val="0F766E"/></a:solidFill></a:rPr><a:t>${escapeXml(formatUSD(categories.hardwareTotal))}</a:t></a:r></a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Switches Catalyst, Routers, Meraki APs y Firewalls FTD.</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Fuentes redundantes, cables de poder y transceivers ópticos.</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; ${categories.hardwareCount} ítems clasificados como tangible.</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

      <!-- Pilar 2: Software y Licencias Cloud -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="12" name="Pillar2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="4450000" y="1600000"/><a:ext cx="3300000" cy="4600000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2000"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="6366F1"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="200000" tIns="250000" rIns="200000" bIns="200000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200" b="1"><a:solidFill><a:srgbClr val="6366F1"/></a:solidFill></a:rPr><a:t>PILAR 2 &bull; ${escapeXml(swPct)}% DEL TOTAL</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1800" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>Software &amp; Cloud</a:t></a:r></a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="2400" b="1"><a:solidFill><a:srgbClr val="4338CA"/></a:solidFill></a:rPr><a:t>${escapeXml(formatUSD(categories.softwareTotal))}</a:t></a:r></a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Suscripciones Cisco DNA Advantage / Essentials.</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Licencias Meraki Enterprise / Advanced Security.</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; ${categories.softwareCount} ítems intangibles con entrega electrónica.</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

      <!-- Pilar 3: Soporte SmartNet y Servicios -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="13" name="Pillar3"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="8100000" y="1600000"/><a:ext cx="3300000" cy="4600000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2000"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="F59E0B"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="200000" tIns="250000" rIns="200000" bIns="200000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200" b="1"><a:solidFill><a:srgbClr val="D97706"/></a:solidFill></a:rPr><a:t>PILAR 3 &bull; ${escapeXml(svcPct)}% DEL TOTAL</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1800" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>Soporte SmartNet (SNT)</a:t></a:r></a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="2400" b="1"><a:solidFill><a:srgbClr val="B45309"/></a:solidFill></a:rPr><a:t>${escapeXml(formatUSD(categories.servicesTotal))}</a:t></a:r></a:p>
          <a:p><a:endParaRPr sz="600"/></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Contratos de reemplazo de hardware 8x5xNBD o 24x7x4.</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Acceso ilimitado al TAC (Centro de Asistencia Técnica Cisco).</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="es-CL" sz="1200"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>&bull; Actualizaciones de firmware y parches de seguridad.</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
</p:sld>`;

  // ==========================================================================
  // SLIDE 3: MATRIZ DE EQUIPAMIENTO
  // ==========================================================================
  const validItems = (data.items || [])
    .filter((it) => !it.isInfoRow && it.qty > 0)
    .slice(0, 10); // Primeros 10 ítems representativos en la diapositiva

  const tableRowsXml = validItems
    .map((it, idx) => {
      const bgClr = idx % 2 === 0 ? 'FFFFFF' : 'F1F5F9';
      return `<a:tr h="340000">
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="900"/><a:t>${escapeXml(it.lineNumber || idx + 1)}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="950" b="1"/><a:t>${escapeXml(it.partNumber)}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="850"/><a:t>${escapeXml((it.description || '').slice(0, 45))}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="900"/><a:t>${escapeXml(it.qty)}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="950"/><a:t>${escapeXml(formatUSD(it.precioVentaUnitario))}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="950" b="1"/><a:t>${escapeXml(formatUSD(it.precioVentaExtendido))}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="850"/><a:t>${escapeXml(it.transformedLeadTime || 'Estándar')}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bgClr}"/></a:solidFill></a:tcPr></a:tc>
      </a:tr>`;
    })
    .join('');

  const slide3Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvPr></p:nvGrpSpPr>
      <p:grpSpPr/>

      <!-- Header Slide 3 -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="20" name="TitleS3"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="800000" y="500000"/><a:ext cx="10500000" cy="700000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
          <a:lstStyle/>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="2400" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>Matriz de Equipamiento y Licenciamiento</a:t></a:r>
          </a:p>
          <a:p>
            <a:r><a:rPr lang="es-CL" sz="1300"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Valores sugeridos netos en USD (excluyen IVA 19%) &bull; Deal ID: ${escapeXml(dealId)}</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Tabla Gráfica OpenXML -->
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="21" name="TableFrame"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="800000" y="1400000"/><a:ext cx="10600000" cy="4800000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr/>
              <a:tblGrid>
                <a:gridCol w="600000"/>
                <a:gridCol w="2400000"/>
                <a:gridCol w="3600000"/>
                <a:gridCol w="600000"/>
                <a:gridCol w="1500000"/>
                <a:gridCol w="1500000"/>
                <a:gridCol w="400000"/>
              </a:tblGrid>
              <a:tr h="400000">
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>#</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Part Number</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Descripción</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Cant.</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>P. Venta Unit.</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Total Venta</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es-CL" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Plazo</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:tcPr></a:tc>
              </a:tr>
              ${tableRowsXml}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>

    </p:spTree>
  </p:cSld>
</p:sld>`;

  zip.file('ppt/slides/slide1.xml', slide1Xml);
  zip.file('ppt/slides/slide2.xml', slide2Xml);
  zip.file('ppt/slides/slide3.xml', slide3Xml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}
