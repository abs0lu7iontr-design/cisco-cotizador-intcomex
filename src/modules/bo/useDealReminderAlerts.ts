// ============================================================================
// CISCO AUTOMATED v2.1 - USE DEAL REMINDER ALERTS HOOK
// Hook reactivo para monitorear proactivamente Deals pendientes de descuentos
// y activar el Pop-up a mediodía (12:00) y fin de jornada (17:30)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { DealReminderRecord } from './dealReminderTypes';
import { getDealsDueForPopup } from './dealReminderService';

export function useDealReminderAlerts() {
  const [dueDeals, setDueDeals] = useState<DealReminderRecord[]>([]);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [hasCheckedInitially, setHasCheckedInitially] = useState(false);

  const checkAlerts = useCallback(async () => {
    try {
      const due = await getDealsDueForPopup();
      if (due && due.length > 0) {
        setDueDeals(due);
        setIsAlertOpen(true);
      } else {
        setDueDeals([]);
        setIsAlertOpen(false);
      }
    } catch (err) {
      console.warn('[useDealReminderAlerts] Error consultando Deals vencidos:', err);
    }
  }, []);

  // 1. Verificación inicial al cargar la app (con retardo de 2.5s para no bloquear render)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAlerts();
      setHasCheckedInitially(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [checkAlerts]);

  // 2. Verificación periódica cada 60 segundos
  useEffect(() => {
    if (!hasCheckedInitially) return;

    const interval = setInterval(() => {
      checkAlerts();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [checkAlerts, hasCheckedInitially]);

  // 3. Verificación al enfocar la pestaña del navegador
  useEffect(() => {
    const handleFocus = () => {
      checkAlerts();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkAlerts]);

  const closeAlert = useCallback(() => {
    setIsAlertOpen(false);
  }, []);

  return {
    dueDeals,
    isAlertOpen,
    closeAlert,
    refreshAlerts: checkAlerts,
  };
}
