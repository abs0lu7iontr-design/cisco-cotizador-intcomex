// ============================================================================
// CISCO AUTOMATED v2.1 - SHARED DSV INGESTION PIPELINE
// Bounded Concurrency, Progress Reporting, AbortSignal & Per-File Error Isolation
// ============================================================================

import { extractHighestDealId, parseCiscoEml, parseJorgeEml } from './emlParser';
import {
  DealConsolidator,
  extractBomRevisionNumber,
  selectCanonicalBomCandidate,
} from './dealConsolidator';
import {
  BomFileCandidate,
  DsvIngestionFileError,
  DsvIngestionPhase,
  DsvIngestionPipelineResult,
  DsvIngestionProgress,
} from './types';

export interface DsvVirtualFileEntry {
  name: string;
  folder: 'cisco' | 'jorge' | 'unknown';
  lastModified: number;
  readText: () => Promise<string>;
  readArrayBuffer: () => Promise<ArrayBuffer>;
}

export interface DsvIngestionPipelineOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: DsvIngestionProgress) => void;
  parseCiscoEmailFn?: (rawContent: string, fileName: string) => Promise<any> | any;
  parseJorgeEmailFn?: (rawContent: string, fileName: string) => Promise<any> | any;
}

/**
 * Classifies a relative path or folder hint into `'cisco' | 'jorge' | 'unknown'`.
 * Supports both POSIX `/` and Windows `\` separators.
 */
export function classifyIngestionFolder(relativePathOrFolder: string): 'cisco' | 'jorge' | 'unknown' {
  const lower = String(relativePathOrFolder || '').toLowerCase();
  const parts = lower.split(/[/\\]/).filter(Boolean);
  if (parts.includes('cisco') || lower.includes('/cisco/') || lower.includes('\\cisco\\')) {
    return 'cisco';
  }
  if (parts.includes('jorge') || lower.includes('/jorge/') || lower.includes('\\jorge\\')) {
    return 'jorge';
  }
  return 'unknown';
}

export function isExcelBomFileName(fileName: string): boolean {
  const lower = String(fileName || '').toLowerCase();
  return lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.xlsm');
}

export function isEmlFileName(fileName: string): boolean {
  return String(fileName || '').toLowerCase().endsWith('.eml');
}

/**
 * Executes tasks over an array of items with bounded concurrency and AbortSignal support.
 */
export async function runWithBoundedConcurrency<T>(
  items: T[],
  concurrency: number,
  signal: AbortSignal | undefined,
  workerFn: (item: T, index: number) => Promise<void>
): Promise<{ aborted: boolean }> {
  const safeConcurrency = Math.max(1, Math.min(concurrency || 4, 16));
  let nextIndex = 0;
  let aborted = Boolean(signal?.aborted);

  const runners = Array.from(
    { length: Math.min(safeConcurrency, items.length) },
    async () => {
      while (!aborted) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        const currentIndex = nextIndex;
        if (currentIndex >= items.length) {
          break;
        }
        nextIndex += 1;
        await workerFn(items[currentIndex], currentIndex);
      }
    }
  );

  await Promise.all(runners);
  return { aborted: aborted || Boolean(signal?.aborted) };
}

/**
 * Shared DSV Ingestion Pipeline used by both DirectoryHandle and FileList/Worker connectors.
 * Guarantees:
 * - Bounded concurrency when reading/parsing files
 * - Cancellation via `AbortSignal`
 * - Per-file error isolation (`fileErrors` array while valid files still consolidate)
 * - Deterministic BOM selection independent of file discovery order
 */
export async function executeDsvIngestionPipeline(
  entries: DsvVirtualFileEntry[],
  options: DsvIngestionPipelineOptions = {}
): Promise<DsvIngestionPipelineResult> {
  const concurrency = options.concurrency ?? 4;
  const signal = options.signal;
  const parseCiscoFn = options.parseCiscoEmailFn ?? ((raw: string, name: string) => parseCiscoEml(raw, name));
  const parseJorgeFn = options.parseJorgeEmailFn ?? ((raw: string, name: string) => parseJorgeEml(raw, name));

  const consolidator = new DealConsolidator();
  const fileErrors: DsvIngestionFileError[] = [];

  // Group candidate files by role
  const looseBomEntries: DsvVirtualFileEntry[] = [];
  const ciscoEmlEntries: DsvVirtualFileEntry[] = [];
  const jorgeEmlEntries: DsvVirtualFileEntry[] = [];

  for (const entry of entries) {
    if (isExcelBomFileName(entry.name) && (entry.folder === 'cisco' || entry.folder === 'unknown')) {
      looseBomEntries.push(entry);
    } else if (isEmlFileName(entry.name)) {
      if (entry.folder === 'cisco') {
        ciscoEmlEntries.push(entry);
      } else if (entry.folder === 'jorge') {
        jorgeEmlEntries.push(entry);
      }
    }
  }

  const totalFiles =
    looseBomEntries.length + ciscoEmlEntries.length + jorgeEmlEntries.length;
  let processedFiles = 0;

  const reportProgress = (phase: DsvIngestionPhase, currentFileName?: string) => {
    options.onProgress?.({
      phase,
      processedFiles,
      totalFiles,
      currentFileName,
    });
  };

  if (signal?.aborted) {
    reportProgress('cancelled');
    return {
      records: [],
      fileErrors,
      aborted: true,
      processedFiles,
      totalFiles,
    };
  }

  // 1. Read loose BOM files with bounded concurrency and group all candidates per Deal ID
  const looseBomCandidatesByDeal = new Map<string, BomFileCandidate[]>();
  reportProgress('reading_bom');

  await runWithBoundedConcurrency(
    looseBomEntries,
    concurrency,
    signal,
    async (entry) => {
      if (signal?.aborted) return;
      try {
        const dealId = extractHighestDealId(entry.name);
        if (dealId) {
          const buffer = await entry.readArrayBuffer();
          if (!buffer || buffer.byteLength === 0) {
            throw new Error('Archivo BOM vacío o ilegible (0 bytes)');
          }
          const candidate: BomFileCandidate = {
            fileName: entry.name,
            fileBuffer: buffer,
            lastModified: entry.lastModified,
            source: 'loose_file',
            revisionHint: extractBomRevisionNumber(entry.name),
          };
          const list = looseBomCandidatesByDeal.get(dealId) || [];
          list.push(candidate);
          looseBomCandidatesByDeal.set(dealId, list);
        }
      } catch (err: any) {
        fileErrors.push({
          fileName: entry.name,
          folder: entry.folder,
          phase: 'reading_bom',
          error: err?.message || 'Error leyendo archivo BOM',
        });
      } finally {
        processedFiles += 1;
        reportProgress('reading_bom', entry.name);
      }
    }
  );

  // Select canonical loose BOM per Deal ID deterministically
  const canonicalLooseBomMap = new Map<
    string,
    { selected: BomFileCandidate; warnings: string[] }
  >();
  for (const [dealId, candidates] of looseBomCandidatesByDeal.entries()) {
    const { selected, warnings } = selectCanonicalBomCandidate(candidates);
    if (selected) {
      canonicalLooseBomMap.set(dealId, { selected, warnings });
    }
  }

  if (signal?.aborted) {
    reportProgress('cancelled');
    return {
      records: consolidator.consolidate(),
      fileErrors,
      aborted: true,
      processedFiles,
      totalFiles,
    };
  }

  // 2. Parse Cisco .eml files with bounded concurrency and error isolation
  reportProgress('parsing_cisco');
  await runWithBoundedConcurrency(
    ciscoEmlEntries,
    concurrency,
    signal,
    async (entry) => {
      if (signal?.aborted) return;
      try {
        const rawContent = await entry.readText();
        if (!rawContent || !rawContent.trim()) {
          throw new Error('Correo .eml vacío o corrupto');
        }
        const parsed = await parseCiscoFn(rawContent, entry.name);
        const dealId = parsed?.dealId || extractHighestDealId(entry.name);
        if (!dealId) {
          throw new Error('No se pudo identificar Deal ID de 8 dígitos en el correo Cisco');
        }

        const effectiveTimestamp =
          typeof parsed?.dateHeaderTimestamp === 'number' && !isNaN(parsed.dateHeaderTimestamp)
            ? parsed.dateHeaderTimestamp
            : entry.lastModified;

        const looseInfo = canonicalLooseBomMap.get(dealId);
        let bomCandidate: BomFileCandidate | undefined;
        const notifications: string[] = [...(looseInfo?.warnings || [])];

        if (parsed?.bomAttachment && parsed.bomAttachment.buffer?.byteLength > 0) {
          const emailBom: BomFileCandidate = {
            fileName: parsed.bomAttachment.fileName,
            fileBuffer: parsed.bomAttachment.buffer,
            lastModified: effectiveTimestamp,
            source: 'email_attachment',
            revisionHint: extractBomRevisionNumber(parsed.bomAttachment.fileName),
          };
          if (looseInfo?.selected) {
            const { selected, warnings } = selectCanonicalBomCandidate([
              emailBom,
              looseInfo.selected,
            ]);
            bomCandidate = selected;
            notifications.push(...warnings);
          } else {
            bomCandidate = emailBom;
          }
        } else {
          bomCandidate = looseInfo?.selected;
        }

        consolidator.registerCiscoData({
          dealId,
          fileName: entry.name,
          lastModified: effectiveTimestamp,
          address: parsed?.address,
          bomFile: bomCandidate,
          duplicateBomNotifications: notifications,
        });
      } catch (err: any) {
        fileErrors.push({
          fileName: entry.name,
          folder: 'cisco',
          phase: 'parsing_cisco',
          error: err?.message || 'Error procesando correo Cisco .eml',
        });
      } finally {
        processedFiles += 1;
        reportProgress('parsing_cisco', entry.name);
      }
    }
  );

  if (signal?.aborted) {
    reportProgress('cancelled');
    return {
      records: consolidator.consolidate(),
      fileErrors,
      aborted: true,
      processedFiles,
      totalFiles,
    };
  }

  // 3. Parse Jorge .eml files with bounded concurrency and error isolation
  reportProgress('parsing_jorge');
  await runWithBoundedConcurrency(
    jorgeEmlEntries,
    concurrency,
    signal,
    async (entry) => {
      if (signal?.aborted) return;
      try {
        const rawContent = await entry.readText();
        if (!rawContent || !rawContent.trim()) {
          throw new Error('Correo .eml de Jorge vacío o corrupto');
        }
        const parsed = await parseJorgeFn(rawContent, entry.name);
        const dealId = parsed?.dealId || extractHighestDealId(entry.name);
        if (!dealId) {
          throw new Error('No se pudo identificar Deal ID en el correo de Jorge');
        }

        const effectiveTimestamp =
          typeof parsed?.dateHeaderTimestamp === 'number' && !isNaN(parsed.dateHeaderTimestamp)
            ? parsed.dateHeaderTimestamp
            : entry.lastModified;

        consolidator.registerJorgeData({
          dealId,
          fileName: entry.name,
          lastModified: effectiveTimestamp,
          poNumber: parsed?.poNumber || '',
          soNumber: parsed?.soNumber || '',
        });
      } catch (err: any) {
        fileErrors.push({
          fileName: entry.name,
          folder: 'jorge',
          phase: 'parsing_jorge',
          error: err?.message || 'Error procesando correo Jorge .eml',
        });
      } finally {
        processedFiles += 1;
        reportProgress('parsing_jorge', entry.name);
      }
    }
  );

  // 4. Register any loose BOMs that did not have a matching Cisco .eml
  reportProgress('consolidating');
  for (const [dealId, info] of canonicalLooseBomMap.entries()) {
    if (!consolidator.hasCiscoData(dealId)) {
      consolidator.registerCiscoData({
        dealId,
        fileName: info.selected.fileName,
        lastModified: info.selected.lastModified,
        bomFile: info.selected,
        duplicateBomNotifications: info.warnings,
      });
    }
  }

  const records = consolidator.consolidate();
  reportProgress('completed');

  return {
    records,
    fileErrors,
    aborted: Boolean(signal?.aborted),
    processedFiles,
    totalFiles,
  };
}
