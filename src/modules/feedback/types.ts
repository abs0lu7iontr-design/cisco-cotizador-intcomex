// ============================================================================
// CISCO AUTOMATED v2.1 - FEEDBACK, BUG REPORT & IMPROVEMENT TICKETING SYSTEM
// Types & Domain Models
// ============================================================================

export type FeedbackType =
  | 'BUG'            // Error o falla técnica en la aplicación
  | 'IMPROVEMENT'    // Optimización o ajuste de una funcionalidad existente
  | 'FEATURE_REQUEST'// Nueva característica o módulo solicitado
  | 'UX_UI'          // Diseño, usabilidad o visualización
  | 'DATA_CATALOG'   // Discrepancia en reglas de catálogo, SKUs o aranceles
  | 'OTHER';         // Felicitaciones, consultas generales u otro

export type TicketPriority =
  | 'CRITICAL' // SLA: 4 horas (Bloquea cotizaciones o cálculos críticos)
  | 'HIGH'     // SLA: 24 horas (Problema severo sin solución alternativa ágil)
  | 'MEDIUM'   // SLA: 72 horas (3 días - Problema menor o mejora relevante)
  | 'LOW';     // SLA: 120 horas (5 días - Sugerencia estética, idea a futuro)

export type TicketStatus =
  | 'OPEN'        // Recién reportado, pendiente de triaje
  | 'IN_PROGRESS' // En análisis o desarrollo por el equipo técnico
  | 'RESOLVED'    // Solucionado o implementado en build
  | 'CLOSED'      // Confirmado por el usuario y archivado
  | 'REJECTED';   // Descartado con justificación técnica

export type ModuleContext =
  | 'QUOTER'        // Cotizador Cisco CCW
  | 'CONFIGURIATOR' // ConfigurIAtor AI BOM Generator
  | 'DSV'           // Generador de DSV Cisco
  | 'BO_TRACKING'   // Back Order & Seguimiento Logístico
  | 'ESTIMATES'     // Historial de Cotizaciones
  | 'MINING'        // Auditoría de Minería & Daniel Peña Alert
  | 'SETTINGS'      // Configuración, Temas & Auto-Deploy
  | 'DESKTOP_APP'   // Aplicación de Escritorio Portable
  | 'GENERAL';      // General / Múltiples módulos

export type SlaStatus =
  | 'ON_TIME'     // Dentro del plazo (> 25% de tiempo restante)
  | 'NEAR_BREACH' // En riesgo (< 25% de tiempo restante antes de vencer)
  | 'BREACHED';   // SLA Vencido

export interface TicketAttachment {
  name: string;
  dataUrl: string; // Base64 data URL for images
  sizeKb: number;
}

export interface TicketAuthor {
  username: string;
  fullName: string;
  email?: string;
  role: string;
}

export interface TechnicalContext {
  appVersion: string;
  gitCommit: string;
  environment: 'Desktop' | 'Web Cloudflare' | 'Local Dev';
  userAgent: string;
  activeView: string;
  currentEstimateFileName?: string;
  dealId?: string;
  estimateId?: string;
}

export interface TicketFeedbackMessage {
  id: string;
  author: {
    username: string;
    fullName: string;
    role: string;
    isSupportTeam: boolean;
  };
  message: string;
  createdAt: string; // ISO 8601
  statusChange?: TicketStatus;
  isInternalNote?: boolean;
}

export interface FeedbackTicket {
  id: string; // e.g., 'TICK-202610-1234'
  title: string;
  description: string;
  type: FeedbackType;
  priority: TicketPriority;
  status: TicketStatus;
  module: ModuleContext;
  
  // SLA Fields
  targetHours: number;
  dueAt: string;          // ISO 8601 = createdAt + targetHours
  resolvedAt?: string;    // ISO 8601 when status was set to RESOLVED
  timeToResolutionMinutes?: number;

  // Stakeholders
  author: TicketAuthor;
  assignedTo?: {
    username: string;
    fullName: string;
  };

  // Context & Evidence
  technicalContext: TechnicalContext;
  attachments: TicketAttachment[];

  // Conversation & Feedback Thread
  responses: TicketFeedbackMessage[];

  // Read States
  readByAuthor: boolean;
  readBySupport: boolean;

  // AI Triage & Feasibility Analysis (Without code modification)
  aiDiagnosis?: import('./aiFeedbackAdvisor').AiTicketDiagnosis;

  // Timestamps
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateTicketInput {
  title: string;
  description: string;
  type: FeedbackType;
  priority: TicketPriority;
  module: ModuleContext;
  attachments?: TicketAttachment[];
  customContext?: Partial<TechnicalContext>;
}

export interface SlaInfo {
  status: SlaStatus;
  remainingMs: number;
  formattedRemaining: string;
  isBreached: boolean;
  percentUsed: number;
}
