import React, { useEffect, useRef, useId, useMemo } from 'react';

// ============================================================================
// Pila global determinista de modales abiertos (soporta modales anidados)
// ============================================================================
const activeModalStack: string[] = [];

export function pushModalToStack(modalId: string): void {
  const existingIdx = activeModalStack.indexOf(modalId);
  if (existingIdx !== -1) {
    activeModalStack.splice(existingIdx, 1);
  }
  activeModalStack.push(modalId);
}

export function removeModalFromStack(modalId: string): void {
  const existingIdx = activeModalStack.indexOf(modalId);
  if (existingIdx !== -1) {
    activeModalStack.splice(existingIdx, 1);
  }
}

export function isTopMostModal(modalId: string): boolean {
  if (activeModalStack.length === 0) return false;
  return activeModalStack[activeModalStack.length - 1] === modalId;
}

export function getActiveModalStack(): readonly string[] {
  return [...activeModalStack];
}

export function clearModalStackForTesting(): void {
  activeModalStack.length = 0;
}

/**
 * Calcula de forma determinista el siguiente índice dentro de una trampa de foco
 * al presionar Tab o Shift+Tab.
 */
export function computeNextFocusTrapIndex(
  currentIndex: number,
  totalFocusable: number,
  shiftKey: boolean
): number {
  if (totalFocusable <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= totalFocusable) {
    return shiftKey ? totalFocusable - 1 : 0;
  }
  if (shiftKey) {
    return currentIndex === 0 ? totalFocusable - 1 : currentIndex - 1;
  }
  return currentIndex === totalFocusable - 1 ? 0 : currentIndex + 1;
}

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container || typeof container.querySelectorAll !== 'function') return [];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

export interface UseAccessibleModalOptions {
  isOpen: boolean;
  onClose?: () => void;
  titleId?: string;
  descriptionId?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
}

export interface AccessibleModalResult<T extends HTMLElement = HTMLDivElement> {
  dialogRef: React.RefObject<T | null>;
  titleId: string;
  descriptionId: string;
  dialogProps: {
    ref: React.RefObject<T | null>;
    role: 'dialog';
    'aria-modal': true;
    'aria-labelledby': string;
    'aria-describedby'?: string;
    tabIndex: -1;
  };
}

/**
 * Hook común de accesibilidad para modales:
 * - Gestiona role="dialog", aria-modal="true", aria-labelledby y aria-describedby
 * - Mantiene una pila de modales anidados para que Escape cierre únicamente el modal superior
 * - Atrapa el foco con Tab / Shift+Tab dentro del modal activo
 * - Restaura el foco al elemento disparador original al cerrarse
 */
export function useAccessibleModal<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  titleId: customTitleId,
  descriptionId: customDescriptionId,
  initialFocusRef,
  closeOnEscape = true,
}: UseAccessibleModalOptions): AccessibleModalResult<T> {
  const reactId = useId();
  const modalInstanceId = useMemo(() => `modal-${reactId}`, [reactId]);
  const resolvedTitleId = customTitleId || `${modalInstanceId}-title`;
  const resolvedDescriptionId = customDescriptionId || `${modalInstanceId}-desc`;

  const dialogRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    pushModalToStack(modalInstanceId);

    const focusTimer = setTimeout(() => {
      if (!isTopMostModal(modalInstanceId)) return;
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const focusables = getFocusableElements(dialogRef.current);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopMostModal(modalInstanceId)) return;

      if (event.key === 'Escape' && closeOnEscape) {
        if (onCloseRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (event.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;

        const focusables = getFocusableElements(container);
        if (focusables.length === 0) {
          event.preventDefault();
          container.focus();
          return;
        }

        const activeEl =
          typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const currentIndex = activeEl ? focusables.indexOf(activeEl) : -1;
        const nextIndex = computeNextFocusTrapIndex(
          currentIndex,
          focusables.length,
          event.shiftKey
        );

        if (nextIndex >= 0 && focusables[nextIndex]) {
          event.preventDefault();
          focusables[nextIndex].focus();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      clearTimeout(focusTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown, true);
      }
      removeModalFromStack(modalInstanceId);

      const prevEl = previousActiveElementRef.current;
      if (
        prevEl &&
        typeof prevEl.focus === 'function' &&
        typeof document !== 'undefined' &&
        document.contains(prevEl)
      ) {
        try {
          prevEl.focus();
        } catch {
          // Ignore focus errors on detached nodes
        }
      }
    };
  }, [isOpen, modalInstanceId, closeOnEscape, initialFocusRef]);

  return {
    dialogRef,
    titleId: resolvedTitleId,
    descriptionId: resolvedDescriptionId,
    dialogProps: {
      ref: dialogRef,
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': resolvedTitleId,
      'aria-describedby': customDescriptionId ? resolvedDescriptionId : undefined,
      tabIndex: -1,
    },
  };
}
