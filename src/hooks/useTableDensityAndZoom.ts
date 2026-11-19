import { useState, useMemo, useEffect, CSSProperties } from 'react';

export type TableDensityMode = 'auto' | 'compact' | 'normal';

export interface UseTableDensityAndZoomOptions {
  storageKeyPrefix: string;
  defaultDensity?: TableDensityMode;
  defaultZoom?: number;
}

/**
 * Hook universal para gestión de densidad visual y escala de zoom local
 * en tablas complejas (Forecast, Pipeline, CCW, CCW-R, BO, DSV, Demanda).
 *
 * Permite que cada tabla se auto-ajuste fluidamente a monitores de cualquier resolución
 * (laptops 1366x768, 1080p escaladas a 125%/150%, 2K/4K y móviles) sin necesidad
 * de alterar el zoom general del navegador web o de Windows.
 */
export function useTableDensityAndZoom({
  storageKeyPrefix,
  defaultDensity = 'auto',
  defaultZoom = 100,
}: UseTableDensityAndZoomOptions) {
  const [tableDensity, setTableDensity] = useState<TableDensityMode>(() => {
    try {
      const saved = localStorage.getItem(`${storageKeyPrefix}_density`);
      if (saved === 'auto' || saved === 'compact' || saved === 'normal') return saved;
    } catch (_) {}
    return defaultDensity;
  });

  const [tableZoom, setTableZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${storageKeyPrefix}_zoom`);
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 75 && val <= 115) return val;
      }
    } catch (_) {}
    return defaultZoom;
  });

  // Detección reactiva de tamaño de pantalla (laptop/pantalla compacta vs monitor amplio)
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1440;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 1440);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSetTableDensity = (density: TableDensityMode) => {
    setTableDensity(density);
    try {
      localStorage.setItem(`${storageKeyPrefix}_density`, density);
    } catch (_) {}
  };

  const handleSetTableZoom = (zoomVal: number) => {
    const clamped = Math.max(75, Math.min(115, zoomVal));
    setTableZoom(clamped);
    try {
      localStorage.setItem(`${storageKeyPrefix}_zoom`, String(clamped));
    } catch (_) {}
  };

  // En modo 'auto', adopta densidad compacta en pantallas < 1440px y normal en monitores grandes
  const effectiveDensity = useMemo<'compact' | 'normal'>(() => {
    if (tableDensity === 'compact') return 'compact';
    if (tableDensity === 'normal') return 'normal';
    return isSmallScreen ? 'compact' : 'normal';
  }, [tableDensity, isSmallScreen]);

  const headPaddingClass = useMemo(() => {
    if (effectiveDensity === 'compact') return 'px-2 py-1.5 2xl:px-2.5 2xl:py-2 text-[10px] 2xl:text-[10.5px]';
    return 'px-3.5 py-2.5 text-xs';
  }, [effectiveDensity]);

  const cellPaddingClass = useMemo(() => {
    if (effectiveDensity === 'compact') return 'px-2 py-1.5 2xl:px-2.5 2xl:py-2 text-[10.5px] 2xl:text-[11px]';
    return 'px-3.5 py-2.5 text-xs';
  }, [effectiveDensity]);

  const zoomStyle = useMemo<CSSProperties | undefined>(() => {
    return tableZoom !== 100 ? { zoom: `${tableZoom}%` } : undefined;
  }, [tableZoom]);

  return {
    tableDensity,
    tableZoom,
    effectiveDensity,
    isSmallScreen,
    headPaddingClass,
    cellPaddingClass,
    zoomStyle,
    handleSetTableDensity,
    handleSetTableZoom,
  };
}
