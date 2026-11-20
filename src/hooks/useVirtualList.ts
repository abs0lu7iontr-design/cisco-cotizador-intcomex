// ============================================================================
// CISCO AUTOMATED v2.23.0 - REACT 19 NATIVE TABLE & LIST VIRTUALIZER HOOK
// High-Performance Zero-Dependency Virtual Scrolling (60 FPS)
// Renders only visible rows + buffer overscan for tables with 1,000+ items
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface UseVirtualListOptions {
  itemsCount: number;
  estimateSize?: number | ((index: number) => number);
  overscan?: number;
  parentRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  minItemsToActivate?: number;
}

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export interface UseVirtualListResult {
  virtualItems: VirtualItem[];
  totalHeight: number;
  paddingTop: number;
  paddingBottom: number;
  startIndex: number;
  endIndex: number;
  isVirtualActive: boolean;
  renderedCount: number;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

export function useVirtualList({
  itemsCount,
  estimateSize = 48,
  overscan = 6,
  parentRef,
  enabled = true,
  minItemsToActivate = 30,
}: UseVirtualListOptions): UseVirtualListResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const rafRef = useRef<number | null>(null);

  const getItemSize = useCallback(
    (index: number) => {
      if (typeof estimateSize === 'function') {
        return estimateSize(index);
      }
      return estimateSize;
    },
    [estimateSize]
  );

  // Determina si la virtualización debe estar activa
  const isVirtualActive = enabled && itemsCount >= minItemsToActivate;

  // Medir altura del contenedor y escuchar scroll
  useEffect(() => {
    const element = parentRef.current;
    if (!element || !isVirtualActive) return;

    // Actualizar dimensiones iniciales
    setViewportHeight(element.clientHeight || 600);
    setScrollTop(element.scrollTop || 0);

    const handleScroll = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        if (parentRef.current) {
          setScrollTop(parentRef.current.scrollTop);
        }
      });
    };

    const handleResize = () => {
      if (parentRef.current) {
        setViewportHeight(parentRef.current.clientHeight);
      }
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Observador de mutación o ResizeObserver si está disponible
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === element) {
            setViewportHeight(element.clientHeight);
          }
        }
      });
      resizeObserver.observe(element);
    }

    return () => {
      element.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [parentRef, isVirtualActive]);

  // Posiciones acumuladas de cada ítem
  const { offsets, totalHeight } = useMemo(() => {
    const offs: number[] = new Array(itemsCount);
    let currentOffset = 0;
    for (let i = 0; i < itemsCount; i++) {
      offs[i] = currentOffset;
      currentOffset += getItemSize(i);
    }
    return { offsets: offs, totalHeight: currentOffset };
  }, [itemsCount, getItemSize]);

  // Cálculo del rango visible (startIndex, endIndex)
  const { startIndex, endIndex } = useMemo(() => {
    if (!isVirtualActive || itemsCount === 0) {
      return { startIndex: 0, endIndex: Math.max(0, itemsCount - 1) };
    }

    // Búsqueda binaria para encontrar el startIndex basado en scrollTop
    let low = 0;
    let high = itemsCount - 1;
    let start = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (offsets[mid] <= scrollTop) {
        start = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const startWithOverscan = Math.max(0, start - overscan);

    // Calcular endIndex
    const endOffset = scrollTop + viewportHeight;
    let end = start;
    while (end < itemsCount - 1 && offsets[end] < endOffset) {
      end++;
    }

    const endWithOverscan = Math.min(itemsCount - 1, end + overscan);

    return {
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
    };
  }, [isVirtualActive, itemsCount, offsets, scrollTop, viewportHeight, overscan]);

  // Ítems virtuales renderizables
  const virtualItems = useMemo(() => {
    if (!isVirtualActive || itemsCount === 0) {
      return Array.from({ length: itemsCount }, (_, i) => ({
        index: i,
        start: offsets[i] || 0,
        size: getItemSize(i),
      }));
    }

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        start: offsets[i] || 0,
        size: getItemSize(i),
      });
    }
    return items;
  }, [isVirtualActive, itemsCount, startIndex, endIndex, offsets, getItemSize]);

  // Padding superior e inferior para simular la altura total sin pintar todas las filas
  const paddingTop = useMemo(() => {
    if (!isVirtualActive || startIndex <= 0) return 0;
    return offsets[startIndex] || 0;
  }, [isVirtualActive, startIndex, offsets]);

  const paddingBottom = useMemo(() => {
    if (!isVirtualActive || endIndex >= itemsCount - 1) return 0;
    const endItemBottom = (offsets[endIndex] || 0) + getItemSize(endIndex);
    return Math.max(0, totalHeight - endItemBottom);
  }, [isVirtualActive, endIndex, itemsCount, offsets, totalHeight, getItemSize]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const clamped = Math.max(0, Math.min(itemsCount - 1, index));
      const targetOffset = offsets[clamped] || 0;
      if (parentRef.current) {
        parentRef.current.scrollTo({ top: targetOffset, behavior });
      }
    },
    [itemsCount, offsets, parentRef]
  );

  return {
    virtualItems,
    totalHeight,
    paddingTop,
    paddingBottom,
    startIndex,
    endIndex,
    isVirtualActive,
    renderedCount: virtualItems.length,
    scrollToIndex,
  };
}
