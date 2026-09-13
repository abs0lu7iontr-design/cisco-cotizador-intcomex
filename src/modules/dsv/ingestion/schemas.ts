// ============================================================================
// CISCO AUTOMATED v2.1 - DSV INGESTION ZOD VALIDATION SCHEMAS
// ============================================================================

import { z } from 'zod';

// ----------------------------------------------------------------------------
// 1. Tipos Primitivos Ultra-Estrictos de Negocio
// ----------------------------------------------------------------------------

/**
 * Deal ID de Cisco: Exactamente 8 dígitos numéricos, iniciando por 8 o 9.
 */
export const DealIdSchema = z
  .string()
  .regex(/^[89]\d{7}$/, 'Debe ser de 8 dígitos y empezar con 8 o 9');

/**
 * PO Number (Purchase Order): Exactamente 6 dígitos numéricos.
 */
export const PoSchema = z
  .string()
  .regex(/^\d{6}$/, 'PO debe tener 6 dígitos numéricos');

/**
 * SO Number (Sales Order): Exactamente 9 dígitos numéricos.
 */
export const SoSchema = z
  .string()
  .regex(/^\d{9}$/, 'SO debe tener 9 dígitos numéricos');

/**
 * Dirección física extraída de Cisco.
 */
export const ExtractedAddressSchema = z.object({
  street: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
  city: z.string().optional(),
  country: z.string().optional(),
});

// ----------------------------------------------------------------------------
// 2. Esquemas de Validación Post-Extracción EML
// ----------------------------------------------------------------------------

/**
 * Esquema de datos para correos de la carpeta Jorge
 */
export const ParsedJorgeEmlSchema = z.object({
  dealId: DealIdSchema.nullable(),
  poNumber: PoSchema.nullable(),
  soNumber: SoSchema.nullable(),
  dateHeaderTimestamp: z.number().optional(),
});

/**
 * Esquema de datos para correos de la carpeta Cisco
 */
export const ParsedCiscoEmlSchema = z.object({
  dealId: DealIdSchema.nullable(),
  address: ExtractedAddressSchema.optional(),
  bomAttachment: z
    .object({
      fileName: z
        .string()
        .regex(/\.xlsx?$/i, 'Debe ser archivo .xls o .xlsx'),
      buffer: z.instanceof(ArrayBuffer),
    })
    .optional(),
  dateHeaderTimestamp: z.number().optional(),
});

export type ValidatedJorgeEml = z.infer<typeof ParsedJorgeEmlSchema>;
export type ValidatedCiscoEml = z.infer<typeof ParsedCiscoEmlSchema>;
