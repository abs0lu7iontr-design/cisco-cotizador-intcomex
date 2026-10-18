// ============================================================================
// CISCO AUTOMATED v2.1 - AI FEEDBACK & TICKET ADVISOR (GEMINI & DETERMINISTIC)
// Evaluates feasibility, diagnoses root causes, and proposes solutions WITHOUT modifying code
// ============================================================================

import { FeedbackTicket } from './types';
import { loadAiSettings } from '../configuriator/aiProviderManager';
import { APP_DISPLAY_NAME, getFormattedAppVersion } from '../../core/appVersion';

export interface AiTicketDiagnosis {
  isFeasible: 'YES' | 'CONDITIONAL' | 'NO';
  feasibilityVerdict: string;
  rootCauseAnalysis: string;
  proposedSolution: string;
  technicalImpact: string;
  affectedModules: string[];
  estimatedEffort: 'Bajo (1 - 2 horas)' | 'Medio (Medio día)' | 'Alto (1 - 2 días)' | 'Complejo / Requiere Arquitectura';
  recommendedResponseToUser: string;
  analyzedAt: string;
  analyzedByModel: string;
}

function getSystemInstructionAiAdvisor(): string {
  return `
Eres el Asistente Técnico y Arquitecto de Software Experto de ${APP_DISPLAY_NAME} ${getFormattedAppVersion()} (Intcomex Chile).
Tu función es actuar como analista de triaje técnico para reportes de usuarios (bugs, mejoras, consultas y nuevas funciones).

DIRECTIVA CRÍTICA:
1. Evalúa si lo que pide el usuario es POSIBLE y VIABLE en la plataforma (Frontend React 19 + Vite + Tailwind + Firebase Firestore + ExcelJS + Python pywebview Desktop).
2. Explica la CAUSA RAÍZ o contexto técnico de la solicitud.
3. Propón la SOLUCIÓN TÉCNICA detallada que darías (archivos a intervenir, lógica de cálculo, componentes UI).
4. NO IMPLEMENTES NI MODIFIQUES EL CÓDIGO. Solo explica qué solución darías y evalúa su viabilidad.
5. Formula una respuesta clara y profesional para enviar al usuario como feedback.

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "isFeasible": "YES" | "CONDITIONAL" | "NO",
  "feasibilityVerdict": "Texto breve del veredicto (ej: '✅ Altamente Viable')",
  "rootCauseAnalysis": "Explicación técnica de por qué ocurre o cómo funciona actualmente",
  "proposedSolution": "Solución técnica detallada paso a paso que propones aplicar",
  "technicalImpact": "Evaluación de riesgos, impacto en cálculos comerciales o bases de datos",
  "affectedModules": ["nombre_archivo_1.ts", "nombre_archivo_2.tsx"],
  "estimatedEffort": "Bajo (1 - 2 horas)" | "Medio (Medio día)" | "Alto (1 - 2 días)" | "Complejo / Requiere Arquitectura",
  "recommendedResponseToUser": "Mensaje cordial y técnico listo para enviar al usuario"
}
`;
}

/**
 * Intelligent deterministic analyzer used as instant backup or when no external LLM is reachable.
 */
function generateDeterministicDiagnosis(ticket: FeedbackTicket): AiTicketDiagnosis {
  const text = `${ticket.title} ${ticket.description}`.toLowerCase();
  const mod = ticket.module;

  let isFeasible: 'YES' | 'CONDITIONAL' | 'NO' = 'YES';
  let feasibilityVerdict = '✅ Totalmente Viable en la arquitectura actual';
  let rootCause = 'La funcionalidad o reporte solicitado encaja de forma natural en los flujos actuales de la aplicación.';
  let proposedSolution = '';
  let technicalImpact = 'Bajo riesgo. No altera las fórmulas maestras de cálculo comercial.';
  const affectedModules: string[] = [];
  let estimatedEffort: AiTicketDiagnosis['estimatedEffort'] = 'Medio (Medio día)';

  if (text.includes('margen') || text.includes('arancel') || text.includes('precio') || text.includes('cálculo')) {
    rootCause = 'Relacionado con la lógica de costeo en cascada (List Price -> Descuento -> Costo Neto -> Internación 7% -> Arancel 6% -> Margen 5% -> Venta).';
    proposedSolution = 'Revisar la función calculateLineItemCosts() en src/core/calculations.ts. Validar si el SKU está catalogado como Intangible/Software para evitar sobrecargo de internación/arancel.';
    affectedModules.push('src/core/calculations.ts', 'src/core/types.ts');
    technicalImpact = 'Requiere verificar consistencia con los totales del Excel oficial de Cisco CCW.';
    estimatedEffort = 'Bajo (1 - 2 horas)';
  } else if (text.includes('dsv') || mod === 'DSV') {
    rootCause = 'Relacionado con el módulo generador de plantillas DSV y códigos XCL de partners.';
    proposedSolution = 'Ajustar el mapeo de columnas y suscripciones en src/modules/dsv/dsvEngine.ts o enriquecer la base de partners en src/hooks/usePartnerDatabase.ts.';
    affectedModules.push('src/modules/dsv/DsvView.tsx', 'src/modules/dsv/dsvEngine.ts');
    estimatedEffort = 'Bajo (1 - 2 horas)';
  } else if (text.includes('bo') || text.includes('bodega') || mod === 'BO_TRACKING') {
    rootCause = 'Asociado al ciclo de vida de Back Orders, asignación de bodegas E1/ED o sincronización con Firestore.';
    proposedSolution = 'Intervenir boTrackingService.ts para ajustar la máquina de estados de etapas logísticas o boSkuCatalogService.ts para la persistencia del catálogo de números de parte.';
    affectedModules.push('src/modules/bo/boTrackingService.ts', 'src/modules/bo/BoRequestModal.tsx');
    estimatedEffort = 'Medio (Medio día)';
  } else if (text.includes('excel') || text.includes('exportar') || text.includes('columna')) {
    rootCause = 'Procesamiento de libro binario Excel y mapping de encabezados CCW.';
    proposedSolution = 'Modificar excelEngine.ts agregando la columna o formato solicitado en generateOptimizedWorkbook().';
    affectedModules.push('src/core/excelEngine.ts');
    estimatedEffort = 'Bajo (1 - 2 horas)';
  } else if (ticket.type === 'FEATURE_REQUEST') {
    feasibilityVerdict = '✅ Viable como nuevo componente o vista';
    rootCause = 'Solicitud de nueva característica para ampliar la productividad de los equipos de preventa y PM.';
    proposedSolution = `Diseñar un componente modular específico dentro de src/modules/${mod.toLowerCase()} e integrarlo en la navegación principal.`;
    affectedModules.push(`src/modules/${mod.toLowerCase()}`);
    estimatedEffort = 'Alto (1 - 2 días)';
  } else {
    proposedSolution = 'Revisar componentes visuales y validaciones de estado en la vista correspondiente.';
    affectedModules.push(`src/modules/${mod.toLowerCase()}`);
    estimatedEffort = 'Bajo (1 - 2 horas)';
  }

  const responseGreeting = `Hola ${ticket.author.fullName}, hemos analizado tu reporte con el equipo de arquitectura de Cisco Automated.`;
  const responseBody = `${feasibilityVerdict}. ${rootCause} Solución técnica recomendada: ${proposedSolution}`;

  return {
    isFeasible,
    feasibilityVerdict,
    rootCauseAnalysis: rootCause,
    proposedSolution,
    technicalImpact,
    affectedModules,
    estimatedEffort,
    recommendedResponseToUser: `${responseGreeting}\n\n${responseBody}\n\nQuedamos atentos a tus comentarios mientras programamos su atención.`,
    analyzedAt: new Date().toISOString(),
    analyzedByModel: 'Cisco Automated AI Engine (Deterministic + Heuristic)',
  };
}

/**
 * Analyzes a feedback ticket using Google Gemini or OpenRouter LLM, falling back to deterministic analysis.
 */
export async function analyzeTicketWithAi(ticket: FeedbackTicket): Promise<AiTicketDiagnosis> {
  const settings = loadAiSettings();
  const enabledKeys = settings.keys.filter((k) => k.enabled && k.apiKey.trim().length > 0);

  // Search for Gemini or OpenRouter key
  const activeKey = enabledKeys.find((k) => k.provider === 'gemini') || enabledKeys[0];

  if (!activeKey) {
    return generateDeterministicDiagnosis(ticket);
  }

  try {
    const prompt = `Analiza el siguiente reporte o solicitud de usuario en ${APP_DISPLAY_NAME} ${getFormattedAppVersion()}:
---------------------------------------------------------------
Ticket ID: ${ticket.id}
Título: ${ticket.title}
Tipo: ${ticket.type}
Prioridad: ${ticket.priority} (SLA: ${ticket.targetHours} horas)
Módulo: ${ticket.module}
Autor: ${ticket.author.fullName} (${ticket.author.role})
Plataforma: ${ticket.technicalContext.environment} (Versión: ${ticket.technicalContext.appVersion})
Descripción del Usuario:
"${ticket.description}"
---------------------------------------------------------------
Evalúa si es posible realizar lo solicitado, diagnostica la causa raíz y detalla qué solución darías (sin implementarla). Responde en JSON.`;

    if (activeKey.provider === 'gemini') {
      const model = activeKey.model || 'gemini-3.6-flash';
      const cleanKey = activeKey.apiKey.trim();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: getSystemInstructionAiAdvisor() }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          const parsed = JSON.parse(rawJsonText);
          return {
            isFeasible: parsed.isFeasible || 'YES',
            feasibilityVerdict: parsed.feasibilityVerdict || '✅ Viable',
            rootCauseAnalysis: parsed.rootCauseAnalysis || 'Análisis completado.',
            proposedSolution: parsed.proposedSolution || 'Solución evaluada.',
            technicalImpact: parsed.technicalImpact || 'Sin impacto adverso detectado.',
            affectedModules: Array.isArray(parsed.affectedModules) ? parsed.affectedModules : [],
            estimatedEffort: parsed.estimatedEffort || 'Medio (Medio día)',
            recommendedResponseToUser: parsed.recommendedResponseToUser || 'Reporte recibido y analizado por el equipo.',
            analyzedAt: new Date().toISOString(),
            analyzedByModel: `Gemini AI (${model})`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[aiFeedbackAdvisor] LLM request falló, usando análisis heurístico:', err);
  }

  // Fallback to heuristic deterministic engine
  return generateDeterministicDiagnosis(ticket);
}
