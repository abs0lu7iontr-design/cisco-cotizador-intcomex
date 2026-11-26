// ============================================================================
// CISCO AUTOMATED v2.1 - MAIN APPLICATION ENTRYPOINT
// ============================================================================

import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  CiscoAutomatedProvider,
  useCiscoAutomatedStore,
} from './core/store';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { ParameterSidebar } from './components/ParameterSidebar';
import { InteractiveTable } from './components/InteractiveTable';
import { ExcelSheetPreview } from './components/ExcelSheetPreview';
import type { OverrideRuleType } from './core/types';
import type { QuickCalculatorPrefillItem } from './components/QuickCalculator';
import { appendWebAuditLog } from './core/webAuditLog';
import { isPureLicensingQuote } from './core/exportUtils';
import { getMotherLineKey } from './core/calculations';
import { openDesktopFileDialog } from './core/desktopBridge';
import { PriorAuditDetectedModal } from './components/PriorAuditDetectedModal';
import { AutoUpdateBanner } from './components/AutoUpdateBanner';
import { MiningAuditModal } from './modules/mining/MiningAuditModal';
import { MiningAlertModal } from './modules/mining/MiningAlertModal';
import { MiningFastTrackWarningModal } from './modules/mining/MiningFastTrackWarningModal';
import { BoLineItem, resolveWarehouseForLines } from './modules/bo/boTypes';
import { findSkuInCatalog, getLocalBoSkuCache } from './modules/bo/boSkuCatalogService';
import { getBoTrackings } from './modules/bo/boTrackingService';
import { useDealReminderAlerts } from './modules/bo/useDealReminderAlerts';
import { AmbientMeshGlow } from './components/AmbientMeshGlow';
import { MisroutedFileModal } from './components/MisroutedFileModal';
import { applyTheme, getSavedThemeId } from './core/themeEngine';
import { useSessionInactivity } from './modules/security/useSessionInactivity';
import { SessionInactivityModal } from './modules/security/SessionInactivityModal';
import { SkuOverrideAuthorizationModal } from './modules/skuOverrides/SkuOverrideAuthorizationModal';
import { getFeedbackTickets } from './modules/feedback/feedbackService';
import { getFormattedAppVersion } from './core/appVersion';
import { MobileBottomNav, MobileStickyBar } from './components/mobile';
import { OnlineRequirementModal } from './components/OnlineRequirementModal';
import { useEstimatesMirror } from './hooks/useEstimatesMirror';
import { getPendingAccessRequestsForUser } from './modules/notifications/estimateAccessNotificationService';
import {
  useOfflineMode,
  setManualOfflineMode,
  OFFLINE_QUEUE_UPDATED_EVENT,
  OFFLINE_SYNC_COMPLETED_EVENT,
} from './core/storage/offlineModeManager';
import { getOfflineQueueSummary } from './core/storage/offlineSyncQueue';

// Vistas y modales secundarios cargados bajo demanda (Code-Splitting para Web CDN)
const QuickCalculator = lazy(() =>
  import('./components/QuickCalculator').then((m) => ({ default: m.QuickCalculator }))
);
const DashboardView = lazy(() =>
  import('./components/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const UploadView = lazy(() =>
  import('./components/UploadView').then((m) => ({ default: m.UploadView }))
);
const EstimatesHistoryView = lazy(() =>
  import('./components/EstimatesHistoryView').then((m) => ({ default: m.EstimatesHistoryView }))
);
const UserManagementView = lazy(() =>
  import('./components/UserManagementView').then((m) => ({ default: m.UserManagementView }))
);
const AuditLogsView = lazy(() =>
  import('./components/AuditLogsView').then((m) => ({ default: m.AuditLogsView }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const DsvView = lazy(() =>
  import('./modules/dsv/DsvView').then((m) => ({ default: m.DsvView }))
);
const PipelineView = lazy(() =>
  import('./modules/pipeline/PipelineView').then((m) => ({ default: m.PipelineView }))
);
const ForecastView = lazy(() =>
  import('./modules/forecast/ForecastView').then((m) => ({ default: m.ForecastView }))
);
const CcwrQuoteView = lazy(() =>
  import('./modules/ccwrQuote/CcwrQuoteView').then((m) => ({ default: m.CcwrQuoteView }))
);
const ConfiguriatorView = lazy(() =>
  import('./modules/configuriator/ConfiguriatorView').then((m) => ({ default: m.ConfiguriatorView }))
);
const FeedbackView = lazy(() =>
  import('./modules/feedback/FeedbackView').then((m) => ({ default: m.FeedbackView }))
);
const HealthDashboardView = lazy(() =>
  import('./modules/health/HealthDashboardView').then((m) => ({ default: m.HealthDashboardView }))
);
const DemandIntelligenceView = lazy(() =>
  import('./modules/demandIntelligence/DemandIntelligenceView').then((m) => ({ default: m.DemandIntelligenceView }))
);
const BoTrackingView = lazy(() =>
  import('./modules/bo/BoTrackingView').then((m) => ({ default: m.BoTrackingView }))
);

const BoRequestModal = lazy(() =>
  import('./modules/bo/BoRequestModal').then((m) => ({ default: m.BoRequestModal }))
);
const DealReminderAlertModal = lazy(() =>
  import('./modules/bo/DealReminderAlertModal').then((m) => ({ default: m.DealReminderAlertModal }))
);
const RulesExplanationModal = lazy(() =>
  import('./components/RulesExplanationModal').then((m) => ({ default: m.RulesExplanationModal }))
);
const DownloadModal = lazy(() =>
  import('./components/DownloadModal').then((m) => ({ default: m.DownloadModal }))
);
const ThemeSelectorModal = lazy(() =>
  import('./components/ThemeSelectorModal').then((m) => ({ default: m.ThemeSelectorModal }))
);
const LiveStudioModal = lazy(() =>
  import('./components/LiveStudioModal').then((m) => ({ default: m.LiveStudioModal }))
);
const QuickBomIngestModal = lazy(() =>
  import('./components/QuickBomIngestModal').then((m) => ({ default: m.QuickBomIngestModal }))
);
const FastTrackAdminModal = lazy(() =>
  import('./modules/fasttrack/FastTrackAdminModal').then((m) => ({ default: m.FastTrackAdminModal }))
);
const FastTrackOpportunityModal = lazy(() =>
  import('./modules/fasttrack/FastTrackOpportunityModal').then((m) => ({ default: m.FastTrackOpportunityModal }))
);
const SharedSkuManagerModal = lazy(() =>
  import('./modules/skuOverrides/SharedSkuManagerModal').then((m) => ({ default: m.SharedSkuManagerModal }))
);
const EstimateDiffModal = lazy(() =>
  import('./modules/estimate/components/EstimateDiffModal').then((m) => ({ default: m.EstimateDiffModal }))
);
const CreateTicketModal = lazy(() =>
  import('./modules/feedback/CreateTicketModal').then((m) => ({ default: m.CreateTicketModal }))
);
const OfflineSyncModal = lazy(() =>
  import('./components/OfflineSyncModal').then((m) => ({ default: m.OfflineSyncModal }))
);
const SaveEstimateModal = lazy(() =>
  import('./components/SaveEstimateModal').then((m) => ({ default: m.SaveEstimateModal }))
);
const CiscoCloudEstimateImportModal = lazy(() =>
  import('./modules/ciscoApi/CiscoCloudEstimateImportModal').then((m) => ({ default: m.CiscoCloudEstimateImportModal }))
);

function LazyViewFallback() {
  return (
    <div className="max-w-md mx-auto text-center py-20 space-y-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 animate-spin">
        <RefreshCw className="w-5 h-5" />
      </div>
      <p className="text-xs font-semibold text-slate-400">Cargando módulo...</p>
    </div>
  );
}

import {
  FileSpreadsheet,
  Table,
  Calculator,
  Upload,
  AlertCircle,
  Sliders,
  RefreshCw,
  GitCompare,
  Zap,
  EyeOff,
  WifiOff,
  HardDrive,
  UploadCloud,
  X,
} from 'lucide-react';

function AuthenticatedApp() {
  const {
    currentUser,
    setCurrentUser,
    currentView,
    setCurrentView,
    params,
    setParams,
    detectedPartner,
    activePartnerProfile,
    setActivePartnerProfile,
    rawWorkbookBuffer,
    currentFileName,
    processedResult,
    isProcessing,
    errorMessage,
    activeQuoterTab,
    setActiveQuoterTab,
    processFileBuffer,
    setRowRule,
    cycleRowRule,
    clearEstimate,
    logout,
    customOverrideMap,
    skuOverridesMap,
    isSharedSkuManagerOpen,
    setIsSharedSkuManagerOpen,
    pendingSkuAuthOverrides,
    skuAuthAuthorName,
    setPendingSkuAuthOverrides,
    applyApprovedSkuOverrides,
    setSkuOverridesMap,
    fastTrackPromoMap,
    pendingFastTrackAudit,
    isFastTrackOpportunityModalOpen,
    isFastTrackAdminModalOpen,
    setIsFastTrackOpportunityModalOpen,
    setIsFastTrackAdminModalOpen,
    saveCurrentEstimateToCloud,
    loadCloudEstimateIntoStore,
    applyFastTrackPromos,
    skipFastTrackPromos,
    isRecalculated,
    detectedAudit,
    isDetectedAuditModalOpen,
    loadPriorAuditMargins,
    dismissDetectedAuditModal,
    restoreOriginalUneditedEstimate,
    miningAuditData,
    isMiningAuditModalOpen,
    setIsMiningAuditModalOpen,
    miningAlertData,
    isMiningAlertModalOpen,
    setIsMiningAlertModalOpen,
    miningFastTrackWarningData,
    isMiningFastTrackWarningModalOpen,
    setIsMiningFastTrackWarningModalOpen,
    misroutedFileAlert,
    setMisroutedFileAlert,
    pendingCcwrFile,
    setPendingCcwrFile,
    isClientMode,
    toggleClientMode,
  } = useCiscoAutomatedStore();

  // Initialize theme on application mount
  useEffect(() => {
    const savedTheme = getSavedThemeId();
    applyTheme(savedTheme);
  }, []);

  // Switch to safe client-facing tab if in Client Presentation Mode
  useEffect(() => {
    if (isClientMode && activeQuoterTab === 'calculator') {
      setActiveQuoterTab('excel');
    }
  }, [isClientMode, activeQuoterTab, setActiveQuoterTab]);

  // 30-minute Inactivity Monitor & Auto-Logout Security Layer
  const { showWarning, secondsRemaining, stayActive } = useSessionInactivity({
    isAuthenticated: !!currentUser,
    onTimeout: () => {
      logout();
      setCloudToast({
        message: '⚠️ Tu sesión ha expirado por inactividad (30 minutos sin movimiento). Inicia sesión nuevamente.',
        type: 'error',
      });
      setTimeout(() => setCloudToast(null), 8000);
    },
  });

  // Collapsible Sidebar States
  const [isNavSidebarOpen, setIsNavSidebarOpen] = useState(true);
  const [isParamSidebarOpen, setIsParamSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [quickCalcPrefill, setQuickCalcPrefill] = useState<QuickCalculatorPrefillItem | null>(null);

  useEffect(() => {
    if (currentUser?.username) {
      appendWebAuditLog(
        currentUser.username,
        'LOGIN',
        `Sesión activa en ${getFormattedAppVersion()} (${currentUser.role})`
      );
    }
  }, [currentUser?.username, currentUser?.role]);

  const handleToggleNavSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setIsNavSidebarOpen((prev) => !prev);
    }
  };

  // Cloud & Save States
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [cloudToast, setCloudToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);

  // Offline / Online Mode & Local PC Sync Queue
  const { isOffline, isManualOffline, isNavigatorOffline } = useOfflineMode();
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isOfflineSyncModalOpen, setIsOfflineSyncModalOpen] = useState<boolean>(false);
  const [isCiscoCloudModalOpen, setIsCiscoCloudModalOpen] = useState<boolean>(false);

  // Active Back Order (BO) Count for Sidebar Badge
  const [activeBoCount, setActiveBoCount] = useState<number>(0);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState<number>(0);
  const [isCreateFeedbackModalOpen, setIsCreateFeedbackModalOpen] = useState(false);

  // Proactive Deal Reminder Pop-up Monitor (Midday 12:00 & End of Day 17:30)
  const {
    dueDeals: reminderDueDeals,
    isAlertOpen: isDealAlertOpen,
    closeAlert: closeDealAlert,
    refreshAlerts: refreshDealAlerts,
  } = useDealReminderAlerts();

  useEffect(() => {
    let active = true;
    const refreshQueueCount = () => {
      getOfflineQueueSummary()
        .then((summary) => {
          if (active) setPendingOfflineCount(summary.total);
        })
        .catch(() => {});
    };
    refreshQueueCount();
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, refreshQueueCount);
    window.addEventListener(OFFLINE_SYNC_COMPLETED_EVENT, refreshQueueCount);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, refreshQueueCount);
      window.removeEventListener(OFFLINE_SYNC_COMPLETED_EVENT, refreshQueueCount);
    };
  }, []);

  useEffect(() => {
    getBoTrackings()
      .then((records) => {
        const count = records.filter((r) => r.currentStage !== 'DELIVERED').length;
        setActiveBoCount(count);
      })
      .catch(() => {});

    if (!isOffline) {
      getFeedbackTickets()
        .then((tickets) => {
          if (!currentUser) return;
          const isSupport = currentUser.role === 'admin' || currentUser.role === 'pm';
          const unread = tickets.filter((t) => {
            if (isSupport && !t.readBySupport) return true;
            if (t.author.username === currentUser.username && !t.readByAuthor) return true;
            return false;
          }).length;
          setUnreadFeedbackCount(unread);
        })
        .catch(() => {});
    }
  }, [currentView, currentUser, isOffline]);

  const mirrorEstimates = useEstimatesMirror();
  const pendingAccessCount = useMemo(
    () => getPendingAccessRequestsForUser(mirrorEstimates, currentUser?.username).length,
    [mirrorEstimates, currentUser?.username]
  );

  const handleToggleOfflineMode = () => {
    if (!isManualOffline) {
      setManualOfflineMode(true);
      const cloudOnlyViews = ['configuriator', 'feedback', 'users', 'audit'];
      if (cloudOnlyViews.includes(currentView)) {
        setCurrentView('quoter');
      }
      setCloudToast({
        message: 'Modo Offline activado: podrás cotizar y guardar BO, Estimates, Pipeline y Forecast localmente en este PC.',
        type: 'success',
      });
      setTimeout(() => setCloudToast(null), 5000);
    } else {
      setIsOfflineSyncModalOpen(true);
    }
  };

  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(false);
  const [cloudRequirementTarget, setCloudRequirementTarget] = useState<{
    isOpen: boolean;
    viewId?: any;
    label?: string;
  }>({ isOpen: false });

  // Auto-dismiss the offline banner after 6 seconds so it doesn't take up visual space
  useEffect(() => {
    if (isOffline) {
      setShowOfflineBanner(true);
      const timer = setTimeout(() => {
        setShowOfflineBanner(false);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setShowOfflineBanner(false);
    }
  }, [isOffline]);

  const handleAttemptCloudFeature = (viewId: any, label: string) => {
    setCloudRequirementTarget({
      isOpen: true,
      viewId,
      label,
    });
  };

  const handleSwitchOnlineFromModal = () => {
    setManualOfflineMode(false);
    if (cloudRequirementTarget.viewId) {
      setCurrentView(cloudRequirementTarget.viewId);
    }
    setCloudToast({
      message: 'Modo Online activado: sincronización con la nube habilitada.',
      type: 'success',
    });
    setTimeout(() => setCloudToast(null), 4000);
  };

  // Modal States
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isLiveStudioOpen, setIsLiveStudioOpen] = useState(false);
  const [isQuickIngestOpen, setIsQuickIngestOpen] = useState(false);
  const [isBoModalOpen, setIsBoModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prepare Back Order (BO) lines with dynamic warehouse assignment (E1 vs ED)
  const boLines: BoLineItem[] = React.useMemo(() => {
    if (!processedResult?.items) return [];
    const validItems = processedResult.items.filter(
      (it) => it.partNumber && !it.isInfoRow && it.qty > 0
    );
    const localCatalog = getLocalBoSkuCache();
    return resolveWarehouseForLines(
      validItems.map((it) => ({
        partNumber: it.partNumber,
        qty: it.qty,
        unitSalePrice: it.precioVentaUnitario,
        extendedSalePrice: it.precioVentaExtendido,
        isIntangible: it.isIntangible,
        isHardware: !it.isIntangible,
        lineNumber: it.lineNumber,
        motherLine: it.inheritedFromMotherLine || (it.lineNumber ? getMotherLineKey(it.lineNumber) : '1.0'),
      })),
      (pn) => findSkuInCatalog(pn, localCatalog)
    );
  }, [processedResult?.items]);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const handleSaveCloud = () => {
    if (!processedResult) return;
    setIsSaveModalOpen(true);
  };

  const handleCopyEmailSummary = async () => {
    if (!processedResult) return;
    try {
      const { copyEstimateEmailSummaryWithDetail } = await import('./core/emailClipboardHelper');
      const res = await copyEstimateEmailSummaryWithDetail(processedResult, detectedPartner);
      if (res.success) {
        setIsCopiedEmail(true);
        setCloudToast({
          message:
            res.mode === 'rich'
              ? '📋 Resumen comercial copiado al portapapeles con formato enriquecido Outlook/HTML.'
              : '📋 Resumen comercial copiado en texto plano (formato HTML no disponible en este entorno).',
          type: 'success',
        });
        setTimeout(() => setIsCopiedEmail(false), 3000);
        setTimeout(() => setCloudToast(null), 4500);
      } else {
        setCloudToast({
          message: `No se pudo copiar el resumen al portapapeles: ${res.error || res.message}`,
          type: 'error',
        });
        setTimeout(() => setCloudToast(null), 4000);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      setCloudToast({
        message: `Error al copiar: ${errMsg}`,
        type: 'error',
      });
      setTimeout(() => setCloudToast(null), 4000);
    }
  };

  // Handle native file input trigger
  const handleUploadClick = async () => {
    const desktopRes = await openDesktopFileDialog();
    if (desktopRes) {
      if (desktopRes.success && desktopRes.buffer && desktopRes.filename) {
        await processFileBuffer(desktopRes.buffer, desktopRes.filename);
        setCurrentView('quoter');
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePipelineClick = async () => {
    if (processedResult) {
      try {
        const { importEstimateIntoPipeline } = await import('./modules/pipeline/pipelineService');
        await importEstimateIntoPipeline(processedResult, currentUser);
        setCloudToast({
          message: `📌 Cotización vinculada al Pipeline Comercial exitosamente (${processedResult.headerInfo?.companyName || 'Partner'}).`,
          type: 'success',
        });
        setTimeout(() => setCloudToast(null), 4000);
      } catch (err: any) {
        console.warn('Error vinculando al pipeline:', err);
      }
    }
    setCurrentView('pipeline');
  };

  const handleForecastClick = async () => {
    if (processedResult) {
      try {
        const [{ getForecastRecords }, { crossSyncEstimateToForecast }, { saveForecastRecord }] =
          await Promise.all([
            import('./modules/forecast/forecastStorage'),
            import('./modules/forecast/forecastService'),
            import('./modules/forecast/forecastStorage'),
          ]);
        const existing = await getForecastRecords();
        const res = crossSyncEstimateToForecast(processedResult, existing);
        await saveForecastRecord(res.affectedRecord);
        setCloudToast({
          message: `📊 Cotización vinculada al Forecast Comercial (${res.affectedRecord.partner} - ${res.affectedRecord.endUser}).`,
          type: 'success',
        });
        setTimeout(() => setCloudToast(null), 4000);
      } catch (err: any) {
        console.warn('Error vinculando al forecast:', err);
      }
    }
    setCurrentView('forecast');
  };

  const handleDsvClick = () => {
    setCurrentView('dsv');
  };

  const handleConfirmMisroutedRedirect = () => {
    if (!misroutedFileAlert) return;
    if (misroutedFileAlert.detectedType === 'ccwr_quote') {
      setPendingCcwrFile({
        buffer: misroutedFileAlert.buffer,
        fileName: misroutedFileAlert.fileName,
      });
      setCurrentView('ccwr_quote');
    } else {
      processFileBuffer(misroutedFileAlert.buffer, misroutedFileAlert.fileName);
      setCurrentView('quoter');
    }
    setMisroutedFileAlert(null);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await processFileBuffer(buffer, file.name);
      setCurrentView('quoter');
    } catch (err: any) {
      console.error(err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };


  // Parse partner, client and model from filename or header info
  const getPartnerClientDefaults = () => {
    let partner = 'Intcomex';
    let client = 'Cliente Final';
    let model = 'Cisco';

    if (processedResult?.headerInfo?.companyName) {
      partner = processedResult.headerInfo.companyName;
    }
    if (processedResult?.headerInfo?.customerName) {
      client = processedResult.headerInfo.customerName;
    }

    if (currentFileName) {
      const clean = currentFileName.replace(/\.[^/.]+$/, '');
      const parts = clean.split(/[_.\s-]+/);
      if (parts.length >= 1 && parts[0] && !parts[0].match(/^(estimate|\d+)$/i)) {
        partner = parts[0].trim();
      }
      if (parts.length >= 2 && parts[1] && !parts[1].match(/^(estimate|\d+)$/i)) {
        client = parts[1].trim();
      }
      if (parts.length >= 3 && parts[2] && !parts[2].match(/^(estimate|calc|recalc|int\d+|ma\d+|i\d+|m\d+|i\d+m\d+|\d+)$/i)) {
        model = parts[2].trim();
      }
    }

    return { partner, client, model };
  };

  const { partner: defaultPartner, client: defaultClient, model: defaultModel } = getPartnerClientDefaults();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      {/* Ambient Mesh Glow Effect (Active in Aesthetic Mode) */}
      <AmbientMeshGlow />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Global Business Rules Modal */}
      {isRulesModalOpen && (
        <Suspense fallback={null}>
          <RulesExplanationModal
            isOpen={isRulesModalOpen}
            onClose={() => setIsRulesModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Misrouted Cisco File Detection Modal (CCW Estimate vs CCW-R Quote) */}
      <MisroutedFileModal
        alert={misroutedFileAlert}
        onConfirmRedirect={handleConfirmMisroutedRedirect}
        onCancel={() => setMisroutedFileAlert(null)}
      />

      {/* Fast Track Administration Modal */}
      {isFastTrackAdminModalOpen && (
        <Suspense fallback={null}>
          <FastTrackAdminModal
            isOpen={isFastTrackAdminModalOpen}
            onClose={() => setIsFastTrackAdminModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Fast Track Opportunity Cross-Check Pop-up */}
      {isFastTrackOpportunityModalOpen && (
        <Suspense fallback={null}>
          <FastTrackOpportunityModal
            isOpen={isFastTrackOpportunityModalOpen}
            auditResult={pendingFastTrackAudit}
            onApply={applyFastTrackPromos}
            onSkip={skipFastTrackPromos}
          />
        </Suspense>
      )}

      {/* Theme Customization Modal */}
      {isThemeModalOpen && (
        <Suspense fallback={null}>
          <ThemeSelectorModal
            isOpen={isThemeModalOpen}
            onClose={() => setIsThemeModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Live Custom Studio Modal (Aesthetic Mode Real-time Customization) */}
      {isLiveStudioOpen && (
        <Suspense fallback={null}>
          <LiveStudioModal
            isOpen={isLiveStudioOpen}
            onClose={() => setIsLiveStudioOpen(false)}
          />
        </Suspense>
      )}

      {/* Offline -> Online Sync & Conflict Warning Modal */}
      {isOfflineSyncModalOpen && (
        <Suspense fallback={null}>
          <OfflineSyncModal
            isOpen={isOfflineSyncModalOpen}
            onClose={() => setIsOfflineSyncModalOpen(false)}
            onSyncFinished={(result) => {
              getOfflineQueueSummary()
                .then((s) => setPendingOfflineCount(s.total))
                .catch(() => {});
              if (result.uploadedCount > 0 && result.failedCount === 0) {
                setCloudToast({
                  message: `Sincronización completada: ${result.uploadedCount} cambio(s) subidos a la nube y vistas actualizadas.`,
                  type: 'success',
                });
                setTimeout(() => setCloudToast(null), 5000);
              } else if (result.failedCount > 0) {
                setCloudToast({
                  message: `Sincronización parcial: ${result.uploadedCount} subido(s), ${result.failedCount} fallaron y permanecen guardados en tu PC.`,
                  type: 'error',
                });
                setTimeout(() => setCloudToast(null), 6000);
              } else if (result.wentOnline && result.remainingCount > 0) {
                setCloudToast({
                  message: `Volviste a modo Online con ${result.remainingCount} cambio(s) aún pendientes en este PC.`,
                  type: 'success',
                });
                setTimeout(() => setCloudToast(null), 5000);
              } else if (result.wentOnline) {
                setCloudToast({
                  message: 'Modo Online reactivado correctamente.',
                  type: 'success',
                });
                setTimeout(() => setCloudToast(null), 3500);
              }
            }}
          />
        </Suspense>
      )}

      {/* Quick BOM Ingest Modal (Clipboard & Raw Text Parser) */}
      {isQuickIngestOpen && (
        <Suspense fallback={null}>
          <QuickBomIngestModal
            isOpen={isQuickIngestOpen}
            onClose={() => setIsQuickIngestOpen(false)}
            onLoadIntoQuickCalc={(item) => {
              setQuickCalcPrefill(item);
              setCurrentView('quoter');
              setActiveQuoterTab('calculator');
            }}
          />
        </Suspense>
      )}

      {/* Shared SKU Rules Manager Modal (Cloud & Local) */}
      {isSharedSkuManagerOpen && (
        <Suspense fallback={null}>
          <SharedSkuManagerModal
            isOpen={isSharedSkuManagerOpen}
            onClose={() => setIsSharedSkuManagerOpen(false)}
            currentUser={currentUser}
            skuOverridesMap={skuOverridesMap}
            onApplyOverrides={async (newOverrides: Record<string, OverrideRuleType>) => {
              const records = Object.entries(newOverrides).map(([sku, rule]) => ({
                sku,
                rule,
                previousType: 'Hardware',
                author: {
                  username: currentUser?.username || 'user',
                  fullName: currentUser?.full_name || 'Product Manager',
                  role: (currentUser?.role as string) || 'pm',
                },
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              }));
              await applyApprovedSkuOverrides(records, true);
            }}
          />
        </Suspense>
      )}

      {/* Prior Authorization Modal for Incoming/Colleague SKU Changes */}
      <SkuOverrideAuthorizationModal
        isOpen={pendingSkuAuthOverrides.length > 0}
        onClose={() => setPendingSkuAuthOverrides([])}
        proposedOverrides={pendingSkuAuthOverrides}
        authorName={skuAuthAuthorName}
        sourceType="cloud"
        onAccept={applyApprovedSkuOverrides}
      />

      {/* 30-Min Session Inactivity Warning Modal */}
      <SessionInactivityModal
        isOpen={showWarning}
        secondsRemaining={secondsRemaining}
        onStayActive={stayActive}
      />

      {/* ⚠️ Cotización Previamente Procesada Modal Interceptor */}
      <PriorAuditDetectedModal
        isOpen={isDetectedAuditModalOpen}
        detectedAudit={detectedAudit}
        onLoadPriorMargins={loadPriorAuditMargins}
        onRestoreOriginal={restoreOriginalUneditedEstimate}
        onModifyMargins={dismissDetectedAuditModal}
      />

      {/* Mining & Industrial Conditions Audit Modal */}
      <MiningAuditModal
        isOpen={isMiningAuditModalOpen}
        onClose={() => setIsMiningAuditModalOpen(false)}
        report={miningAuditData}
      />

      {/* Mining Observer Modal - Daniel Peña Special Discount Alert (>= $150.000 USD) */}
      <MiningAlertModal
        isOpen={isMiningAlertModalOpen && Boolean(miningAlertData?.shouldAlert)}
        totalListPrice={miningAlertData?.totalListPrice || 0}
        initialDealId={processedResult?.headerInfo?.dealId || null}
        mailtoUrlTemplate={miningAlertData?.mailtoUrl || ''}
        onClose={() => setIsMiningAlertModalOpen(false)}
      />

      {/* Mining Observer Modal - Fast Track Usage Warning (>= 2 items with equal discount) */}
      <MiningFastTrackWarningModal
        isOpen={isMiningFastTrackWarningModalOpen}
        data={miningFastTrackWarningData}
        onClose={() => setIsMiningFastTrackWarningModalOpen(false)}
      />

      {/* Back Order (BO) Request Modal for Ventas Core */}
      {isBoModalOpen && (
        <Suspense fallback={null}>
          <BoRequestModal
            isOpen={isBoModalOpen}
            initialClientName={defaultClient}
            initialLines={boLines}
            assignedBodega={boLines.length > 0 ? boLines[0].bodega : 'E1'}
            estimateResult={processedResult}
            detectedPartner={detectedPartner}
            currentUser={currentUser}
            onClose={() => setIsBoModalOpen(false)}
            onRegisterTracking={() => setCurrentView('bo_tracking')}
            onOrderSynced={() => {
              getBoTrackings()
                .then((records) => {
                  const count = records.filter((r) => r.currentStage !== 'DELIVERED').length;
                  setActiveBoCount(count);
                })
                .catch(() => {});
            }}
          />
        </Suspense>
      )}

      {/* Global Proactive Deal Reminder Pop-up (12:00 Midday & 17:30 End-of-Day) */}
      {isDealAlertOpen && (
        <Suspense fallback={null}>
          <DealReminderAlertModal
            deals={reminderDueDeals}
            isOpen={isDealAlertOpen}
            onClose={closeDealAlert}
            onRefreshData={refreshDealAlerts}
          />
        </Suspense>
      )}

      {/* Global Quick Feedback & Bug Report Modal */}
      {currentUser && isCreateFeedbackModalOpen && (
        <Suspense fallback={null}>
          <CreateTicketModal
            isOpen={isCreateFeedbackModalOpen}
            onClose={() => setIsCreateFeedbackModalOpen(false)}
            currentUser={currentUser}
            onTicketCreated={() => {
              setCloudToast({
                message: '✅ ¡Reporte / Sugerencia registrada exitosamente en la base de datos!',
                type: 'success',
              });
              setTimeout(() => setCloudToast(null), 4000);
              getFeedbackTickets()
                .then((tickets) => {
                  const isSupport = currentUser.role === 'admin' || currentUser.role === 'pm';
                  const unread = tickets.filter((t) => {
                    if (isSupport && !t.readBySupport) return true;
                    if (t.author.username === currentUser.username && !t.readByAuthor) return true;
                    return false;
                  }).length;
                  setUnreadFeedbackCount(unread);
                })
                .catch(() => {});
            }}
            currentEstimateFileName={currentFileName}
            dealId={processedResult?.headerInfo?.dealId}
          />
        </Suspense>
      )}

      {/* Estimate Version History & Snapshot Diff Modal */}
      {processedResult && isDiffModalOpen && (
        <Suspense fallback={null}>
          <EstimateDiffModal
            isOpen={isDiffModalOpen}
            onClose={() => setIsDiffModalOpen(false)}
            currentResult={processedResult}
            shadowSnapshot={processedResult.shadowSnapshot}
            overrides={customOverrideMap}
          />
        </Suspense>
      )}

      {/* Structured Dual Download Modal (Web & Desktop) */}
      {processedResult && isDownloadModalOpen && (() => {
        const isOnlyLicensing = processedResult.items ? isPureLicensingQuote(processedResult.items) : false;
        return (
          <Suspense fallback={null}>
            <DownloadModal
              isOpen={isDownloadModalOpen}
              onClose={() => setIsDownloadModalOpen(false)}
              defaultFilename={processedResult.fileName || 'Cotizacion_Cisco_CALC.xlsx'}
              defaultPartner={defaultPartner}
              defaultClient={defaultClient}
              defaultModel={defaultModel}
              workbookBuffer={processedResult.workbookBuffer || new ArrayBuffer(0)}
              rawWorkbookBuffer={rawWorkbookBuffer}
              params={params}
              customOverrides={customOverrideMap}
              promoNetPrices={fastTrackPromoMap}
              headerInfo={processedResult.headerInfo}
              isOnlyLicensing={isOnlyLicensing}
              isRecalculated={
                isRecalculated ||
                (!isOnlyLicensing && params.internacionPct !== 7.0) ||
                params.margenPct !== 5.0 ||
                Object.keys(customOverrideMap).length > 0
              }
            />
          </Suspense>
        );
      })()}

      {/* Save Estimate & Privacy Level Modal */}
      {processedResult && isSaveModalOpen && (
        <Suspense fallback={null}>
          <SaveEstimateModal
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            defaultPartner={defaultPartner}
            defaultClient={defaultClient}
            defaultModel={defaultModel}
            onSuccess={(msg) => {
              setCloudToast({ message: msg, type: 'success' });
              setTimeout(() => setCloudToast(null), 5000);
            }}
          />
        </Suspense>
      )}

      {/* Cisco Cloud Estimate GraphQL Import Modal */}
      {isCiscoCloudModalOpen && (
        <Suspense fallback={null}>
          <CiscoCloudEstimateImportModal
            isOpen={isCiscoCloudModalOpen}
            onClose={() => setIsCiscoCloudModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Collapsible Navigation Sidebar (Hidden on mobile < md, full on desktop >= md) */}
      <div className="hidden md:flex shrink-0">
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        onLogout={logout}
        isOpen={isNavSidebarOpen}
        onToggleOpen={() => setIsNavSidebarOpen((prev) => !prev)}
        activeBoCount={activeBoCount}
        unreadFeedbackCount={unreadFeedbackCount}
        pendingAccessCount={pendingAccessCount}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onOpenSharedSku={() => setIsSharedSkuManagerOpen(true)}
        onOpenFastTrack={() => setIsFastTrackAdminModalOpen(true)}
        onAttemptCloudFeature={handleAttemptCloudFeature}
      />

      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Banner de Actualización Automática */}
        <AutoUpdateBanner />
        {/* Navbar */}
        <Navbar
          onUploadClick={handleUploadClick}
          onCiscoCloudClick={() => setIsCiscoCloudModalOpen(true)}
          onDownloadClick={() => setIsDownloadModalOpen(true)}
          onSaveCloudClick={handleSaveCloud}
          onOpenEstimateHistory={() => setCurrentView('estimates')}
          isSavingCloud={isSavingCloud}
          onCopyEmailClick={handleCopyEmailSummary}
          isCopiedEmail={isCopiedEmail}
          onDsvClick={handleDsvClick}
          onBoClick={() => setIsBoModalOpen(true)}
          onPipelineClick={handlePipelineClick}
          onForecastClick={handleForecastClick}
          onMiningAuditClick={() => setIsMiningAuditModalOpen(true)}
          miningAuditReport={miningAuditData}
          onClearClick={clearEstimate}
          onToggleSidebar={handleToggleNavSidebar}
          isSidebarOpen={isNavSidebarOpen}
          onToggleParamSidebar={() => setIsParamSidebarOpen((prev) => !prev)}
          isParamSidebarOpen={isParamSidebarOpen}
          isProcessing={isProcessing}
          hasData={Boolean(processedResult)}
          fileName={currentFileName}
          onOpenLiveStudio={() => setIsLiveStudioOpen(true)}
          onOpenQuickIngest={() => setIsQuickIngestOpen(true)}
          isClientMode={isClientMode}
          onToggleClientMode={toggleClientMode}
          pendingOfflineCount={pendingOfflineCount}
          onToggleOfflineMode={handleToggleOfflineMode}
          onOpenOfflineSyncModal={() => setIsOfflineSyncModalOpen(true)}
        />

        {/* Floating Cloud Toast Notification */}
        {cloudToast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center space-x-2.5 animate-slide-up border ${
              cloudToast.type === 'success'
                ? 'bg-cyan-600 text-white border-cyan-400/40 shadow-cyan-950/50'
                : 'bg-rose-600 text-white border-rose-400/40 shadow-rose-950/50'
            }`}
          >
            <span>{cloudToast.message}</span>
          </div>
        )}

        {/* Scrollable View Container */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 pb-24 md:pb-6 custom-scrollbar">
          {/* Offline Working Mode Temporary Notice (auto-dismisses after 6s & has manual close) */}
          {isOffline && showOfflineBanner && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-950/80 border border-amber-500/50 text-amber-100 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xl animate-fade-in transition-all">
              <div className="flex items-start sm:items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-amber-200 flex flex-wrap items-center gap-2">
                    <span>
                      {isNavigatorOffline && !isManualOffline
                        ? 'Sin conexión a Internet detectada — Operando en Respaldo Local PC'
                        : 'MODO OFFLINE ACTIVO — Guardado Local en este PC'}
                    </span>
                    {pendingOfflineCount > 0 && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-black text-amber-200">
                        <HardDrive className="w-3 h-3" />
                        <span>{pendingOfflineCount} cambio(s) en cola PC</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                    Puedes seguir cotizando CCW / CCW-R y guardando BO, Estimates, DSV, Pipeline y Forecast localmente. Los módulos que requieren nube o IA en vivo están temporalmente deshabilitados.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {isManualOffline && (
                  <button
                    onClick={() => setIsOfflineSyncModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>
                      {pendingOfflineCount > 0
                        ? `Pasar a Online y Subir (${pendingOfflineCount})`
                        : 'Pasar a Online'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowOfflineBanner(false)}
                  className="p-1.5 rounded-xl text-amber-300 hover:text-white hover:bg-amber-900/60 transition-colors cursor-pointer"
                  title="Ocultar aviso de Modo Offline"
                  aria-label="Cerrar aviso de Modo Offline"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center space-x-3 shadow-lg">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Views with Localized Error Boundaries & Lazy Suspense */}
          {currentView === 'dashboard' && (
            <ErrorBoundary
              fallbackTitle="Error en Dashboard Analítico"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <DashboardView
                  onOpenQuoter={() => setCurrentView('quoter')}
                  onOpenUpload={() => setCurrentView('upload')}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'upload' && (
            <ErrorBoundary
              fallbackTitle="Error en Módulo de Carga"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <UploadView
                  onProcessFile={async (buf, name) => {
                    await processFileBuffer(buf, name);
                    setCurrentView('quoter');
                  }}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'ccwr_quote' && (
            <ErrorBoundary
              fallbackTitle="Error en Cotizador CCW-R de Servicios & Licencias"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <CcwrQuoteView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'pipeline' && (
            <ErrorBoundary
              fallbackTitle="Error en Pipeline Comercial"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <PipelineView
                  onOpenQuoter={() => setCurrentView('quoter')}
                  onOpenBoTracking={() => setCurrentView('bo_tracking')}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'forecast' && (
            <ErrorBoundary
              fallbackTitle="Error en Forecast Comercial"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <ForecastView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'dsv' && (
            <ErrorBoundary
              fallbackTitle="Error en Generador DSV Cisco"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <DsvView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'configuriator' && (
            <ErrorBoundary
              fallbackTitle="Error en Preventa IA (AI BOM & Homologador)"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <ConfiguriatorView
                  isNavSidebarOpen={isNavSidebarOpen}
                  onToggleNavSidebar={() => setIsNavSidebarOpen((prev) => !prev)}
                  onCollapseNavSidebar={() => setIsNavSidebarOpen(false)}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'estimates' && (
            <ErrorBoundary
              fallbackTitle="Error en Historial de Cotizaciones"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <EstimatesHistoryView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'bo_tracking' && (
            <ErrorBoundary
              fallbackTitle="Error en Tracking y Ciclo de Vida BO"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <BoTrackingView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'feedback' && (
            <ErrorBoundary
              fallbackTitle="Error en Módulo de Mejoras, Feedback & Soporte"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <FeedbackView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'users' && currentUser.role === 'admin' && (
            <ErrorBoundary
              fallbackTitle="Error en Gestión de Usuarios RBAC"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <UserManagementView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'audit' && currentUser.role === 'admin' && (
            <ErrorBoundary
              fallbackTitle="Error en Registro de Auditoría"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <AuditLogsView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'settings' && (
            <ErrorBoundary
              fallbackTitle="Error en Configuración de Sistema"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <SettingsView
                  onOpenThemes={() => setIsThemeModalOpen(true)}
                  onOpenLiveStudio={() => setIsLiveStudioOpen(true)}
                  onOpenRules={() => setIsRulesModalOpen(true)}
                  onOpenSharedSku={() => setIsSharedSkuManagerOpen(true)}
                  onOpenFastTrack={() => setIsFastTrackAdminModalOpen(true)}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'health' && (
            <ErrorBoundary
              fallbackTitle="Error en Monitor de Salud"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <HealthDashboardView onOpenOfflineModal={() => setIsOfflineSyncModalOpen(true)} />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'stock_intelligence' && (
            <ErrorBoundary
              fallbackTitle="Error en Inteligencia de Demanda y Stock"
              resetKeys={[currentView]}
              onReturnToSafeView={() => setCurrentView('quoter')}
            >
              <Suspense fallback={<LazyViewFallback />}>
                <DemandIntelligenceView />
              </Suspense>
            </ErrorBoundary>
          )}

          {currentView === 'quoter' && (
            <ErrorBoundary
              fallbackTitle="Error en Cotizador Cisco CCW"
              resetKeys={[currentView, currentFileName]}
            >
              {isProcessing ? (
                <div className="max-w-md mx-auto text-center py-20 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 animate-spin">
                    <RefreshCw className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-white">Procesando Cotización Cisco CCW...</h3>
                  <p className="text-xs text-slate-400">Analizando estructura de columnas, reglas y calculando precios oficiales.</p>
                </div>
              ) : processedResult ? (
                <div className="space-y-6">
                  {/* Mobile Quick Action Sticky Bar */}
                  <MobileStickyBar
                    clientName={detectedPartner || processedResult.headerInfo?.customerName || processedResult.headerInfo?.companyName}
                    dealId={processedResult.headerInfo?.dealId}
                    totalUsd={processedResult.calculatedProductTotal}
                    marginPct={params.margenPct}
                    itemsCount={processedResult.items.length}
                    fileName={currentFileName}
                    onDownloadClick={() => setIsDownloadModalOpen(true)}
                    onDsvClick={handleDsvClick}
                    formatCurrency={(val) => `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />

                  {/* Summary Metric Cards */}
                  <SummaryCards
                    data={processedResult}
                    params={params}
                    miningAudit={miningAuditData}
                    onOpenMiningAudit={() => setIsMiningAuditModalOpen(true)}
                  />

                  {/* Main Grid: Parameters Sidebar + Quoter Views */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Collapsible Parameter Sidebar - Hidden strictly when in Client Presentation Mode */}
                    {isParamSidebarOpen && !isClientMode && (
                      <div className="lg:col-span-3">
                        <ParameterSidebar
                          params={params}
                          onChangeParams={setParams}
                          onToggleCollapse={() => setIsParamSidebarOpen(false)}
                          items={processedResult.items}
                          overrides={customOverrideMap}
                          currentTotal={processedResult.calculatedProductTotal}
                          detectedPartner={detectedPartner}
                          activeProfile={activePartnerProfile}
                          onProfileUpdated={setActivePartnerProfile}
                        />
                      </div>
                    )}

                    {/* Quoter Content Tabs (Expands to 12 cols when parameter sidebar is closed or in client mode) */}
                    <div className={(isParamSidebarOpen && !isClientMode) ? 'lg:col-span-9' : 'lg:col-span-12'}>
                      {/* Fast Track Opportunity Alert Banner */}
                      {pendingFastTrackAudit?.hasOpportunity && !isClientMode && (
                        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs animate-fade-in">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                              <Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-amber-300">
                                ¡Oportunidad Fast Track disponible!
                              </span>
                              <span className="text-slate-300 ml-2">
                                Se detectaron {pendingFastTrackAudit.totalMatchedSkus} SKUs con hasta ${pendingFastTrackAudit.totalSavings.toLocaleString('es-CL')} de ahorro adicional.
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setIsFastTrackOpportunityModalOpen(true)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shrink-0"
                          >
                            Revisar Promociones &rarr;
                          </button>
                        </div>
                      )}

                      {/* Tabs Bar */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => setActiveQuoterTab('excel')}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                              activeQuoterTab === 'excel'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Vista Hoja Excel CCW</span>
                          </button>

                          <button
                            onClick={() => setActiveQuoterTab('table')}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                              activeQuoterTab === 'table'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            <Table className="w-4 h-4" />
                            <span>Tabla Interactiva con Reglas</span>
                          </button>

                          {!isClientMode && (
                            <>
                              <button
                                onClick={() => setActiveQuoterTab('calculator')}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                  activeQuoterTab === 'calculator'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                <Calculator className="w-4 h-4" />
                                <span>Calculadora Rápida</span>
                              </button>

                              <button
                                onClick={() => setIsDiffModalOpen(true)}
                                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-indigo-500/30"
                                title="Comparar versión actual con costo base o snapshot guardado"
                              >
                                <GitCompare className="w-4 h-4 text-indigo-400" />
                                <span>Comparar Diff</span>
                              </button>
                            </>
                          )}
                        </div>

                        {!isParamSidebarOpen && !isClientMode && (
                          <button
                            onClick={() => setIsParamSidebarOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-[11px] font-semibold flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Mostrar Parámetros (7%, 6%, 5%)</span>
                          </button>
                        )}

                        {isClientMode && (
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center space-x-1.5 shadow-sm">
                            <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Modo Presentación al Cliente (Márgenes Ocultos)</span>
                          </div>
                        )}
                      </div>

                      {/* Active Tab View */}
                      {activeQuoterTab === 'excel' && (
                        <ErrorBoundary
                          fallbackTitle="Error en Vista Excel"
                          resetKeys={[activeQuoterTab, currentFileName]}
                          onReturnToSafeView={() => setActiveQuoterTab('table')}
                          safeViewLabel="Cambiar a Tabla Interactiva"
                        >
                          <ExcelSheetPreview
                            data={processedResult}
                            params={params}
                            onSetRowRule={setRowRule}
                            onToggleRowRule={cycleRowRule}
                          />
                        </ErrorBoundary>
                      )}

                      {activeQuoterTab === 'table' && (
                        <ErrorBoundary
                          fallbackTitle="Error en Tabla Interactiva"
                          resetKeys={[activeQuoterTab, currentFileName]}
                          onReturnToSafeView={() => setActiveQuoterTab('excel')}
                          safeViewLabel="Cambiar a Vista Excel CCW"
                        >
                          <InteractiveTable
                            data={processedResult}
                            params={params}
                            onSetRowRule={setRowRule}
                            onToggleRowRule={cycleRowRule}
                          />
                        </ErrorBoundary>
                      )}

                      {activeQuoterTab === 'calculator' && (
                        <ErrorBoundary
                          fallbackTitle="Error en Calculadora"
                          resetKeys={[activeQuoterTab]}
                          onReturnToSafeView={() => setActiveQuoterTab('excel')}
                          safeViewLabel="Volver a Vista Excel CCW"
                        >
                          <Suspense fallback={<LazyViewFallback />}>
                            <QuickCalculator params={params} initialItem={quickCalcPrefill} />
                          </Suspense>
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeQuoterTab === 'calculator' && !isClientMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs">
                    <span className="font-bold text-indigo-300">
                      Calculadora Rápida Unitaria (Modo independiente sin Excel abierto)
                    </span>
                    <button
                      onClick={() => setActiveQuoterTab('excel')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                    >
                      Volver a Inicio
                    </button>
                  </div>
                  <ErrorBoundary
                    fallbackTitle="Error en Calculadora"
                    resetKeys={[activeQuoterTab]}
                    onReturnToSafeView={() => setActiveQuoterTab('excel')}
                  >
                    <Suspense fallback={<LazyViewFallback />}>
                      <QuickCalculator params={params} initialItem={quickCalcPrefill} />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              ) : (
                /* Empty state */
                <div className="max-w-2xl mx-auto text-center py-16 px-4 space-y-6">
                  <div className="w-20 h-20 bg-indigo-600/15 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/30">
                    <FileSpreadsheet className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">
                      Cotizador Cisco CCW &bull; Cisco Automated {getFormattedAppVersion()}
                    </h2>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
                      Sube una cotización oficial de Cisco CCW en formato Excel (.xlsx) para comenzar a cotizar automáticamente.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleUploadClick}
                      className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Subir Cotización Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          )}
        </main>
      </div>
      {/* Mobile Bottom Navigation Bar (Hidden on md and desktop, fixed on mobile) */}
      <MobileBottomNav
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        onLogout={logout}
        activeBoCount={activeBoCount}
        unreadFeedbackCount={unreadFeedbackCount}
        pendingOfflineCount={pendingOfflineCount}
        hasActiveEstimate={Boolean(processedResult)}
        onUploadClick={handleUploadClick}
        onDsvClick={handleDsvClick}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onOpenSharedSku={() => setIsSharedSkuManagerOpen(true)}
        onOpenFastTrack={() => setIsFastTrackAdminModalOpen(true)}
        isDrawerOpen={isMobileDrawerOpen}
        onToggleDrawer={setIsMobileDrawerOpen}
      />
      {/* Modal de Requerimiento de Conexión Online para funciones nube */}
      <OnlineRequirementModal
        isOpen={cloudRequirementTarget.isOpen}
        onClose={() => setCloudRequirementTarget({ isOpen: false })}
        featureName={cloudRequirementTarget.label}
        isNavigatorOffline={isNavigatorOffline}
        onSwitchToOnline={handleSwitchOnlineFromModal}
      />
    </div>
  );
}

function AppContent() {
  const { currentUser, setCurrentUser } = useCiscoAutomatedStore();

  // Initialize theme on application mount
  useEffect(() => {
    const savedTheme = getSavedThemeId();
    applyTheme(savedTheme);
  }, []);

  // If not logged in, render LoginScreen with instant sub-50ms latency and ZERO dashboard overhead
  if (!currentUser) {
    return (
      <ErrorBoundary fallbackTitle="Error en Pantalla de Acceso">
        <LoginScreen onLoginSuccess={(u) => setCurrentUser(u)} />
      </ErrorBoundary>
    );
  }

  return <AuthenticatedApp />;
}

export function App() {
  return (
    <ErrorBoundary fallbackTitle="Error Crítico en la Aplicación">
      <ThemeProvider>
        <CiscoAutomatedProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </CiscoAutomatedProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
