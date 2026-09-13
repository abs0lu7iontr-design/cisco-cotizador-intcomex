// ============================================================================
// CISCO AUTOMATED v2.1 - DSV EML WEB WORKER (COMLINK ASYNC BACKGROUND PARSER)
// ============================================================================

import * as Comlink from 'comlink';
import { parseCiscoEml, parseJorgeEml } from './emlParser';
import { ParsedCiscoEmlSchema, ParsedJorgeEmlSchema } from './schemas';

export const dsvEmlWorker = {
  processCiscoEmail: (rawEml: string, fileName: string) => {
    const rawParsed = parseCiscoEml(rawEml, fileName);
    const result = ParsedCiscoEmlSchema.safeParse(rawParsed);
    return result.success ? result.data : rawParsed;
  },

  processJorgeEmail: (rawEml: string, fileName: string) => {
    const rawParsed = parseJorgeEml(rawEml, fileName);
    const result = ParsedJorgeEmlSchema.safeParse(rawParsed);
    return result.success ? result.data : rawParsed;
  },
};

export type DsvEmlWorkerType = typeof dsvEmlWorker;

if (typeof self !== 'undefined') {
  Comlink.expose(dsvEmlWorker);
}
