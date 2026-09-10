// ============================================================================
// CISCO AUTOMATED v2.1 - MAIN APPLICATION ENTRYPOINT
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  CiscoAutomatedProvider,
  useCiscoAutomatedStore,
} from './core/store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { ParameterSidebar } from './components/ParameterSidebar';
import { InteractiveTable } from './components/InteractiveTable';
import { ExcelSheetPreview } from './components/ExcelSheetPreview';
import { QuickCalculator } from './components/QuickCalculator';
import { RulesExplanationModal } from './components/RulesExplanationModal';
import { DownloadModal } from './components/DownloadModal';
import { PriorAuditDetectedModal } from './components/PriorAuditDetectedModal';
import { DashboardView } from './components/DashboardView';
import { UploadView } from './components/UploadView';
import { EstimatesHistoryView } from './components/EstimatesHistoryView';
import { UserManagementView } from './components/UserManagementView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsView } from './components/SettingsView';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { DsvView } from './modules/dsv';
import { FastTrackAdminModal, FastTrackOpportunityModal } from './modules/fasttrack';
import { applyTheme, getSavedThemeId } from './core/themeEngine';
import { useSessionInactivity, SessionInactivityModal } from './modules/security';
import { SharedSkuManagerModal, SkuOverrideAuthorizationModal } from './modules/skuOverrides';

import {
  FileSpreadsheet,
  Table,
  Calculator,
  Upload,
  AlertCircle,
  Sliders,
  RefreshCw,
} from 'lucide-react';

function AppContent() {
  const {
    currentUser,
    setCurrentUser,
    currentView,
    setCurrentView,
    params,
    setParams,
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
  } = useCiscoAutomatedStore();

  // Initialize theme on application mount
  useEffect(() => {
    const savedTheme = getSavedThemeId();
    applyTheme(savedTheme);
  }, []);

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

  // Cloud & Save States
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [cloudToast, setCloudToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal States
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveCloud = async () => {
    if (!processedResult) return;
    setIsSavingCloud(true);
    try {
      const res = await saveCurrentEstimateToCloud();
      if (res.success) {
        setCloudToast({
          message: res.error || '¡Cotización guardada exitosamente en la nube (Firestore)!',
          type: 'success',
        });
        setTimeout(() => setCloudToast(null), 4000);
      } else {
        setCloudToast({
          message: `Error al guardar en la nube: ${res.error || 'Fallo desconocido'}`,
          type: 'error',
        });
        setTimeout(() => setCloudToast(null), 5000);
      }
    } catch (err: any) {
      setCloudToast({
        message: `Error de red: ${err?.message || 'Sin conexión'}`,
        type: 'error',
      });
      setTimeout(() => setCloudToast(null), 5000);
    } finally {
      setIsSavingCloud(false);
    }
  };

  // If not logged in, show LoginScreen
  if (!currentUser) {
    return (
      <ErrorBoundary fallbackTitle="Error en Pantalla de Acceso">
        <LoginScreen onLoginSuccess={(u) => setCurrentUser(u)} />
      </ErrorBoundary>
    );
  }

  // Handle native file input trigger
  const handleUploadClick = async () => {
    if ((window as any).pywebview?.api?.open_file_dialog) {
      try {
        const res = await (window as any).pywebview.api.open_file_dialog();
        if (res && res.success) {
          let buffer: ArrayBuffer;
          if (res.file_base64) {
            const binaryStr = atob(res.file_base64);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            buffer = bytes.buffer;
          } else if (res.file_bytes && Array.isArray(res.file_bytes)) {
            buffer = new Uint8Array(res.file_bytes).buffer;
          } else {
            return;
          }
          await processFileBuffer(buffer, res.filename);
          setCurrentView('quoter');
        }
      } catch (err: any) {
        console.error('Error handling upload:', err);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDsvClick = () => {
    setCurrentView('dsv');
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

  // Parse partner and client from filename or header info
  const getPartnerClientDefaults = () => {
    let partner = 'Intcomex';
    let client = 'Cliente Final';

    if (currentFileName) {
      const parts = currentFileName.split('_');
      if (parts.length >= 2) {
        partner = parts[0].trim() || partner;
        client = parts[1].trim() || client;
      }
    } else if (processedResult?.headerInfo?.companyName) {
      partner = processedResult.headerInfo.companyName;
    }
    return { partner, client };
  };

  const { partner: defaultPartner, client: defaultClient } = getPartnerClientDefaults();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Global Business Rules Modal */}
      <RulesExplanationModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />

      {/* Fast Track Administration Modal */}
      <FastTrackAdminModal
        isOpen={isFastTrackAdminModalOpen}
        onClose={() => setIsFastTrackAdminModalOpen(false)}
      />

      {/* Fast Track Opportunity Cross-Check Pop-up */}
      <FastTrackOpportunityModal
        isOpen={isFastTrackOpportunityModalOpen}
        auditResult={pendingFastTrackAudit}
        onApply={applyFastTrackPromos}
        onSkip={skipFastTrackPromos}
      />

      {/* Theme Customization Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Shared SKU Rules Manager Modal (Cloud & Local) */}
      <SharedSkuManagerModal
        isOpen={isSharedSkuManagerOpen}
        onClose={() => setIsSharedSkuManagerOpen(false)}
        currentUser={currentUser}
        skuOverridesMap={skuOverridesMap}
        onApplyOverrides={async (newOverrides) => {
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
        onModifyMargins={dismissDetectedAuditModal}
      />

      {/* Structured Dual Download Modal (Web & Desktop) */}
      {processedResult?.workbookBuffer && (
        <DownloadModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          defaultFilename={processedResult.fileName || 'Cotizacion_Cisco_CALC.xlsx'}
          defaultPartner={defaultPartner}
          defaultClient={defaultClient}
          workbookBuffer={processedResult.workbookBuffer}
          rawWorkbookBuffer={rawWorkbookBuffer}
          params={params}
          customOverrides={customOverrideMap}
          promoNetPrices={fastTrackPromoMap}
          headerInfo={processedResult.headerInfo}
          isRecalculated={
            isRecalculated ||
            params.internacionPct !== 7.0 ||
            params.margenPct !== 5.0 ||
            Object.keys(customOverrideMap).length > 0
          }
        />
      )}

      {/* Collapsible Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        onLogout={logout}
        isOpen={isNavSidebarOpen}
        onToggleOpen={() => setIsNavSidebarOpen((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <Navbar
          onUploadClick={handleUploadClick}
          onShowRulesClick={() => setIsRulesModalOpen(true)}
          onSharedSkuClick={() => setIsSharedSkuManagerOpen(true)}
          onDownloadClick={() => setIsDownloadModalOpen(true)}
          onSaveCloudClick={handleSaveCloud}
          isSavingCloud={isSavingCloud}
          onDsvClick={handleDsvClick}
          onFastTrackClick={() => setIsFastTrackAdminModalOpen(true)}
          onThemeClick={() => setIsThemeModalOpen(true)}
          onClearClick={clearEstimate}
          onToggleSidebar={() => setIsNavSidebarOpen((prev) => !prev)}
          isSidebarOpen={isNavSidebarOpen}
          onToggleParamSidebar={() => setIsParamSidebarOpen((prev) => !prev)}
          isParamSidebarOpen={isParamSidebarOpen}
          isProcessing={isProcessing}
          hasData={Boolean(processedResult)}
          fileName={currentFileName}
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* Global Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center space-x-3 shadow-lg">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Views with Localized Error Boundaries */}
          {currentView === 'dashboard' && (
            <ErrorBoundary fallbackTitle="Error en Dashboard Analítico">
              <DashboardView
                onOpenQuoter={() => setCurrentView('quoter')}
                onOpenUpload={() => setCurrentView('upload')}
              />
            </ErrorBoundary>
          )}

          {currentView === 'upload' && (
            <ErrorBoundary fallbackTitle="Error en Módulo de Carga">
              <UploadView
                onProcessFile={async (buf, name) => {
                  await processFileBuffer(buf, name);
                  setCurrentView('quoter');
                }}
              />
            </ErrorBoundary>
          )}

          {currentView === 'dsv' && (
            <ErrorBoundary fallbackTitle="Error en Generador DSV Cisco">
              <DsvView />
            </ErrorBoundary>
          )}

          {currentView === 'estimates' && (
            <ErrorBoundary fallbackTitle="Error en Historial de Cotizaciones">
              <EstimatesHistoryView />
            </ErrorBoundary>
          )}

          {currentView === 'users' && currentUser.role === 'admin' && (
            <ErrorBoundary fallbackTitle="Error en Gestión de Usuarios RBAC">
              <UserManagementView />
            </ErrorBoundary>
          )}

          {currentView === 'audit' && currentUser.role === 'admin' && (
            <ErrorBoundary fallbackTitle="Error en Registro de Auditoría">
              <AuditLogsView />
            </ErrorBoundary>
          )}

          {currentView === 'settings' && (
            <ErrorBoundary fallbackTitle="Error en Configuración de Sistema">
              <SettingsView onOpenThemes={() => setIsThemeModalOpen(true)} />
            </ErrorBoundary>
          )}

          {currentView === 'quoter' && (
            <ErrorBoundary fallbackTitle="Error en Cotizador Cisco CCW">
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
                  {/* Summary Metric Cards */}
                  <SummaryCards data={processedResult} params={params} />

                  {/* Main Grid: Parameters Sidebar + Quoter Views */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Collapsible Parameter Sidebar */}
                    {isParamSidebarOpen && (
                      <div className="lg:col-span-3">
                        <ParameterSidebar
                          params={params}
                          onChangeParams={setParams}
                          onToggleCollapse={() => setIsParamSidebarOpen(false)}
                          items={processedResult.items}
                          overrides={customOverrideMap}
                          currentTotal={processedResult.calculatedProductTotal}
                        />
                      </div>
                    )}

                    {/* Quoter Content Tabs (Expands to 12 cols when parameter sidebar is closed) */}
                    <div className={isParamSidebarOpen ? 'lg:col-span-9' : 'lg:col-span-12'}>
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
                        </div>

                        {!isParamSidebarOpen && (
                          <button
                            onClick={() => setIsParamSidebarOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-[11px] font-semibold flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Mostrar Parámetros (7%, 6%, 5%)</span>
                          </button>
                        )}
                      </div>

                      {/* Active Tab View */}
                      {activeQuoterTab === 'excel' && (
                        <ErrorBoundary fallbackTitle="Error en Vista Excel">
                          <ExcelSheetPreview
                            data={processedResult}
                            params={params}
                            onSetRowRule={setRowRule}
                            onToggleRowRule={cycleRowRule}
                          />
                        </ErrorBoundary>
                      )}

                      {activeQuoterTab === 'table' && (
                        <ErrorBoundary fallbackTitle="Error en Tabla Interactiva">
                          <InteractiveTable
                            data={processedResult}
                            params={params}
                            onSetRowRule={setRowRule}
                            onToggleRowRule={cycleRowRule}
                          />
                        </ErrorBoundary>
                      )}

                      {activeQuoterTab === 'calculator' && (
                        <ErrorBoundary fallbackTitle="Error en Calculadora">
                          <QuickCalculator params={params} />
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="max-w-2xl mx-auto text-center py-16 px-4 space-y-6">
                  <div className="w-20 h-20 bg-indigo-600/15 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/30">
                    <FileSpreadsheet className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">
                      Cotizador Cisco CCW &bull; Cisco Automated v2.1
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
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary fallbackTitle="Error Crítico en la Aplicación">
      <CiscoAutomatedProvider>
        <AppContent />
      </CiscoAutomatedProvider>
    </ErrorBoundary>
  );
}

export default App;
