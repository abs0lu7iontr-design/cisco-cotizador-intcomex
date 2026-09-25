import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Globe,
  RefreshCw,
  Key,
  CheckCircle2,
  AlertCircle,
  X,
  Server,
  Lock,
  Search,
  ExternalLink,
  Cpu,
  Sliders,
} from 'lucide-react';
import {
  runCiscoSuiteDiagnostics,
  checkPsirtForProduct,
  resolvePoeBudgetFromSku,
} from './ciscoApiService';
import {
  getCiscoConfig,
  saveCiscoConfig,
  clearCiscoTokenCache,
} from './ciscoAuthService';
import {
  CiscoSuiteDiagnosticReport,
  PsirtAdvisory,
  PoeBudgetInfo,
} from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_API_LIST = [
  {
    name: 'Cisco PSIRT openVuln API',
    limit: '5 calls/sec • 60/min',
    desc: 'Auditoría de vulnerabilidades y CVEs en SKUs cotizados',
    endpoint: 'https://apix.cisco.com/security/advisories/v2',
  },
  {
    name: 'Datafoundation-POE',
    limit: '2 calls/sec • 5.000/día',
    desc: 'Validación de presupuestos PoE/PoE+/UPOE y watts por puerto',
    endpoint: 'Motor PoE 802.3af/at/bt + APIX',
  },
  {
    name: 'HelloCommerce API',
    limit: '10 calls/sec • 100.000/día',
    desc: 'Validación de conectividad B2B con Cisco Commerce (CCW)',
    endpoint: 'https://apix.cisco.com/hellocommerce/v1',
  },
  {
    name: 'CX Cloud Inventory V2',
    limit: '10 calls/sec • 5.000/día',
    desc: 'Base instalada de equipos y números de serie',
    endpoint: 'https://apix.cisco.com/cs/api/v2/inventory/hardware',
  },
  {
    name: 'CX Cloud Contracts V2',
    limit: '10 calls/sec • 5.000/día',
    desc: 'Contratos SmartNet y coberturas de clientes mineros/corporativos',
    endpoint: 'https://apix.cisco.com/cs/api/v2/contracts/contract-details',
  },
  {
    name: 'CX Cloud Alerts V2',
    limit: '10 calls/sec • 5.000/día',
    desc: 'Field Notices de hardware y alertas EOL de fábrica',
    endpoint: 'https://apix.cisco.com/cs/api/v2/product-alerts/hardware-eol',
  },
  {
    name: 'CX Cloud Customer V2',
    limit: '10 calls/sec • 5.000/día',
    desc: 'Perfiles y cuentas de clientes corporativos en CX Cloud',
    endpoint: 'https://apix.cisco.com/cs/api/v2/customer-info/customer-details',
  },
];

export const CiscoApiStatusModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState(() => getCiscoConfig());
  const [showCredentialsEdit, setShowCredentialsEdit] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [report, setReport] = useState<CiscoSuiteDiagnosticReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Consola interactiva de consulta rápida PSIRT + PoE
  const [queryInput, setQueryInput] = useState('C9200L-24P-4G-E');
  const [isQueryingSku, setIsQueryingSku] = useState(false);
  const [skuPoeResult, setSkuPoeResult] = useState<PoeBudgetInfo | null>(() =>
    resolvePoeBudgetFromSku('C9200L-24P-4G-E')
  );
  const [skuPsirtResults, setSkuPsirtResults] = useState<PsirtAdvisory[]>([]);
  const [hasSearchedPsirt, setHasSearchedPsirt] = useState(false);

  if (!isOpen) return null;

  const handleSaveCredentials = () => {
    const updated = saveCiscoConfig(config);
    setConfig(updated);
    setSavedNotice('Credenciales Cisco OAuth2 M2M guardadas correctamente.');
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleRunTest = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      clearCiscoTokenCache();
      const diag = await runCiscoSuiteDiagnostics();
      setReport(diag);
      if (diag.sampleAdvisories && diag.sampleAdvisories.length > 0 && !hasSearchedPsirt) {
        setSkuPsirtResults(diag.sampleAdvisories);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error conectando con Cisco OAuth2 / APIX Gateway');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectSku = async () => {
    const clean = queryInput.trim();
    if (!clean) return;
    setIsQueryingSku(true);
    setHasSearchedPsirt(true);
    try {
      const poe = resolvePoeBudgetFromSku(clean);
      setSkuPoeResult(poe);
      const advisories = await checkPsirtForProduct(clean, 4);
      setSkuPsirtResults(advisories);
    } finally {
      setIsQueryingSku(false);
    }
  };

  const maskedClientId =
    config.clientId.length > 8
      ? `${config.clientId.slice(0, 6)}...${config.clientId.slice(-4)}`
      : config.clientId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Cisco Developer API Suite (Producción)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  7 APIs Vinculadas
                </span>
              </div>
              <p className="text-xs text-slate-400">
                App: Cisco Automated - Partner Quoting and Installed Base Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Resumen de Credenciales Activas */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400">Client ID:</span>
                  <code className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 font-mono border border-slate-800">
                    {maskedClientId}
                  </code>
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">Grant Type:</span>
                  <span className="font-bold text-emerald-300">Client Credentials (M2M)</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-400">Gateway:</span>
                  <code className="text-[11px] text-indigo-300 font-mono">
                    https://apix.cisco.com
                  </code>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCredentialsEdit((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
              >
                <Sliders className="w-3 h-3 text-cyan-400" />
                <span>{showCredentialsEdit ? 'Ocultar Parámetros' : 'Configurar Credenciales'}</span>
              </button>
            </div>

            {showCredentialsEdit && (
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Cisco Client ID (Key)
                  </label>
                  <input
                    type="text"
                    value={config.clientId}
                    onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Cisco Client Secret
                  </label>
                  <input
                    type="password"
                    value={config.clientSecret}
                    onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    CX Cloud Customer ID (Opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.cxCustomerId || ''}
                      onChange={(e) => setConfig({ ...config, cxCustomerId: e.target.value })}
                      placeholder="Ej. ID corporativo CX"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCredentials}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {savedNotice && (
              <div className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-800/50 rounded-lg px-3 py-1.5">
                {savedNotice}
              </div>
            )}
          </div>

          {/* Resultado de Telemetría OAuth2 en Vivo */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/70 flex items-center gap-3 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <div className="font-bold">Error de Autenticación / Red con Cisco API</div>
                <div className="text-rose-300/90">{errorMsg}</div>
              </div>
            </div>
          )}

          {report && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-black text-emerald-300">
                    Token OAuth2 RS256 Validado • Gateway apix.cisco.com ONLINE (
                    {report.tokenInfo.latencyMs}ms)
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Scope: <code className="text-emerald-300">{report.tokenInfo.scope}</code> &bull;
                    Vigencia: <span className="font-semibold">{report.tokenInfo.expiresInSeconds}s</span>{' '}
                    &bull; Canal:{' '}
                    <span className="text-cyan-300 font-semibold">
                      {report.tokenInfo.transportMode === 'desktop_bridge'
                        ? 'Puente Nativo Desktop (.exe)'
                        : report.tokenInfo.transportMode === 'cloudflare_edge_proxy'
                          ? 'Cloudflare Edge Server-to-Server'
                          : 'Conexión Directa M2M'}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Verificado: {report.checkedAt}
              </span>
            </div>
          )}

          {/* Lista de las 7 APIs Activas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                <span>APIs Habilitadas y Autorizadas (7 Servicios Oficiales)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Token Endpoint: id.cisco.com/oauth2/default/v1/token
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {DEFAULT_API_LIST.map((api) => {
                const liveSvc = report?.services.find((s) => s.service === api.name);
                const isOnline =
                  liveSvc?.status === 'ONLINE' || liveSvc?.status === 'REQUIRES_CUSTOMER_ID';

                return (
                  <div
                    key={api.name}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{api.name}</span>
                        {liveSvc ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isOnline
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                                : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                            }`}
                          >
                            {liveSvc.status === 'REQUIRES_CUSTOMER_ID'
                              ? 'TOKEN OK'
                              : liveSvc.status}
                            {liveSvc.latencyMs ? ` • ${liveSvc.latencyMs}ms` : ''}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-900 text-slate-400 border border-slate-800">
                            Vinculada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{api.desc}</p>
                      {liveSvc?.message && (
                        <p className="text-[10px] text-cyan-300/90 font-medium pt-0.5">
                          {liveSvc.message}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                      {api.limit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consola Interactiva: Inspector PoE (Datafoundation-POE) + Escáner PSIRT en Vivo */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>
                  Inspector en Vivo: Datafoundation-POE &amp; Auditoría de Vulnerabilidades PSIRT
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Prueba cualquier SKU o familia (ej. C9200L-24P-4G-E, C9300-48FP-E, FPR1010-NGFW-K9, MR46-HW)
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInspectSku();
                }}
                placeholder="Ingresa un SKU o familia Cisco (ej. C9200L-24P-4G-E, Firepower, Meraki)..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleInspectSku}
                disabled={isQueryingSku}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isQueryingSku ? 'Consultando PSIRT...' : 'Auditar SKU / Producto'}</span>
              </button>
            </div>

            {/* Resultado Datafoundation-POE */}
            {skuPoeResult && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Zap
                    className={`w-4 h-4 ${
                      skuPoeResult.poeSupported ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <span className="font-bold text-white font-mono">
                      {skuPoeResult.partNumber}
                    </span>
                    <span className="mx-2 text-slate-600">&bull;</span>
                    <span className="text-slate-300">{skuPoeResult.poeClass}</span>
                    {skuPoeResult.notes && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{skuPoeResult.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      skuPoeResult.poeSupported
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {skuPoeResult.poeSupported
                      ? `PoE Budget: ${skuPoeResult.maxWatts}W (${skuPoeResult.standard})`
                      : 'Sin PoE (0W)'}
                  </span>
                  {skuPoeResult.recommendedDefaultPsu && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300">
                      PSU: {skuPoeResult.recommendedDefaultPsu}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Resultados en vivo de Cisco PSIRT openVuln API */}
            {skuPsirtResults.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>
                    Boletines Oficiales Recientes en Cisco PSIRT openVuln API (
                    {skuPsirtResults.length})
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Fuente: apix.cisco.com/security/advisories/v2
                  </span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {skuPsirtResults.map((adv) => (
                    <div
                      key={adv.advisoryId}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              adv.sir === 'Critical'
                                ? 'bg-rose-950 text-rose-300 border border-rose-700/50'
                                : adv.sir === 'High'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700/50'
                                  : 'bg-indigo-950 text-indigo-300 border border-indigo-700/50'
                            }`}
                          >
                            {adv.sir}
                          </span>
                          <span className="font-semibold text-white">{adv.advisoryTitle}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {adv.advisoryId}
                          {adv.cves.length > 0 && ` • CVEs: ${adv.cves.slice(0, 4).join(', ')}`}
                        </div>
                      </div>
                      {adv.publicationUrl && (
                        <a
                          href={adv.publicationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-semibold"
                        >
                          <span>Advisory</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>
              {isLoading
                ? 'Consultando Cisco ID y Gateway APIX...'
                : 'Probar Token y Conexión en Vivo (7 APIs)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
