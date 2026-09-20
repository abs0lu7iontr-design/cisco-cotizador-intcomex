// ============================================================================
// CISCO AUTOMATED v2.1 - UNIFIED DISCREPANCY RECONCILIATION MODAL (THEMED)
// ============================================================================

import React from 'react';
import { useAppTheme } from '../../context/ThemeContext';
import { useReconciliation } from './useReconciliation';
import { CyberHudLayout } from './themes/CyberHudLayout';
import { EnterpriseCleanLayout } from './themes/EnterpriseCleanLayout';
import { ReconciliationItem, resolveCategoryBadge } from './types';
import { DsvDiscrepancy } from './dsvEngine';

interface Props {
  isOpen: boolean;
  items?: ReconciliationItem[];
  discrepancies?: DsvDiscrepancy[];
  onResolve: (decision: 'BOM' | 'MATH') => void;
  onCancel: () => void;
}

export const DsvDiscrepancyModal: React.FC<Props> = ({
  isOpen,
  items,
  discrepancies,
  onResolve,
  onCancel,
}) => {
  const { theme } = useAppTheme();

  // Mapear discrepancies a ReconciliationItem si no se proporcionaron items explícitos
  const effectiveItems: ReconciliationItem[] = React.useMemo(() => {
    if (items && items.length > 0) return items;
    if (discrepancies && discrepancies.length > 0) {
      return discrepancies.map((d) => ({
        sku: d.sku,
        description: `Línea ${d.lineNumber} • Duración: ${d.durationMonths} meses`,
        categoryTag: resolveCategoryBadge(d.sku),
        theoreticalPrice: d.calculatedPrice,
        officialPrice: d.bomReportedPrice,
      }));
    }
    return [];
  }, [items, discrepancies]);

  const { totals, hasHighVariance } = useReconciliation(effectiveItems);

  if (!isOpen || effectiveItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#02050e]/85 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Resplandores holográficos solo visibles en Cyber HUD */}
      {theme === 'cyber' && (
        <>
          <div className="absolute w-[500px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none -top-20 left-1/4" />
          <div className="absolute w-[450px] h-[300px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none -bottom-10 right-1/4" />
        </>
      )}

      {theme === 'cyber' ? (
        <CyberHudLayout
          items={effectiveItems}
          totals={totals}
          hasHighVariance={hasHighVariance}
          onResolve={onResolve}
          onCancel={onCancel}
        />
      ) : (
        <EnterpriseCleanLayout
          items={effectiveItems}
          totals={totals}
          onResolve={onResolve}
          onCancel={onCancel}
        />
      )}
    </div>
  );
};
