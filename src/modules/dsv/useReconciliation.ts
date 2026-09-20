// ============================================================================
// CISCO AUTOMATED v2.1 - FINANCIAL RECONCILIATION HOOK (DECOUPLED LOGIC)
// ============================================================================

import { useMemo } from 'react';
import { ReconciliationItem } from './types';

export function useReconciliation(items: ReconciliationItem[]) {
  const totals = useMemo(() => {
    const theo = items.reduce((acc, curr) => acc + curr.theoreticalPrice, 0);
    const off = items.reduce((acc, curr) => acc + curr.officialPrice, 0);
    const diff = off - theo;
    const diffPercent = theo !== 0 ? (diff / theo) * 100 : 0;
    return { theo, off, diff, diffPercent };
  }, [items]);

  const hasHighVariance = Math.abs(totals.diff) > 1000;

  return { totals, hasHighVariance };
}
