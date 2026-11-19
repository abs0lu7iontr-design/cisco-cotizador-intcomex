# Registro de Cambios e Historial de Modificaciones (Changelog)

Todos los cambios notables y modificaciones de cada actualización en **Cisco Automated** están documentados en este archivo.

El formato se basa rigurosamente en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer)](https://semver.org/lang/es/).

---

## [v2.20.0] - 2026-11-18
### 🛡️ Auto-Guardado Permanente en Historial DSV, Blindaje de BD y Nuevo Módulo de Historial Individual BO
- **Auto-Guardado Obligatorio al Generar/Descargar Plantilla DSV (`DsvModal.tsx` & `DsvView.tsx`):**
  - Corrección de fondo en el flujo de exportación DSV donde anteriormente la descarga del archivo Excel de 48 columnas no guardaba el registro en Firestore ni en la base local.
  - Ahora, en cada exportación se ejecuta automáticamente `saveDsvToCloud(...)` y `syncBoOrderFromDsvRecord(...)`, garantizando que todas las gestiones comerciales DSV queden respaldadas en la nube y en el almacenamiento local permanente sin depender de un guardado manual.
- **Blindaje Anti-Purga y Cero Pérdida de BD en Registros DSV (`firestoreService.ts`):**
  - Eliminado el bug crítico que ejecutaba `localStorage.removeItem` cuando el JSON serializado de órdenes DSV superaba los 20 KB.
  - Implementado motor de almacenamiento redundante multi-nivel: caché en memoria ultra-rápida, persistencia asíncrona en IndexedDB de alta capacidad (`STORES.KEYVAL`), respaldo dual en bóveda local y carga resiliente de semillas maestras (`dsvSeeds.ts`, incluyendo Infocorp Deal 86146758, Sonda 8899201, Telefónica Tech 7744102 y Entel 6612984).
- **Nuevo Módulo: Historial Individual de Órdenes BO (`BoIndividualHistoryView.tsx`):**
  - Incorporada una nueva pestaña principal en el módulo Back Order (Tracking BO) titulada **"Historial Individual de Órdenes BO"**.
  - Ofrece un registro maestro estructurado de todas las órdenes BO individuales creadas desde el Cotizador CCW (Estimates), Outlook o DSV, independiente del tablero Kanban de flujo de despacho.
  - Incluye ficha de detalle completa con desglose financiero (Venta Total USD, Margen Bruto, Margen %, Internación, Arancel), datos de cliente, partner, bodega (E1 física vs ED digital), guía de courier y bitácora cronológica de notas y transiciones de etapa.
- **Filtro Mensual por Defecto con Avance Continuo e Historial Completo:**
  - El nuevo módulo de historial individual BO se abre automáticamente en el mes en curso (`Mes Actual`) y permite consultar cualquier mes histórico, trimestres o la totalidad de los registros acumulados.
- **Auto-Ajuste Multiresolución con Zoom Local en Historial BO:**
  - Integrado el componente `TableDensityZoomControls` con hook `useTableDensityAndZoom` para adaptar automáticamente el tamaño de fuentes, paddings y zoom visual a cualquier resolución o pantalla portátil sin alterar el navegador.
- **Blindaje de Persistencia y Bóveda Permanente en Tracking BO (`boTrackingService.ts`):**
  - Protección de datos idéntica a Pipeline y Forecast con escritura paralela en `LOCAL_BO_TRACKING_VAULT_KEY` y auto-hidratación que previene estados vacíos en modo offline o limpiezas accidentales del caché del navegador.
- **Exportación a Excel / CSV del Historial BO:**
  - Botón integrado para descargar en UTF-8 con BOM la bitácora completa de órdenes BO con sus 21 columnas maestras.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/dsvBoHistoryPersistenceArmor.test.ts`):**
  - 6 pruebas automáticas pasando al 100%, totalizando 44 suites de pruebas unitarias exitosas en toda la plataforma.

## [v2.19.0] - 2026-11-18
### 📦 Visibilidad de P/N Excluidos del DSV y Opción Ergonómica de Inclusión Forzada (Estilo BO)
- **Panel Desplegable de P/N Descartados / Excluidos del DSV (Estilo BO):**
  - Implementado un panel colapsable en `DsvView.tsx` homologado con la ergonomía visual del módulo de Back Order (`BoRequestModal.tsx`).
  - Muestra la lista completa de ítems del BOM que por defecto no se incorporan a la matriz DSV (aquellos con precio de lista `$0.00 USD`, licencias o componentes sin costo).
  - Incluye badges con conteo en tiempo real (`X líneas excluidas`, `Y forzados incluidos en DSV`) y cabecera interactiva con `ChevronUp` / `ChevronDown`.
- **Inclusión Forzada Opcional en 1 Clic (`+ Incluir en DSV`):**
  - Cada fila descartada cuenta con un botón dedicado `+ Incluir en DSV` para incorporarla a la exportación oficial si el negocio o el partner lo requiere.
  - Opciones de acción masiva en cabecera: `Incluir Todos en DSV` y `Restaurar Exclusiones` (para revertir forzados con 1 solo clic).
- **Preservación Rigurosa de Cálculos Financieros:**
  - Las fórmulas matemáticas consolidadas de precios (Hardware -42%, Suscripciones periódicas, Servicios escalonados y contratos CON-) se conservan 100% inalteradas.
  - En los ítems forzados de costo cero, el motor calcula limpia y transparentemente `$0.00 USD` en Reported Unit Price (Col J) y Reported Net Price (Col K), garantizando integridad numérica y cero distorsión en totales.
- **Trazabilidad Visual en Tabla Activa y Descarte Reversible:**
  - Los productos forzados que suben a la tabla activa de vista previa se destacan con la insignia ámbar `+ Forzado` y cuentan con un botón `Quitar` en la columna de acción para devolverlos a la sección de descartados en cualquier momento.
- **Descarga de Lista Descartada en CSV:**
  - Botón integrado `Descargar CSV` que exporta un archivo delimitado por comas con codificación UTF-8 con BOM conteniendo: Línea, Part Number / SKU, Descripción, Cantidad, List Price USD y Motivo de Exclusión.
- **Sincronización con Modal de Exportación (`DsvModal`):**
  - El modal de generación de las 48 columnas reconoce las líneas forzadas, recalcula dinámicamente las métricas de exportación (`+X forzados`), e incorpora un visor desplegable interactivo previo a la descarga del archivo Excel final.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/dsvExcludedItemsVisualAndForceInclude.test.ts`):**
  - 7 pruebas unitarias automáticas que validan la exclusión por defecto, retorno de `discardedRows`, inclusión forzada sin distorsión de precios, persistencia en modal y vista (43 suites de prueba pasando al 100%).

## [v2.18.0] - 2026-11-18
### 🖥️ Auto-Ajuste Inteligente Multiresolución, Densidad Adaptativa y Zoom Local en Todos los Módulos
- **Hook Universal de Densidad y Zoom (`useTableDensityAndZoom`):**
  - Creado un hook centralizado que detecta automáticamente el ancho de viewport del usuario (`isSmallScreen < 1440px`), ofreciendo 3 modos de densidad: `Auto-Fit` (adaptación inteligente según dispositivo), `Compacto` (ergonomía ceñida para laptops y pantallas escaladas) y `Estándar` (espaciado aireado para pantallas grandes).
  - Incluye zoom local de tabla clampeado entre 75% y 115% mediante CSS `zoom: N%`, permitiendo a los usuarios ajustar la escala de visualización de cada módulo de forma independiente sin tocar el zoom nativo de Windows ni del navegador web.
  - Persistencia reactiva del modo de densidad y nivel de zoom en `localStorage` con prefijo configurable por módulo (`storageKeyPrefix`).
- **Componente Visual Unificado (`TableDensityZoomControls`):**
  - Barra de herramientas compacta y responsiva con botones `Auto-Fit`, `Compacto`, `Estándar` e interactores de zoom `[-]`, `%` (con reset a 100% en un clic) y `[+]`.
  - Diseñado con soporte multitema visual (`emerald`, `indigo`, `amber`, `cyan`, `sky`, `teal`) para una integración visual armónica con la paleta de cada módulo.
- **Forecast Comercial Cisco & Intcomex (36 Columnas):**
  - Integrado control de densidad y zoom local con tema esmeralda en la barra de herramientas superior.
  - Espaciado de celdas y cabeceras reducido para maximizar la cantidad de columnas visibles simultáneamente.
  - Tarjetas KPI adaptadas a grilla responsiva fluida (`grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`) y barra de filtros con auto-envoltura limpia sin desbordes.
- **Pipeline Comercial & Oportunidades (18 Columnas & Tablero Kanban):**
  - Densidad compacta y zoom local integrados tanto en la vista Tabla como en el tablero Kanban de 5 columnas.
  - Filtros flexibles con `min-w-0` y tarjetas de métricas auto-ajustables a cualquier ancho de pantalla.
- **Back Order Tracking (Órdenes Intcomex & Cisco):**
  - Control de densidad y zoom aplicado tanto a la vista de tabla extendida como a las columnas Kanban de los 14 estados logísticos.
  - Erradicación de recortes en laptops de 1366x768 o pantallas con escalado de Windows al 125%/150%.
- **Cotizador Cisco CCW & Summary Cards:**
  - Control de densidad y zoom local añadido en el banner auxiliar del cotizador.
  - Celdas y cabeceras con padding dinámico en la tabla virtualizada de 12 columnas.
  - Tipografía fluida en las tarjetas de resumen (`text-lg sm:text-xl xl:text-2xl font-black font-mono tracking-tight`) garantizando la visualización íntegra de cifras grandes en USD, CLP y UF.
- **Cotizador CCW-R de Servicios & SmartNet:**
  - Densidad ceñida y control de zoom local en la vista de cotización de servicios, ribbon de métricas optimizado y tablas de ítems compactadas.
- **Demanda & Stock E1 y Generador DSV:**
  - Controles de zoom y auto-ajuste integrados en la consulta de almacenes E1 y en la tabla de vista previa de 48 columnas DSV, previniendo scroll horizontal descontrolado.
- **Preventa IA ConfiguriAtor:**
  - Layout de 2 columnas reestructurado para apilarse limpiamente en pantallas menores a 1280px (`xl:grid-cols-12` con `xl:col-span-5` y `xl:col-span-7`), eliminando el apretamiento excesivo del panel de chat y del historial en notebooks.
- **Blindaje Estructural en Layout Principal (`App.tsx` & `Navbar.tsx`):**
  - Eliminado de raíz el desborde horizontal de la ventana completa configurando `<main>` con `flex-1 min-w-0 overflow-y-auto overflow-x-hidden`.
  - Textos secundarios en la barra de navegación superior condensados con visualización condicional para prevenir saltos de línea verticales en resoluciones compactas.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/multiScreenResolutionAutoFit.test.ts`):**
  - 11 pruebas unitarias automáticas que validan la existencia y lógica del hook, el componente de controles, el rango de zoom, y la correcta integración en todos los módulos (42 suites de prueba pasando al 100%).

## [v2.17.5] - 2026-11-18
### 🔔 Deduplicación Estricta de Solicitudes y Notificaciones de Permiso en Historial de Estimates
- **Deduplicación Integral en Cruce de Storage Tiers (`useEstimatesMirror`):**
  - Identificada y corregida la causa raíz en `mergeAndDeduplicateEstimates`: al fusionar las cotizaciones almacenadas a través de los múltiples niveles locales (IndexedDB Tier 1, Primary Cache, Vault y Mirror), las listas de `accessRequests` se concatenaban (`[...(existing.accessRequests), ...(cleanRecord.accessRequests)]`) sin deduplicar por usuario. Esto provocaba que si un usuario solicitaba acceso una sola vez, la solicitud se duplicara en memoria y disco al leer de múltiples tiers.
  - Implementada la función `deduplicateAccessRequests` que consolida las solicitudes por nombre de usuario (sin distinción de mayúsculas/minúsculas) y conserva deterministamente la solicitud más reciente o activa.
- **Blindaje de Notificaciones en Banners y Badges de Interfaz:**
  - `getPendingAccessRequestsForUser`, `actionablePendingRequests` y `myPendingRequestsCount` ahora aplican deduplicación obligatoria por el par clave `estimateId::username`.
  - Se erradica por completo la aparición de tarjetas dobles en el banner de *"Tienes X solicitud(es) de permiso pendiente(s)"* y contadores erróneos (como marcar 2 cuando solo existe 1 petición real).
- **Protección contra Disparos Concurrentes en UI (In-Flight Locking):**
  - Añadido bloqueo en vuelo en `handleRequestAccess` con `requestingAccessKeys` y desactivación temporal de los botones `[Permiso]` / `[Re-solicitar]`, impidiendo envíos dobles por doble-clic rápido del usuario.
- **Saneamiento Idempotente en Firestore Cloud:**
  - `requestEstimateAccess` y `resolveEstimateAccessRequest` purgan cualquier entrada previa del mismo usuario antes de guardar en la nube o en caché local.
- **Auto-Curación Transparente de Registros Previos:**
  - Al abrir o sincronizar el Historial, cualquier registro local con solicitudes duplicadas existentes se auto-repara de forma inmediata y silenciosa.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/estimateAccessNotificationDedup.test.ts`):**
  - Valida la purga de duplicados, la fusión segura de storage tiers, la emisión de 1 sola notificación y la resolución idempotente (41 suites de prueba pasando al 100%).

## [v2.17.4] - 2026-11-18
### 🔐 Erradicación de Usuario Predeterminado Residual y Soporte Transparente de Credenciales Guardadas en Pantalla de Login
- **Erradicación Definitiva del Usuario Residual `pm_cisco`:**
  - Eliminado el valor de prueba predeterminado hardcodeado `"pm_cisco"` en `FACTORY_DEFAULT_PLATFORM_CONFIG` dentro de `localPlatformConfig.ts`.
  - Si el usuario no ha guardado previamente credenciales en el equipo, los campos de entrada **"Usuario de Sistema"** y **"Contraseña"** inician de manera 100% limpia y vacía.
- **Saneamiento Automático de LocalStorage:**
  - Implementada una rutina de auto-curación en `getLocalPlatformConfig()`: si existe una clave legacy con `lastUsername === 'pm_cisco'`, se sanea automáticamente a `''` y se sincroniza la corrección en `localStorage` al arrancar la app.
  - Esto evita que el Gestor de Contraseñas del navegador (Chrome, Edge, PyWebView2) detecte el usuario predeterminado `"pm_cisco"` y autoinyecte contraseñas no deseadas.
- **Soporte Transparente y Seguro de Credenciales Recordadas:**
  - Si el usuario activa la opción *"Recordar usuario en este computador"*, el sistema persiste de forma segura y discreta su propio usuario y contraseña en el almacenamiento local protegido (`cisco_local_saved_pass_v1`).
  - Al cargar la aplicación, si el usuario tiene credenciales guardadas conscientemente, se muestran sus datos legítimos (ej. `mskill`), permitiendo un inicio de sesión expedito en 1 solo clic.
- **Purga Instantánea de Seguridad al Desmarcar:**
  - Al desmarcar la casilla *"Recordar usuario en este computador"*, tanto el usuario como el token de contraseña almacenados en el PC se eliminan de inmediato.
- **Aislamiento de Cambios de Usuario:**
  - Al modificar o borrar manualmente el campo de usuario, la contraseña asociada se limpia de inmediato para prevenir incongruencias o accesos erróneos.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/savedCredentialsAndLoginClean.test.ts`):**
  - Valida la configuración de fábrica limpia, saneamiento de remanentes legacy, autocompletado de credenciales guardadas y purga en desmarcado (40 suites de prueba del proyecto pasando al 100%).

## [v2.17.3] - 2026-11-18
### 🖥️ Auto-Ajuste Responsivo de Pantalla, Densidad Dinámica y Control de Zoom en Historial de Estimates
- **Auto-Ajuste Responsivo de Pantalla (100% Fit):**
  - Rediseño integral de la tabla de cotizaciones CCW y órdenes DSV en `EstimatesHistoryView.tsx` para ajustarse automáticamente al ancho disponible y a cualquier resolución de pantalla (laptops 1366x768, monitores estándar 1080p, y pantallas de alta resolución 2K/4K).
  - Se visualizan las 11 columnas completas de la tabla (incluyendo *Ítems*, *Fecha* y el panel de *Acceso & Acciones* con botón *Cargar*) dentro del viewport visible sin cortes ni scroll horizontal forzado, eliminando la necesidad de que el usuario altere el zoom general del navegador.
- **Ergonomía de Espaciado Ceñido (Reducción de Padding Muerto):**
  - Reemplazo de los paddings excesivos `px-5 py-4` por celdas ceñidas y optimizadas (`px-2 py-2` en laptops y `2xl:px-3 2xl:py-2.5` en pantallas grandes), ahorrando más de 250px de espacio horizontal muerto a lo largo de las 11 columnas.
- **Apilamiento Ergonómico en Columna Estimate / Deal ID:**
  - La primera columna se reorganizó en dos líneas compactas:
    - Línea 1: Link directo a Cisco CCW con iconito externo + Badge de versión (`v1`, `v2`, etc.).
    - Línea 2: Insignia de privacidad ultra compacta (`Solo PC` / `Restringido` / `Público`) + Deal ID en tipografía mono.
  - Esto previene que una sola celda supere los 280px de ancho y desplace las columnas hacia la derecha.
- **Selector de Densidad Visual (Auto-Fit, Compacto, Estándar):**
  - Incorporado en la barra superior un selector de densidad persistente en `localStorage`:
    - `Auto-Fit`: Modo predeterminado inteligente que balancea el espaciado para encajar al 100% en pantallas modernas.
    - `Compacto`: Diseñado especialmente para pantallas pequeñas o laptops de 1366x768.
    - `Estándar`: Para pantallas amplias de 2K / 4K.
- **Controles de Zoom Local de Tabla Integrados (75% a 115%):**
  - Botones dedicados `[-] [+]` y porcentaje interactivo en la barra del historial para escalar exclusivamente la tabla a voluntad del usuario, sin alterar el zoom general de Windows ni del navegador.
- **Coherencia Responsiva en Órdenes DSV:**
  - Rediseñada la tabla de órdenes DSV (Tab 2) con el mismo criterio responsivo ceñido para sus 9 columnas.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/estimatesHistoryResponsiveLayout.test.ts`):**
  - Valida la ergonomía de celdas, apilamiento de Estimate/Deal, persistencia de densidad, controles de zoom dinámico y renderizado sin desborde (39 suites de pruebas del proyecto pasando al 100%).

## [v2.17.2] - 2026-11-18
### 🛡️ Blindaje Estricto de Privacidad Offline, Consentimiento de Subida Nube y Actualización de Versión Mobile
- **Confirmación y Aislamiento 100% Efectivo en Modo Offline:**
  - Verificado que en Modo Offline todos los módulos comerciales (Cotizador CCW, Cotizador CCW-R de Servicios, Generador DSV, Seguimiento Tracking BO, Pipeline Comercial, Forecast Comercial y Registro de Partners) operan de manera 100% aislada en el PC, escribiendo exclusivamente en SQLite / OPFS e IndexedDB sin contactar ni transferir datos a Firestore.
- **Conexiones a Internet Habilitadas Exclusivas y Específicas:**
  - Se confirma y garantiza que únicamente tres funcionalidades específicas tienen conectividad de red autorizada:
    1. **Actualizaciones de la Aplicación:** Monitoreo y descarga de nuevas versiones y notas de release desde la CDN de Cloudflare Pages (`/version.json`), permitiendo actualizar en caliente en 1 clic.
    2. **Autenticación y Login en la Nube:** Validación de credenciales de usuario contra Firestore Cloud al contar con conexión física a Internet, sin guardar contraseñas ni hashes en el equipo local.
    3. **Preventa IA:** Consultas de homologación y análisis técnico asistido por IA (Google Gemini API), previa solicitud o consentimiento del usuario.
- **Cero Subidas sin Consentimiento Explícito (Incluso al Volver a Online):**
  - Eliminado de raíz el vaciado automático de la cola offline (`flushOfflineQueue`) en eventos de reconexión de red (`window 'online'`) o tras pasar de Offline a Online.
  - La función `flushOfflineQueue` ahora exige obligatoriamente el parámetro `hasUserConsent: true`. Si no se cuenta con la autorización expresa del usuario, la subida se bloquea inmediatamente y los datos se mantienen resguardados en el PC.
  - El usuario dispone de control soberano en el modal de sincronización (`OfflineSyncModal.tsx`) para revisar sus acciones pendientes y decidir explícitamente entre: `[Subir a la Nube (Consentimiento)]`, `[Pasar a Online sin Subir (Mantener Local)]` o `[Descartar Cambios del PC]`.
- **Actualización Integral de la Experiencia Móvil (Mobile PWA & Touch):**
  - `MobileBottomNav.tsx`: Pestaña 2 actualizada oficialmente a **"Preventa IA"** con icono `Bot` e insignia `IA`.
  - `MobileMenuDrawer.tsx`: Enriquecido con accesos directos a los módulos de **"Demanda & Stock E1"** (Bodega E1 Santiago) y **"Monitor de Salud & SQLite"** (diagnóstico de almacenamiento WASM y VACUUM).
  - Indicador interactivo en el encabezado móvil mostrando en tiempo real el estado `OFFLINE` / `ONLINE` y el conteo de cambios pendientes en disco local.
  - Actualizada la etiqueta del catálogo local a "Catálogo Fast Track (SQLite / Local)".
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/offlineConsentAndMobileVersion.test.ts`):**
  - Cobertura completa en el bloqueo de subidas no consentidas, aislamiento de red y coherencia de navegación móvil (38 suites de pruebas del proyecto pasando al 100%).

## [v2.17.1] - 2026-11-17
### 📅 Filtros Dinámicos Mensuales por Defecto en Pipeline, Forecast e Historial con Soporte de Trimestres (Q) y Año
- **Apertura Mensual Dinámica por Defecto en Módulos Comerciales:**
  - Configurado el filtrado temporal en **Pipeline Comercial**, **Forecast Comercial** e **Historial de Estimates** para abrir de forma predeterminada en el **Mes Actual** (ej. *Noviembre 2026*).
  - La interfaz se mantiene limpia, ordenada y concentrada en las oportunidades y cotizaciones del periodo en curso, eliminando la sobrecarga cognitiva de visualizar cientos de registros históricos al mismo tiempo.
- **Transición Automática Mes a Mes:**
  - El mes activo se resuelve dinámicamente mediante el reloj del sistema (`getCurrentMonthName()`, `getCurrentYearMonth()`); al avanzar el calendario (ej. paso de Noviembre a Diciembre), el filtro inicial progresa automáticamente al mes subsiguiente sin intervención manual ni reinicio de configuración.
- **Soporte Integral de Periodos Comerciales (Trimestres, Años y Meses):**
  - Los selectores de filtro en Pipeline, Forecast e Historial ahora incluyen:
    - `Mes Actual` (con nombre de mes dinámico y año).
    - `Todos los Meses` (Histórico Completo).
    - `Trimestres`: `Q1 (Ene - Mar)`, `Q2 (Abr - Jun)`, `Q3 (Jul - Sep)` y `Q4 (Oct - Dic)`.
    - Meses individuales del calendario gregoriano.
    - `Año Actual` (`YEAR_CURRENT`).
- **Evaluador Temporal Universal (`matchesPeriodFilter` en `dateUtils.ts`):**
  - Motor de matching unificado y tipado capaz de correlacionar fechas en formatos ISO (`YYYY-MM-DD`), cadenas con nombres de meses en español (`Noviembre`, `Diciembre`), claves `YYYY-MM`, trimestres y números de serie de Excel (ej. `46252` correlacionado a Agosto y Q3).
- **Acción Rápida en Estado Vacío:**
  - Cuando un módulo abre en el mes actual y aún no existen cotizaciones u oportunidades registradas para ese mes, se ofrece un botón interactivo para alternar a *"Ver todos los meses / histórico completo"* en 1 solo clic.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/commercialPeriodFiltering.test.ts`):**
  - Suite exhaustiva validando resolución de mes y trimestre dinámico, filtrado multiformato con seriales de Excel y filtros comerciales en Pipeline y Forecast (37 suites del proyecto pasando al 100%).

## [v2.17.0] - 2026-11-17
### 🗄️ Migración a Motor Relacional SQLite Oficial (WASM) & Persistencia Física en Disco OPFS
- **Migración a Motor Relacional SQLite Oficial:**
  - Implementado el motor relacional SQLite v3 compilado a WebAssembly (WASM) con persistencia física en disco mediante OPFS (Origin Private File System).
  - Resuelto el problema de saturación y cuota de 5 MB en LocalStorage mediante almacenamiento nativo en archivos binarios `.sqlite` en disco.
- **Tablas Relacionales con Esquemas Tipados e Índices:**
  - Creadas las tablas relacionales `cisco_kv_store`, `cisco_estimates`, `cisco_pipeline_deals`, `cisco_forecast_records`, `cisco_offline_queue` y `cisco_system_metadata` con índices de alto rendimiento.
- **Consultas SQL en Microsegundos en el Cliente:**
  - Soporte de transacciones ACID y consultas SQL (`SELECT`, `WHERE`, `GROUP BY`, `SUM`, `ORDER BY`, `VACUUM`) ejecutadas directamente en el cliente en microsegundos sin latencia ni cuotas de red.
- **Descarga de Base de Datos SQLite (.sqlite) en 1 Clic:**
  - Incorporado en la tarjeta de Almacenamiento Local del Monitor de Salud el botón para descargar una copia binaria completa de `cisco_automated.sqlite`, permitiendo auditoría, respaldo y consulta externa mediante herramientas como DB Browser for SQLite, DBeaver o scripts en Python.
- **Optimización y Desfragmentación VACUUM en Caliente:**
  - Incorporado botón interactivo en el Monitor de Salud para ejecutar `VACUUM;` en SQLite, desfragmentando páginas y reduciendo el tamaño en disco en tiempo real.
- **Adaptador Unificado Transparente (`indexedDbStorage.ts`):**
  - Todas las operaciones de almacenamiento de la plataforma (`idbSet`, `idbGet`, `idbDelete`, `idbGetAll`, `idbClear`) ahora operan directamente sobre SQLite WASM como Tier 1, manteniendo total retrocompatibilidad con los módulos de Cotizador CCW, CCW-R, Pipeline, Forecast y Seguimiento BO.
- **Monitor de Salud con Telemetría SQLite en Verde ÓPTIMO:**
  - La tarjeta de diagnóstico de almacenamiento local ahora reporta `Motor Relacional SQLite v3 (WASM & Persistencia OPFS)` con telemetría en verde ÓPTIMO, eliminando falsos positivos de almacenamiento degradado.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/sqliteStorageEngine.test.ts`):**
  - Suite completa validando inicialización, esquemas relacionales, operaciones CRUD atómicas, consultas SQL avanzadas, compactación VACUUM, exportación binaria con encabezado SQLite v3 y diagnóstico del monitor de salud.

## [v2.16.2] - 2026-11-17
### 📅 Resolución de Fechas Comerciales y Conversión de Números de Serie de Excel
- **Resolución Universal de Fechas en Tablas Comerciales:**
  - Corregido el problema visual donde las columnas de fecha (ej. *Fecha de Levantamiento* y *Fecha de Cotización*) mostraban números enteros de serie de Excel (`46252`, `45846`, `45978`) en lugar de fechas legibles para el usuario.
- **Conversión de Seriales Numéricos de Excel (`dateUtils.ts`):**
  - Implementada la función `formatCommercialDate` que reconoce números de serie de Excel (rango 20000 a 100000) y los convierte con precisión de calendario gregoriano UTC a formato `DD/MM/YYYY`:
    - `46252` $\rightarrow$ `18/08/2026`
    - `45846` $\rightarrow$ `08/07/2025`
    - `45978` $\rightarrow$ `17/11/2025`
  - Soporte automático para strings numéricos, fechas ISO `YYYY-MM-DD`, formatos `DD-MM-YYYY` y preservación de descripciones no-fecha (ej. `"Nov-2026"` o `"Q4"`).
- **Formateo Integral en Forecast Comercial (`ForecastView.tsx`):**
  - Renderizado automático en todas las columnas temporales de la matriz de 36 columnas: Col 1 (`fechaLevantamiento`), Col 2 (`fechaCotizacion`), Col 10 (`mesFacturacion` si es serial), Col 25 (`submittedDate`) y Col 33 (`priceProtectionExpiryDate`).
- **Normalización en Pipeline Comercial y Modales de Edición:**
  - `PipelineView.tsx`, `PipelineDealModal.tsx` y `ForecastModal.tsx` ahora normalizan y renderizan siempre fechas en formato `DD/MM/YYYY` o `DD-MM-YYYY`, previniendo campos rotos.
- **Saneamiento Automático al Importar Planillas Excel:**
  - Las funciones de ingesta `importForecastFromExcel` e `importPipelineFromExcel` convierten de inmediato los seriales numéricos a fechas humanas al procesar el archivo.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/commercialDateFormatting.test.ts`):**
  - 100% de cobertura en la resolución de seriales de Excel, formatos mixtos y preservación de textos comerciales.

## [v2.16.1] - 2026-11-17
### 🛡️ Blindaje de Persistencia y Auto-Hidratación Infalible de Pipeline y Forecast Comercial
- **Resolución Definitiva de Pérdida de Datos en Pipeline y Forecast:**
  - Corregido el problema visual donde, tras compilar actualizaciones, optimizar el almacenamiento o abrir la aplicación en Modo Offline, las vistas de Pipeline Comercial y Forecast Comercial mostraban `0 DEALS` y `$0 USD`.
- **Auto-Hidratación Infalible de Catálogos Maestros:**
  - Tanto `pipelineStorage.ts` como `forecastStorage.ts` cuentan ahora con una regla de protección absoluta: si la base de datos local queda vacía (debido a limpieza de caché, actualización de versión o pérdida de referencias) y no existen tombstones de borrado total, el sistema auto-hidrata de inmediato los 70 deals oficiales del Pipeline (~$21.8M USD) y los 158 registros oficiales del Forecast Comercial de Intcomex.
- **Corrección de la Trampa de `alreadySeeded`:**
  - Se eliminó el bloqueo que impedía restaurar las semillas oficiales cuando la clave de inicialización (`LOCAL_PIPELINE_SEEDED_KEY` / `LOCAL_FORECAST_SEEDED_KEY`) persistía en el navegador pero el contenido real en IndexedDB / LocalStorage había sido depurado o migrado.
- **Búsqueda Multi-Clave y Respaldo Canónico en IndexedDB:**
  - `readDurableDeals` y `readDurableRecords` ahora buscan y reconcilian datos en las claves con projectScope (`cisco_automated`), en las claves predeterminadas (`default_local`), y en los respaldos migrados por `modernStorageEngine` (`STORES.KEYVAL`), consolidando y re-persistiendo en la clave canónica activa.
- **Protección de Datos en Reparación de Almacenamiento (`healthService.ts`):**
  - La función `repairStorageCache()` ahora respalda de forma obligatoria cualquier colección de Pipeline o Forecast en IndexedDB antes de purgar LocalStorage, garantizando que ninguna optimización de espacio elimine registros comerciales del usuario.
- **Sincronización Bidireccional en `modernStorageEngine.ts`:**
  - Al trasladar bóvedas pesadas (> 15 KB) de LocalStorage a IndexedDB, el motor guarda simultáneamente copias validadas en las claves canónicas de IDB para que `PipelineView` y `ForecastView` las lean sin interrupciones.
- **Botón de Restauración de Catálogo Maestro en `ForecastView.tsx`:**
  - Se agregó el botón `RotateCcw` en la barra de herramientas del Forecast Comercial para permitir al usuario restablecer los 158 registros oficiales de Intcomex con confirmación en un solo clic.
- **Nueva Suite de Pruebas Unitarias Automatizadas (`tests/pipelineForecastPersistenceArmor.test.ts`):**
  - Creada suite que verifica la auto-hidratación de 70 deals de Pipeline y 158 registros de Forecast ante base limpia, la preservación de datos tras purga de caché con `repairStorageCache` y `optimizeAndMigrateLocalStorage`, y la gestión de tombstones.

## [v2.16.0] - 2026-11-17
### 🤖 Rebranding a "Preventa IA" & Comparativa Técnica de Homologación de Marcas Rivales
- **Rebranding Oficial del Módulo a "Preventa IA":**
  - El módulo anteriormente denominado *"ConfigurIAtor"* pasa a llamarse formalmente **"Preventa IA"** en todos los puntos de contacto de la aplicación: barra lateral de navegación (`Sidebar.tsx`), encabezado principal y barra de herramientas (`ConfiguriatorView.tsx`), modales de conectividad online (`OnlineRequirementModal.tsx`) y ajustes del sistema (`SettingsView.tsx`).
- **Comparativa Técnica de Homologación Lado a Lado (`HomologationComparisonCard.tsx`):**
  - Al ingresar un equipo de otra marca (Aruba/HPE, Fortinet, Huawei, Dell, Juniper, Ubiquiti, MikroTik, Palo Alto, Extreme Networks, etc.) para su sustitución u homologación, el sistema despliega automáticamente una tarjeta interactiva con la comparativa detallada de especificaciones entre el equipo rival y la propuesta oficial Cisco 2026.
  - Se evalúan lado a lado los 10 aspectos técnicos más relevantes para validar la homologación:
    1. *Tipo & Arquitectura de Equipo*
    2. *Puertos de Acceso (Downlinks cobre/PoE)*
    3. *Uplinks de Fibra Óptica (1G/10G/25G SFP+)*
    4. *Presupuesto Eléctrico PoE y Capacidad en Watts*
    5. *Nivel de Enrutamiento (Layer 2 vs Layer 3 / OSPF / BGP / Dynamic Routing)*
    6. *Capacidad de Conmutación & Throughput de Reenvío (Gbps / Mpps)*
    7. *Capacidad de Apilamiento / Hardware Stacking (StackWise)*
    8. *Gestión Cloud & Telemetría (Catalyst Center & Meraki Dashboard)*
    9. *Fuente de Poder y Conector Norma Chilena (CAB-IT / CAB-ACA)*
    10. *Garantía Oficial de por Vida (E-LLW) & Soporte Intcomex (SmartNet Total Care)*
- **Preservación del % de Homologación Técnica:**
  - Se mantiene y destaca visualmente el porcentaje de compatibilidad y homologación (ej. *100% Homologación Técnica*), asegurando que el preventa o PM conozca con certeza matemática si la solución cubre o supera el requerimiento del cliente o pliego de licitación.
- **Dictamen Técnico y Ventajas Competitivas:**
  - El módulo genera un veredicto formal redactado por el Arquitecto Preventa IA certificando la equivalencia y destacando las ventajas competitivas de Cisco para su defensa en propuestas comerciales.
- **Botón de Copiado Rápido:**
  - Botón integrado *"Copiar Comparativa"* para exportar instantáneamente el informe técnico al portapapeles en formato limpio, listo para pegar en correos de Outlook o propuestas comerciales.
- **Suite de Pruebas Unitarias al 100% (`tests/preventaIaHomologation.test.ts`):**
  - Nueva suite automatizada que valida la detección de competidores, la generación de comparativas de 10 criterios, la preservación del % de homologación y la extracción en lenguaje natural. 33 suites de pruebas pasando al 100%.

## [v2.15.3] - 2026-11-17
### 🤫 Validación de Credenciales 100% Silenciosa en la Nube y Retiro de Leyendas en Login
- **Retiro de Leyenda Visual en Pantalla de Login (`LoginScreen.tsx`):**
  - Se eliminó la leyenda *"Validación 100% en Firestore Cloud. Las contraseñas no se almacenan en el PC."* ubicada al pie del botón de inicio de sesión, manteniendo la interfaz corporativa completamente limpia y minimalista.
  - La función de seguridad subyacente sigue operando al 100% de forma invisible y silenciosa: las contraseñas se autentican contra Firestore Cloud y las claves locales jamás retienen contraseñas en texto plano ni hashes.
- **Autenticación Discreta en Modo Offline (`firestoreService.ts`, `LoginScreen.tsx`):**
  - Si el usuario tiene seleccionado el perfil *"MODO OFFLINE"* en su equipo pero su computadora cuenta con conexión a Internet (`navigator.onLine === true`), el sistema ya no bloquea el inicio de sesión ni muestra cuadros de advertencia.
  - El sistema valida las credenciales de forma discreta y silenciosa contra Firestore en la nube, autentica al usuario y entra directamente al cotizador preservando el Modo Offline en el equipo.
- **Eliminación del Banner de Advertencia Bloqueante:**
  - Se retiró la advertencia invasiva *"🔒 Por motivos de seguridad y privacidad, la validación de credenciales se realiza directamente en la nube. Conéctate a internet para iniciar sesión."*.
  - En caso de que el equipo carezca físicamente de conexión de red al intentar iniciar sesión, el sistema muestra un mensaje limpio y conciso: *"Se requiere conexión a Internet para iniciar sesión."*.
- **Suite de Pruebas Unitarias Actualizada (`tests/autoUpdateAndCloudAuth.test.ts`):**
  - Se adaptaron las aserciones de validación para soportar la autenticación discreta sin leyendas bloqueantes. Las 32 suites de pruebas continúan pasando al 100%.

## [v2.15.2] - 2026-11-17
### 👁️ Banner Offline Auto-Dismiss, Intercepción Inteligente de Funciones Nube & Dólar Actual Limpio
- **Banner de Modo Offline Auto-Dismiss y No Invasivo (`App.tsx`):**
  - La leyenda superior *"MODO OFFLINE ACTIVO — Guardado Local en este PC..."* ahora se oculta de forma automática tras 6 segundos de aparecer para no obstaculizar el espacio vertical de trabajo ni la visibilidad de los paneles.
  - Se incorporó un botón de cierre inmediato (`X`) para descartar el aviso en cualquier instante.
  - El botón compacto e indicador de estado `MODO OFFLINE` permanece visible de forma permanente en la barra superior (`Navbar.tsx`), permitiendo alternar entre modos o verificar el estado en 1 clic.
- **Intercepción Inteligente de Módulos que Requieren Conexión (`OnlineRequirementModal.tsx`, `Sidebar.tsx`, `App.tsx`):**
  - Al hacer clic en un módulo que requiere conexión activa a la nube (ConfigurIAtor IA en vivo, Gestión de Usuarios, Feedback & Soporte, Auditoría Cloud) mientras la aplicación está en Modo Offline, el sistema ya no bloquea la acción de forma silenciosa e inerte.
  - Se despliega el nuevo componente modal `OnlineRequirementModal.tsx`, el cual:
    - Explica con claridad por qué el módulo seleccionado requiere conectividad de red e inteligencia artificial en vivo.
    - Si el equipo tiene conexión a internet (`navigator.onLine`), detecta que el usuario está en Modo Offline Manual y le ofrece el botón directo **[Pasar a Modo Online y Abrir]**, cambiando el modo y cargando la vista solicitada de forma inmediata.
    - Si el equipo carece físicamente de internet, le notifica amablemente que conecte su computador a una red Wi-Fi o cable de red.
- **Visualización y Conversión de Dólar Actual Limpio sin "+10" (`SummaryCards.tsx`, `chileanExchangeRateService.ts`, `HealthDashboardView.tsx`, `healthService.ts`):**
  - Se eliminó completamente la fórmula confusa `+ $10 = $991.61 CLP` y la mención `+Spread 10 CLP` tanto en el banner de tipos de cambio de `SummaryCards` como en el Monitor de Salud.
  - La visualización ahora expone limpia y directamente el indicador oficial del día:
    $$\text{1 USD = \$981,61 CLP} \quad \bullet \quad \text{1 UF = \$41.146,83 CLP}$$
  - **Conversión Directa a CLP:** Al presionar el botón de divisa `CLP` en el cotizador, los valores y totales se calculan directamente en base al Dólar Actual observado publicado por el Banco Central de Chile, sin sumarle recargos artificiales.
  - El modal de ajuste rápido de tipo de cambio permite modificar directamente el Dólar Actual y la UF en pesos chilenos sin campos de recargo redundantes.
- **Suite de Pruebas Unitarias Automatizadas (`tests/offlineBannerAndCleanRates.test.ts`):**
  - Nueva suite de pruebas automáticas que verifica el spread cero, la conversión limpia a CLP con el dólar actual, y la clasificación estricta de módulos offline vs online. Todas las 32 suites del proyecto ejecutadas y aprobadas al 100%.

## [v2.15.1] - 2026-11-17
### ⚡ Actualizaciones Permanentes (Online/Offline), Seguridad Cloud de Credenciales & Purga Masiva de LocalStorage
- **Actualizaciones NUNCA quedan Offline (`autoUpdateManager.ts`, `AutoUpdateBanner.tsx`, `Navbar.tsx`):**
  - La verificación de nuevas versiones se mantiene permanentemente activa siempre que haya conectividad de red, sin ser bloqueada ni silenciada por el "Modo Offline" de la aplicación.
  - El sistema consulta el CDN de Cloudflare (`version.json`) en 4 eventos clave:
    1. Al arrancar o recargar el aplicativo (tanto en Navegador Web como en la App de Escritorio Windows).
    2. En cada evento de reconexión de red (`window.addEventListener('online')`).
    3. Al cerrar sesión (`logout()`), aplicando la actualización de forma automática y transparente antes de reingresar.
    4. En sondeo periódico en segundo plano cada 5 minutos.
  - Notificación visual con Banner interactivo (`AutoUpdateBanner.tsx`) y botón reluciente en el Navbar con resumen de notas de la versión y botón de **[Actualizar en 1 Clic]** (reemplazo en caliente de bundle en Desktop o recarga cache-busting en Web).
- **Seguridad y Privacidad de Credenciales: Validación Exclusiva en Firestore Cloud (`LoginScreen.tsx`, `firestoreService.ts`):**
  - Por estricta normativa de seguridad y privacidad corporativa, el usuario y la contraseña NUNCA se guardan en ninguna base de datos local (IndexedDB ni LocalStorage).
  - La autenticación de credenciales se procesa directamente contra la colección `users` en Firestore Cloud comparando el hash criptográfico SHA-256 con salt.
  - Si un usuario intenta iniciar sesión sin internet, el sistema le notifica con insignia de seguridad: *"🔒 Por motivos de seguridad y privacidad, la validación de credenciales se realiza directamente en la nube. Conéctate a internet para iniciar sesión."*
  - Compatibilidad completa con el Gestor de Contraseñas del Navegador: El formulario ahora incluye los estándares `autoComplete="username"` y `autoComplete="current-password"`, permitiendo que Google Password Manager, Microsoft Edge Wallet, iCloud Keychain o Firefox almacenen y autocompleten las credenciales con cifrado robusto del sistema operativo.
- **Erradicación Total de Saturación de LocalStorage (`modernStorageEngine.ts`, `healthService.ts`, `databaseBackupManager.ts`):**
  - Se identificó y resolvió la saturación de 9.99 MB (100% DEGRADADO) en LocalStorage mostrada en el monitor de salud: Las colecciones masivas de órdenes DSV (`cisco_cloud_dsv_cache_v2`, `cisco_dsv_permanent_vault_v1`, `cisco_dsv_backup_cache_v1`), catálogos de partners y bóvedas históricas ahora se almacenan de forma exclusiva en el motor de alta capacidad IndexedDB (W3C StorageManager con 50+ GB de capacidad).
  - La rutina automática `optimizeAndMigrateLocalStorage()` migra silenciosamente en el arranque cualquier clave superior a 15 KB hacia IndexedDB y purga las copias redundantes, reduciendo el consumo de LocalStorage de 9.99 MB a menos de 0.05 MB (< 1% de uso).
  - El Monitor de Salud y Diagnóstico refleja de inmediato el almacenamiento en estado 100% ÓPTIMO (verde).
- **Suite de Pruebas Automatizadas (`tests/autoUpdateAndCloudAuth.test.ts`):**
  - Nueva suite de pruebas unitarias que valida la comparación SemVer, la exclusión física de contraseñas de LocalStorage, la purga de claves masivas y la validación en la nube. Total: 31 suites de pruebas ejecutadas con 100% de éxito.

## [v2.15.0] - 2026-11-17
### 🛡️ Seguridad, Privacidad de Cotizaciones, Versionado Automático (v1, v2, v3) y Notificaciones de Permisos
- **Privacidad y Control de Visibilidad para PMs y Preventas (`SaveEstimateModal.tsx`, `DownloadModal.tsx`):**
  - Nueva opción *"Solo en este PC (Privado Local)"*: Permite guardar la cotización exclusivamente en el disco local del equipo (IndexedDB) sin subirla a la nube de Firestore ni incluirla en la cola de sincronización offline.
  - Opción de *"Sin Guardar en Historial"*: Permite descargar planillas Excel corporativas en modo confidencial sin dejar rastro en el historial local ni remoto.
  - **Acceso Cruzado al Historial del Equipo:** Los usuarios con cotizaciones locales privadas pueden seguir consultando, filtrando y cargando todas las cotizaciones públicas compartidas por el resto del equipo en tiempo real.
- **Versionado Automático Secuencial ($v1 \rightarrow v2 \rightarrow v3 \dots$):**
  - Al guardar o exportar modificaciones de una cotización existente (mismo `estimateId`), el motor calcula automáticamente la versión más alta existente y genera la siguiente versión incremental ($v1 \rightarrow v2 \rightarrow v3$) con nota de cambios opcional y trazabilidad completa.
- **Enmascaramiento de Datos Financieros Sensibles en Cotizaciones Restringidas (`EstimatesHistoryView.tsx`, `DashboardView.tsx`):**
  - En cotizaciones con visibilidad restringida, las cifras confidenciales (Margen %, Internación %, Arancel %, Costo Neto Cisco, Ganancia Intcomex USD y montos por partida) se ocultan automáticamente bajo la insignia `🔒 Protegido` para usuarios no autorizados.
  - Protección analítica en el Dashboard: Las utilidades y totales de cotizaciones restringidas no autorizadas se excluyen de los cálculos de rentabilidad comercial general para impedir deducciones indirectas.
- **Sistema de Notificaciones y Solicitud de Permisos (`estimateAccessNotificationService.ts`, `AccessNotificationsDropdown.tsx`):**
  - Flujo de solicitud formal de acceso: Los colegas pueden solicitar permiso para visualizar los márgenes de una cotización restringida mediante el botón `[Solicitar Permiso al PM]`.
  - Notificaciones en tiempo real en el Navbar con campana y contador de solicitudes pendientes dirigidas exclusivamente al PM creador.
  - Resolución en 1 solo clic: El PM puede autorizar o rechazar solicitudes al instante desde el dropdown del Navbar o desde la vista de detalle del Estimate.
  - Avisos interactivos de resolución para el solicitante cuando su solicitud es concedida.
- **Publicación de Cotizaciones Locales a la Nube en 1 Clic (`publishLocalEstimateToCloud`):**
  - Botón directo `[Subir a Nube ☁️]` en la tabla del Historial para que el PM o preventa pueda compartir una cotización local en Firestore (como Pública o Restringida) cuando esté lista.
- **Optimización Reforzada de Almacenamiento Local (`modernStorageEngine.ts`, `healthService.ts`):**
  - Consolidación automática de colecciones pesadas desde LocalStorage hacia IndexedDB (Tier 1 de alta capacidad con soporte de Gigabytes), liberando espacio inmediato para mantener LocalStorage en niveles óptimos (< 0.5 MB) tanto Online como Offline.
- **Suite de Pruebas Unitarias Automatizadas (`tests/estimatePrivacyAndVersioning.test.ts`):**
  - 30 suites de pruebas unitarias automáticas aprobadas al 100%.

## [v2.14.1] - 2026-11-16
### 🚀 Motor de Almacenamiento Moderno de Alta Capacidad (StorageManager / Gigabytes) y Purga de LocalStorage
- **Motor Moderno de Alta Capacidad (StorageManager / IndexedDB - Gigabytes):**
  - Integración nativa con la API oficial W3C `navigator.storage` (`estimate()` y `persist()`), proveyendo cuotas masivas de almacenamiento (entre 50 GB y 120+ GB según el disco del equipo).
  - El motor opera con idéntica potencia y confiabilidad tanto en **Modo Online** como en **Modo Offline**, asegurando almacenamiento ilimitado de cotizaciones, pipeline, forecast y órdenes BO.
- **Resolución de Saturación de LocalStorage (9.99 MB / 100%):**
  - Se eliminaron las escrituras masivas duplicadas y triplicadas en LocalStorage (`LOCAL_PIPELINE_VAULT_KEY`, `LOCAL_FORECAST_VAULT_KEY`, `LOCAL_ESTIMATES_VAULT_KEY`, `LOCAL_ESTIMATES_MIRROR_KEY`, `LOCAL_BO_TRACKING_VAULT_KEY`, `LOCAL_DEAL_REMINDERS_VAULT_KEY`, `LOCAL_DSV_VAULT_KEY`).
  - El respaldo de emergencia maestro (`EMERGENCY_BACKUP_KEY`) ahora se guarda de forma segura en IndexedDB (`STORES.KEYVAL`), impidiendo que un único JSON masivo consuma la cuota de 5 MB de LocalStorage.
- **Auto-Purga y Migración Automática (`optimizeAndMigrateLocalStorage`):**
  - Migración silenciosa de colecciones pesadas desde LocalStorage hacia IndexedDB y purga de copias redundantes, reduciendo el consumo de LocalStorage de 9.99 MB a menos de 0.1 MB (< 2% de uso).
- **Rediseño del Monitor de Salud (`HealthDashboardView.tsx` & `healthService.ts`):**
  - La tarjeta *"Almacenamiento Local en PC"* ahora destaca como medidor primario el **Motor Moderno de Alta Capacidad (StorageManager / IndexedDB)** en verde óptimo con decenas de Gigabytes libres y persistencia blindada contra evicción del navegador.
  - LocalStorage se reclasifica correctamente como *"Bóveda Rápida de Preferencias"* (reservada para tokens y parámetros rápidos < 50 KB).
  - Nuevo botón interactivo *"Optimizar Almacenamiento"* que consolida datos pesados en IndexedDB y libera la memoria de LocalStorage en 1 solo clic.
- **Integridad de Pruebas:**
  - 29 suites de pruebas unitarias automáticas aprobadas al 100%.

## [v2.14.0] - 2026-11-16
### 💻 Persistencia Local-First por Computador: Modo Offline Permanente, Temas y Parámetros Comerciales sin Nube
- **Persistencia Permanente del Modo Offline en este Equipo (`localPlatformConfig.ts`, `offlineModeManager.ts`):**
  - Si el usuario conmuta la aplicación al Modo Offline, la preferencia se almacena de forma inmutable en el almacenamiento local del equipo (`localStorage` bajo la clave `cisco_local_platform_config_v2`).
  - Al cerrar sesión, cambiar de cuenta, recargar la página o reiniciar la computadora, la aplicación **se mantiene estrictamente en Modo Offline** sin requerir que el usuario vuelva a presionar el botón cada vez.
- **Autonomía Local Total sin Dependencia de la Nube (Local-First):**
  - El inicio de sesión (`LoginScreen.tsx`) en Modo Offline omite llamadas HTTP externas a Firebase Firestore y servicios de geolocalización remota, autenticando al usuario de forma instantánea ($0\text{ ms}$) mediante el caché criptográfico local de credenciales (`getLocalUsersCache`).
  - La resolución de parámetros de partner (`partnerParamsService.ts`) y la sincronización de usuarios (`firestoreService.ts`) operan en modo local autosuficiente sin bloqueos de red.
- **Persistencia Local de Temas Visuales y Modos de Experiencia UI:**
  - La paleta visual seleccionada (`cisco-blue`, `cyber-neon`, etc.), la modalidad de sistema (Cyber HUD vs Enterprise) y el estilo de interfaz (🏛️ Clásico vs ✨ Aesthetic) se almacenan localmente en el perfil del PC y se cargan al instante antes del primer renderizado.
- **Parámetros Comerciales Base Predeterminados del PC:**
  - Valores predeterminados de cotización (Internación %, Arancel %, Margen %) configurados en el equipo se recuperan automáticamente al iniciar el cotizador sin requerir perfiles en la nube.
- **Recordar Usuario en este Computador:**
  - Nueva opción en la pantalla de inicio de sesión para recordar el usuario en el equipo, facilitando el ingreso rápido y seguro.
  - Indicador visual prominente del estado de conexión del equipo (`MODO OFFLINE (PC)` vs `ONLINE (Nube)`) con conmutación en 1 clic antes de iniciar sesión.
- **Nueva Tarjeta en Configuración del Sistema (`SettingsView.tsx`):**
  - Módulo *"Configuración y Perfil Local de este Equipo (Local-First)"* con estado de conexión en vivo, parámetros base del PC, tema activo, resumen de cuentas offline listas y botón para restablecer a valores de fábrica.
- **Suite de Pruebas Unitarias Automatizadas (`tests/localPlatformConfig.test.ts`):**
  - 9 pruebas automáticas cubriendo inicialización, persistencia offline permanente, sincronización bidireccional, parámetros del equipo, observadores reactivos y caché local de usuarios.

## [v2.13.2] - 2026-11-14
### ⚡ Fórmula de Amortiguación de Megadisparos y Protección de Inventario E1 / Hit Rate
- **Fórmula de Amortiguación Matemática (`dampQuotationQuantity` en `demandIntelligenceService.ts`):**
  - Implementación de compresión cóncava sublineal ($\text{dampedQty} = 8 + \text{round}(\sqrt{2 \times (\text{rawQty} - 8)})$) para cotizaciones masivas o licitaciones de gran escala (ej. 20, 50, 100, 300 unidades).
  - Preserva el comportamiento lineal 100% exacto (1:1) en pedidos normales de run-rate ($\le 8$ unidades) y amortigua el exceso para que proyectos especulativos no distorsionen el plan de inventario.
- **Blindaje Anti-Megadisparos en Bodega E1 Santiago:**
  - Cotizaciones puntuales de gran volumen ($\ge 20$ unidades) en 1 o 2 transacciones sin venta real confirmada se clasifican estrictamente como `MADE_TO_ORDER` con la etiqueta visual *"Proyecto Especial (Bajo Pedido)"* y 0 unidades sugeridas de inventario.
  - En Cisco Intcomex, estos proyectos masivos se gestionan de manera back-to-back directo con fábrica (Miami) con descuento especial DSA, evitando inmovilizar capital en bodega local.
- **Criterios Rigurosos para Stock Crítico (`CRITICAL_STOCK`):**
  - Requiere estrictamente venta real confirmada ($\ge 6$ unidades o $\ge 3$ en múltiples órdenes con demanda continua). Jamás se otorga a SKUs sin órdenes reales de compra cerradas (`realSoldUnits < 2`).
- **Recurrencia Multi-Partner para Oportunidades (`GROWTH_OPPORTUNITY`):**
  - Requiere ventas reales moderadas ($\ge 2$ unidades) o recurrencia demostrada a través de múltiples canales/partners ($\ge 3$ cotizaciones distintas) antes de recomendar compras preventivas.
- **Protección del Hit Rate (Tasa de Conversión %):**
  - El porcentaje de conversión se calcula sobre la demanda efectiva ponderada (`effectiveTotalUnits`), impidiendo que una cotización aislada de 300 unidades pulverice el Hit Rate de equipos que tienen rotación comercial saludable.
- **Insignia Visual "⚡ Mega-deal" en UI (`DemandIntelligenceView.tsx`):**
  - Indicador visual distintivo en la tabla para marcar cotizaciones de volumen extraordinario y mostrar la demanda efectiva ponderada.
- **Suite de Pruebas Unitarias Automatizadas (`tests/demandIntelligence.test.ts`):**
  - Validación de casos de megadisparos (300 unidades sin venta), amortiguación con venta real y recurrencia multi-partner aprobada al 100%.

## [v2.13.1] - 2026-11-14
### 🛡️ Exclusión Estricta de Componentes y Accesorios Hijos en Demanda y Planificador de Stock
- **Exclusión Determinista de Líneas Hijas ("Hijos" 1.1, 1.2, 1.3... en `demandIntelligenceService.ts`):**
  - En Cisco CCW, los accesorios que ya vienen incluidos dentro del chasis del equipo (cables de poder `CAB-`, fuentes de poder `PWR-`, tapas ciegas `-BLANK`, kits de apilamiento `STACK-KIT`, brackets y licencias de red internas `-NW-`) se desglosan como sub-líneas hijas.
  - Se descartan de forma estricta de las ventas de hardware y del plan de stock para Bodega E1 mediante `isMainLineItem(item.lineNumber)` y verificación de categoría de accesorios, evitando falsos pedidos de stock de componentes que ya vienen incluidos en la caja del equipo.
- **Filtro Exclusivo de Equipos Principales en Top Hardware y Sugerencias de Stock:**
  - Los rankings de Top Hardware y sugerencias de compra para Bodega E1 Santiago se limitan al 100% a Equipos Principales (`category === 'hardware'`), excluyendo transceivers y accesorios sueltos del plan de chasis.
- **Clasificación Robusta de Accesorios Internos:**
  - Detección previa de accesorios con prefijo de switch (`-STACK-KIT`, `-NM`, `-BLANK`, `-RMK`, `PWR-`, `CAB-`, `-NW-`) para garantizar que nunca se confundan con chasis principales en el motor de clasificación.
- **Claridad de Interfaz de Usuario (`DemandIntelligenceView.tsx`, `DashboardView.tsx`):**
  - Nuevas etiquetas y subtítulos explicitando *"Solo Equipos Principales (sin accesorios internos)"* y cabecera de tabla *"Part Number (Equipo Principal)"*.

## [v2.13.0] - 2026-11-14
### 📦 Inteligencia de Demanda Comercial, Top Equipos & Licencias y Planificador de Stock Sugerido (Bodega E1 Santiago)
- **Nuevo Módulo "Demanda & Stock E1" (`DemandIntelligenceView.tsx`, `demandIntelligenceService.ts`, `demandTypes.ts`):**
  - Módulo analítico especializado accesible desde el menú lateral (`Sidebar.tsx`) bajo la sección de análisis comercial con icono `Boxes`.
  - **4 Pestañas Analíticas Interactivas:**
    1. *🏆 Top Hardware Más Vendido:* Ranking de equipos físicos (Switches, Access Points, Routers, Firewalls y Transceivers) ordenados por volumen de ventas reales con SO confirmada y facturación USD.
    2. *📜 Top Licencias & Suscripciones:* Análisis de adopción de servicios SmartNet (SNT/CX), suscripciones de software Cisco DNA y licencias Cloud SaaS (Meraki, Duo, Umbrella) aprovisionadas en Bodega ED.
    3. *⚖️ Comparativa Real vs Cotizado (Hit Rate %):* Métrica porcentual de conversión por SKU para distinguir con precisión los productos que los clientes efectivamente compran de aquellos cotizados con frecuencia únicamente con fines referenciales o presupuestarios.
    4. *📦 Planificador de Stock Sugerido (Bodega E1 Santiago):* Algoritmo cuantitativo de cálculo de inventario preventivo para Bodega E1 en Santiago de Chile, diseñado específicamente para neutralizar Lead Times críticos de Cisco (3 a 27 semanas) y cerrar negocios inmediatos con despacho en 24-48 horas.
  - **Exportación Profesional a Excel (.xlsx):**
    - Generación en 1 clic de una propuesta formal de orden de stock (`Propuesta_Stock_Bodega_E1_Cisco_Intcomex_<fecha>.xlsx`) utilizando ExcelJS, con encabezados corporativos Intcomex, formato numérico oficial USD, prioridad visual (CRÍTICO, OPORTUNIDAD, REGULAR) y justificación comercial por línea.
- **Executive Widget en Dashboard Analítico (`DashboardView.tsx`):**
  - Resumen ejecutivo interactivo "Top Equipos Calientes & Plan de Stock Bodega E1" integrado sobre la tabla de cotizaciones.
  - Indicadores inmediatos de SKUs monitoreados, ventas reales cerradas, demanda total cotizada y sugerencia global de inversión para stock en Bodega E1.
  - Previsualización del Top 5 de equipos con barras de Hit Rate y botón de navegación directa en 1 clic a la vista completa.
- **Motor de Clasificación y Cruce Multi-Módulo en Tiempo Real (`demandIntelligenceService.ts`):**
  - Clasificación automática en 10 familias comerciales Cisco (Catalyst 9200, 9300, 1000/1200/1300 SMB, Meraki Switch/Wireless/Security, Wi-Fi 6, Nexus, Routing y Transceivers).
  - Consumo seguro de solo lectura a través de 5 módulos de datos existentes: BOs con SO confirmada (`boTrackingService`), Forecast Ganado (`forecastService`), Pipeline Comercial Activo (`pipelineService`), Historial de Estimates Cloud/Mirror (`useEstimatesMirror`) y Cotizaciones CCW-R (`ccwrService`).
- **Soporte de Deep Linking (`?view=stock_intelligence` y `#stock_intelligence` en `store.tsx`):**
  - Enlace directo permalink para abrir inmediatamente la vista de inteligencia de stock desde el navegador o accesos directos.
- **Suite de Pruebas Unitarias Automatizadas (`tests/demandIntelligence.test.ts`):**
  - Validación exhaustiva de clasificación de familias, algoritmos de cálculo de prioridad y asignación de bodegas (E1 física vs ED electrónica), cálculo de Hit Rate y generación end-to-end del reporte, elevando el total a 28 suites de prueba automáticas.

## [v2.12.0] - 2026-11-14
### 🏥 Monitor de Salud y Diagnóstico del Sistema en Tiempo Real (Opción C Híbrida)
- **Nuevo Módulo "Monitor de Salud & Diagnóstico" (`HealthDashboardView.tsx`, `healthService.ts`, `healthTypes.ts`):**
  - Vista ejecutiva accesible para todos los roles (PMs, Administradores y Preventa) en el menú lateral bajo *Sistema & Monitoreo* (`Sidebar.tsx`).
  - **Scorecard de Salud Global (0-100%):** Algoritmo de ponderación multivariable que evalúa el estado del sistema en 4 niveles (*Óptimo*, *Degradado*, *Crítico* o *Desconocido*).
  - **4 Cuadrantes de Diagnóstico Interactivo:**
    1. *Cloud & Base de Datos Firestore:* Latencia en vivo, comprobación de conectividad y verificación de permisos de seguridad en colecciones críticas (`cisco_pipeline_deals`, `cisco_forecast_records`, `estimates`, `bo_order_tracking`) junto con validación de versión en Cloudflare CDN.
    2. *Almacenamiento Local en PC:* Barra gráfica de porcentaje de uso de LocalStorage (límite de 5 MB), estado del motor IndexedDB, conteo de cola offline pendiente y tombstones.
    3. *Indicadores Oficiales BCCh:* Dólar Observado, Dólar con spread comercial (+10 CLP), valor oficial de la Unidad de Fomento (UF) y botón para forzar refresco desde el Banco Central de Chile.
    4. *Entorno & Rendimiento:* Detección de plataforma (App Desktop Windows vs Navegador Web), estado físico de red, modo manual de la app y memoria JavaScript (JS Heap) consumida.
  - **Herramientas de Auto-Reparación y Diagnóstico:**
    - Botón *Diagnóstico en Vivo* para disparar pruebas concurrentes con tiempos de respuesta.
    - Botón *Limpiar Caché* para purgar claves residuales y optimizar el almacenamiento local sin alterar bóvedas comerciales.
    - Botón *Copiar Reporte* que genera un reporte estructurado en Markdown para soporte o TI.
    - Botón *Copiar Enlace Directo* para compartir la URL profunda del módulo.
- **Soporte de Enlace Directo / Deep Linking (`?view=health` y `#health` en `store.tsx`):**
  - Apertura directa del monitor al ingresar mediante `https://develop.cisco-automated.pages.dev/?view=health` o con hashtag `#health` sin pasar por la vista inicial.
  - Sincronización automática de parámetros en la barra de direcciones del navegador mediante `history.replaceState` y soporte para botones atrás/adelante (`popstate`).
- **Endpoint Edge de Salud en Cloudflare Pages (`functions/api/health.ts`):**
  - Endpoint REST ultraliviano en `/api/health` para consultas externas de disponibilidad, monitoreo automatizado tipo UptimeRobot y verificación de versión de release.
- **Suite de Pruebas Unitarias Automatizadas (`tests/healthService.test.ts`):**
  - 6 escenarios de prueba que validan el cálculo de métricas de almacenamiento, diagnóstico financiero, entorno de ejecución, ponderación de salud (100, degradado, crítico), purga de caché y formato de reporte Markdown, elevando el total a 27 suites de prueba automatizadas.

## [v2.11.1] - 2026-11-14
### ⚡ Resiliencia Cloud Firestore, Particionado Batch y Gestión Limpia de Cola Offline
- **Despliegue y Validación de Reglas Cloud Firestore (`firestore.rules`):**
  - Despliegue en producción de las reglas de seguridad de Firestore para las colecciones `cisco_pipeline_deals` y `cisco_forecast_records`, eliminando el error `permission-denied` que impedía la sincronización de oportunidades y registros con la nube.
- **Optimización de Escrituras Masivas y Particionado de Lotes Batch (`pipelineStorage.ts`, `forecastStorage.ts`):**
  - Reducción del tamaño de fragmento (`CLOUD_BATCH_CHUNK_SIZE`) de 350 a **80 documentos por batch**, evitando sobrecargas de red y garantizando una ejecución fluida.
  - Incremento del timeout de confirmación de batch de 8 a **15 segundos**, permitiendo sincronizaciones seguras de colecciones extensas (ej. 305 registros de Forecast) sin falsos positivos de desconexión.
  - Claves fijas de entidad en cola offline (`pipeline:bulk` y `forecast:bulk`), garantizando una estricta deduplicación para que múltiples intentos o lotes no acumulen elementos repetidos en la cola del navegador.
- **Acción Rápida "Descartar Cambios del PC" en Modal Offline (`OfflineSyncModal.tsx`):**
  - Incorporación de botón dedicado con confirmación interactiva para vaciar de inmediato la cola local del PC y reanudar el modo Online sin sincronizar datos desactualizados o no deseados.
- **Verificación Automatizada de Suites de Pruebas:**
  - Corrección de tipado en tests de Tracking BO (`tests/boDsvAndOfflineMode.test.ts`) asegurando el 100% de cobertura y ejecución limpia en las 26 suites de prueba del proyecto.

## [v2.11.0] - 2026-11-11
### 🛡️ Resiliencia Offline, Integridad de Datos DB y Trazabilidad Operativa BO/DSV
- **Fechas de Ingreso de OC y SO Cisco en Tracking BO (`boTrackingTypes.ts`, `boTrackingService.ts`, `BoTrackingView.tsx`):**
  - Nuevos campos persistidos `clientPoAddedAt` y `ciscoSoAddedAt` estampados automáticamente al registrar o modificar una OC (`clientPoNumber`) o SO Cisco (`ciscoSoNumber`) real (filtrando valores placeholder como `OC-PENDIENTE`, `OC-DSV`, `PENDIENTE`).
  - Backfill heurístico en lectura y edición con `inferSoDateFromNotes`, `getEffectivePoAddedDate` y `getEffectiveSoAddedDate` para órdenes históricas previas, con edición manual disponible en el modal de orden, visualización en tarjetas Kanban/Tabla y nuevas columnas en exportación CSV.
- **Corrección de Bodega `E1` (Física) vs `ED` (Digital) en Flujos DSV y BO (`boTrackingService.ts`, `DsvModal.tsx`, `DsvView.tsx`):**
  - Nueva función `detectBodegaFromDsvRows` y actualización de `syncBoOrderFromDsvRecord` para asignar `bodegaDestino: 'E1'` cuando exista al menos un SKU activo de hardware y reservar `'ED'` exclusivamente para pedidos 100% intangibles (`subscription` / `service`).
  - Auto-reparación histórica `autoRepairBoRecordBodega` en carga y edición para corregir pedidos clasificados erróneamente como `'ED'` que cuenten con guía courier física (`courierTrackingNumber`) o ítems de hardware en caché DSV/Estimates.
- **Blindaje Anti-Pérdida en Pipeline Comercial y Forecast (`pipelineStorage.ts`, `forecastStorage.ts`, `pipelineService.ts`, `ccwrStorage.ts`, `PipelineView.tsx`, `ForecastView.tsx`):**
  - Migración del almacenamiento local a **IndexedDB (`STORES.KEYVAL`) + Bóveda localStorage** para evitar pérdidas silenciosas por `QuotaExceededError`.
  - Sanitizadores estrictos `sanitizePipelineDealForCloud` y `sanitizeForecastRecordForCloud` alineados con las reglas de `firestore.rules`.
  - Eliminación del límite de 50 ítems en pushes masivos mediante `writeBatch` particionados (hasta 350 documentos por lote en `bulkSavePipelineDeals` y `bulkSaveForecastRecords`), consultas Firestore sin omisiones por `orderBy('updatedAt', 'desc')`, sincronización automática en nube al montar las vistas e IDs de Forecast libres de colisiones en CCW-R (`generateUniqueForecastId`).
- **Modo Offline Manual en Frontend + Cola Local en PC + Advertencias de Sincronización (`offlineModeManager.ts`, `offlineSyncQueue.ts`, `OfflineSyncModal.tsx`, `Navbar.tsx`, `Sidebar.tsx`, `App.tsx`):**
  - Nuevo interruptor **Online / MODO OFFLINE** en `Navbar.tsx` junto a un indicador de cambios pendientes guardados en el PC y banner persistente en `App.tsx`.
  - Al operar offline, se habilitan las funciones indispensables (cotizar CCW/CCW-R, generar DSV, gestionar BO, Estimates, Pipeline, Forecast y Recordatorios) persistiendo todo localmente en IndexedDB y encolando escrituras deduplicadas por `entityKey`, mientras `Sidebar.tsx` bloquea módulos dependientes de nube o IA en vivo (`configuriator`, `feedback`, `users`, `audit`).
  - Al volver de Offline a Online, se abre `OfflineSyncModal` mostrando el resumen por módulo en la cola del PC, advertencias explícitas sobre conflictos multiusuario y recálculo de KPIs/vistas, y opciones para **Subir Cambios y Volver Online**, **Volver Online sin Subir Ahora** o **Seguir Offline**.

## [v2.10.5] - 2026-11-10
### 📐 Ergonomía y Visualización (Compactación de Celdas Excel CCW-R y Eliminación de Espacios Muertos)
- **Eliminación Integral de Espacios Muertos (-40% ancho horizontal total, `ccwrExcelExporter.ts`):**
  - Rediseño de las 13 columnas para ajustarse de forma ceñida y natural a la longitud real del texto con una holgura limpia de solo 1.5 caracteres, reduciendo el ancho horizontal total de la planilla de 427 a 255 unidades. Esto permite visualizar prácticamente toda la cotización de punta a punta en pantalla sin necesidad de constante scroll horizontal.
- **Compactación Drástica de Nivel de Servicio (`ccwrExcelExporter.ts`):**
  - Fusión de celdas C3:D3 en la cabecera ejecutiva para alojar `"Vigencia del Servicio:"`, liberando la Columna 4 para reducirse de 24 a solo **9.5 caracteres**, eliminando el enorme vacío blanco que rodeaba al código `"SNT"`.
- **Ajuste Ceñido de Descripción del Producto y SKU (`ccwrExcelExporter.ts`):**
  - Reducción del margen de la descripción de producto a 29.5 caracteres (abrazando el texto como `"Cisco Catalyst 9115AX Series"` de forma ceñida) y SKU a 17.5 caracteres.
- **Precio Unitario Proporcionado (`ccwrExcelExporter.ts`):**
  - Columna 10 compactada a 15.5 caracteres, permitiendo que el monto en USD quede equilibrado a la derecha sin la brecha en blanco de 20 caracteres que se apreciaba previamente a su izquierda.
- **Suite de Pruebas Automatizadas Actualizada (`tests/ccwrCommercial.test.ts`):**
  - Aserciones de anchos compactos validadas (Col 4 <= 12, Col 5 <= 18, Col 10 <= 18) junto con preservación de cliente y dirección.

## [v2.10.4] - 2026-11-10
### 🔧 Corrección y Ajuste Visual (Blindaje Anti-Desborde de Celdas y Recuadros en Excel CCW-R)
- **Corrección de Desborde en Dirección Cliente Final (`ccwrExcelExporter.ts`):**
  - **Ampliación de Límite de Ancho:** Elevado el `maxWidth` de la columna de 35 a 85 caracteres.
  - **Inclusión de Metadatos de Cabecera:** El cálculo dinámico de ancho de columna ahora considera obligatoriamente `headerInfo.endCustomerAddressLine1`, garantizando que la columna sea lo suficientemente ancha para direcciones largas (ej. `AV LIBERTADOR BERNARDO, OHIGGINS 1414, SANTIAGO` de 47 caracteres) y no desborde fuera del recuadro ni de la tabla.
  - **Ajuste de Texto (wrapText: true):** Activado el ajuste de texto dentro de la celda para confinar cualquier dirección atípicamente extensa estrictamente dentro de sus bordes.
- **Corrección en Nombre de Cliente Final (`ccwrExcelExporter.ts`):**
  - Ampliado `maxWidth` a 75 caracteres e incorporado `headerInfo.endCustomerName` en el cálculo de ancho para evitar solapamiento entre la razón social y la columna de dirección contigua.
- **Justificación y Alineación Rigurosa en Todas las Celdas (`ccwrExcelExporter.ts`):**
  - Alineación horizontal explícita en todas las celdas de la tabla: izquierda para texto (`Número de Producto`, `Descripción del Producto`, `Descripción del Servicio`, `SKU`, `Nombre Cliente Final`, `Dirección Cliente Final`), centrada para códigos y fechas (`Número de Serie / PAK`, `Nivel de Servicio`, `Inicio`, `Término`, `Cantidad`, `ID Cliente Final`) y derecha para valores monetarios (`Precio Unitario (USD)` y `Total General`).
- **Definición y Nitidez de Bordes Ejecutivos (`ccwrExcelExporter.ts`):**
  - Bordes de celdas internas actualizados a un gris contrastante (`#94A3B8`), con refuerzo perimetral exterior (`medium #334155`) en las columnas de inicio y fin, encerrando perfectamente toda la cotización en un recuadro cerrado y pulcro.
- **Fusión de Celdas para Fecha en Cabecera (`ccwrExcelExporter.ts`):**
  - Celdas E6 y F6 combinadas para alojar cómodamente la fecha de emisión en español largo sin invadir ni desalinear columnas adyacentes.
- **Actualización de Suite de Pruebas Automatizadas (`tests/ccwrCommercial.test.ts`):**
  - Aserciones automáticas sobre anchos de columna de cliente y dirección, alineaciones horizontales y `wrapText: true`.

## [v2.10.3] - 2026-11-09
### 🎨 Rediseño, Ergonomía y Perfeccionamiento Ejecutivo (Cabecera Compacta Excel CCW-R, Fondo Plomo, Títulos en Español, Precio Unitario y Retiro de Plazo de Entrega)
- **Eliminación Definitiva de Cláusula de Plazo de Entrega (`ccwrExcelExporter.ts`):**
  - Retiro completo de la leyenda *"Plazo de entrega: El tiempo final de despacho está determinado por el producto con mayor tiempo de espera (lead time) de la orden"* tanto en la planilla Excel como en la copia para correo Outlook, dado que los contratos CCW-R corresponden estrictamente a servicios de soporte Smart Net Total Care, software y licencias (intangibles puros que no requieren flete físico ni despacho).
- **Corrección de Truncamiento en "Quote CCW-R:" (`ccwrExcelExporter.ts`):**
  - Ajuste explícito de la altura de la fila 7 a `20px` (previamente colapsada a 10px), garantizando que el texto `Quote CCW-R:` y el ID numérico de cotización aparezcan perfectamente visibles y con margen vertical adecuado.
- **Cabecera Compacta sin Filas Muertas (`ccwrExcelExporter.ts`):**
  - Eliminación de espacios verticales innecesarios: cabecera reorganizada en filas 3 a 7 y la tabla de cotización arranca inmediatamente en la fila 8.
  - Reemplazo de la etiqueta `Vendedor:` por `Product Manager:` tanto en la planilla Excel como en el drawer de parámetros y la vista previa frontend.
- **Diseño Corporativo en "Vigencia del Servicio:" (`ccwrExcelExporter.ts`):**
  - Aplicado acabado con diseño ejecutivo azul corporativo (fondo `#EFF6FF`, borde `#93C5FD`, tipografía `#1E40AF` centrado en celda D3) para que coincida armoniosamente con el distintivo de duración (ej. `12 Meses` en celda E3).
- **Encabezados con Fondo Plomo Institucional (`ccwrExcelExporter.ts` & `CcwrQuoteView.tsx`):**
  - Reemplazado el fondo verde de los encabezados por el color plomo/gris profesional (`#D9D9D9`) con texto negro en negrita de 9.5pt y bordes finos completos (`#334155`), tanto en el archivo Excel generado como en la vista de tabla en frontend y la copia para Outlook.
- **Traducción Completa al Español y Claridad en Precio Unitario (`ccwrExcelExporter.ts` & `CcwrQuoteView.tsx`):**
  - Todas las columnas técnicas traducidas formalmente al español:
    - `Product Number` -> `Número de Producto`
    - `Descripcion del Producto` -> `Descripción del Producto`
    - `PAK/Serial Number` -> `Número de Serie / PAK`
    - `Nivel Servicios` -> `Nivel de Servicio`
    - `Descripcion Servicio` -> `Descripción del Servicio`
    - `SKU` -> `SKU del Servicio`
    - `Fecha Inicio` -> `Fecha de Inicio`
    - `Fecha Termino` -> `Fecha de Término`
    - `Cant` -> `Cantidad`
    - `Unit` -> **`Precio Unitario (USD)`** (clarificando inequívocamente el concepto frente a la ambigua palabra "Unit")
    - `ID Cliente Final`, `Nombre Cliente Final` y `Dirección Cliente Final`
- **Suite de Pruebas Automatizadas Actualizada (`tests/ccwrCommercial.test.ts`):**
  - Aserciones sobre eliminación de cláusula de plazo de entrega, cabecera compacta en fila 8, fondo plomo `#D9D9D9` y títulos oficiales en español.
  - 100% de las 25 suites de pruebas aprobadas exitosamente.

## [v2.10.2] - 2026-11-09
### 🎨 Rediseño, Ergonomía y Perfeccionamiento Ejecutivo (Reorganización de Cabecera Excel, Total Encuadrado, Vigencia del Servicio, Leyendas Legales, Barra Estética de Margen y Viewport Ampliado)
- **Reorganización Estructural de Cabecera Excel (`ccwrExcelExporter.ts`):**
  - **Reubicación de Contacto Telefónico:** El teléfono de contacto del vendedor ha sido trasladado desde abajo del total hacia el bloque izquierdo formal, posicionado ordenadamente debajo de `Dirección:` (Fila 6).
  - **Renombramiento Oficial:** La etiqueta de cotización ahora se identifica explícitamente como `Quote CCW-R:` (Fila 8, Columna A).
  - **Cálculo de Vigencia del Servicio en Meses:** Motor de cómputo temporal `calculateContractDurationMonths` que determina con exactitud los meses de vigencia entre `Fecha Inicio` y `Fecha Término` (ej. 12 Meses, 24 Meses, 36 Meses), desplegado en un distintivo ejecutivo en Fila 4 (`Vigencia del Servicio:` | `12 Meses`).
  - **Recuadro Destacado para Total Cotización:** Encuadre destacado en Filas 5 y 6 (Columnas D y E) con borde verde corporativo medio (`#16A34A`), fondo menta suave (`#D1FAE5` / `#ECFDF5`) y tipografía de 13pt negrita (`#15803D`) para máximo impacto visual y legibilidad ejecutiva.
- **Leyendas Legales Oficiales Intcomex al Pie de la Planilla (`ccwrExcelExporter.ts`):**
  - Inserción dinámica de las 3 cláusulas normativas al final de la cotización, adaptándose automáticamente a cualquier número de líneas sin desfasar datos:
    1. *Validez de la Oferta:* "Esta cotización tiene una validez de **14 días corridos** a contar de su fecha de emisión." (Con plazo destacado en negrita y color rojo corporativo `#C00000`).
    2. *Plazo de entrega:* "El tiempo final de despacho está determinado por el producto con mayor tiempo de espera (lead time) de la orden."
    3. *Validación Técnica y Responsabilidad:* "La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner."
  - Tipografía en cursiva elegante de 8.5pt, con saltos de línea automáticos (`wrapText: true`) combinadas a lo largo de las 13 columnas.
- **Barra Estética de Margen Comercial en UI (`CcwrQuoteView.tsx`):**
  - Al ser servicios y licencias 100% intangibles (sin internación ni flete físico), se diseñó una barra de control de margen comercial ultra-limpia y estética:
    - Slider continuo con indicador luminoso y rango 0% a 30%.
    - Botones de acceso rápido (pills) para selección en 1 solo clic: `3%`, `5% (Base)`, `8%`, `10%`, `12%`, `15%`.
    - Input numérico directo con porcentaje exacto.
    - Widget integrado de Buscador de Objetivo (Goal Seek) directo en la barra principal con cálculo instantáneo al presionar Enter.
- **Ampliación Integral del Rango de Visión de la Tabla en Frontend (`CcwrQuoteView.tsx`):**
  - **Resumen por Grupos Plegable:** El bloque de "Resumen Agrupado por Modelo" ahora es colapsable/expandible bajo demanda (`[Grupos (N) ▾]`), liberando más de 200px de espacio vertical en pantalla por defecto.
  - **Cintas KPI Compactas:** Altura compactada para tarjetas KPI con tipografía de alto contraste y mayor densidad de información.
  - **Viewport Elástico de Alta Capacidad:** Contenedor de tabla con `flex-1` y scroll interno con cabecera y pie fijos (`sticky z-20`), permitiendo visualizar de **15 a 25 ítems simultáneamente** en pantalla sin recortes.
  - Padding ceñido en filas (`py-1.5 px-3`) para navegación fluida.
- **Suite de Pruebas Automatizadas Actualizada (`tests/ccwrCommercial.test.ts`):**
  - Aserciones de celda sobre el archivo Excel generado (`A6` Teléfono, `A8` Quote CCW-R, `D4-E4` Vigencia del Servicio, `D5-E6` Total Cotización, y presencia de las 3 leyendas legales).
  - 100% de las 25 suites de pruebas aprobadas con éxito.

## [v2.10.1] - 2026-11-09
### 🔧 Corregido, Optimizado y Mejorado (Detección Bidireccional de Formatos CCW vs CCW-R, Margen Base 5%, Logo Intcomex y Rediseño Ejecutivo de Excel)
- **Detector Inteligente de Formato (`src/core/fileTypeDetector.ts` & `MisroutedFileModal.tsx`):**
  - Detección precisa de firmas y metadatos: previene que una cotización CCW-R de servicios (74 columnas con números de serie y niveles de soporte) sea procesada por error en el módulo principal de Estimate como líneas corruptas a $0.
  - Alerta y Redirección en 1 clic: si el usuario sube un archivo CCW-R en el módulo de Estimate, el sistema despliega el diálogo informativo y permite transferir el archivo directamente al Cotizador CCW-R sin fricción.
  - Protección simétrica: si en el módulo CCW-R se carga un Price Estimate estándar de hardware/software, se ofrece abrirlo de inmediato en el Cotizador Cisco CCW.
- **Ajuste de Margen Base Inicial en CCW-R a 5.0% (`ccwrTypes.ts`):**
  - Los parámetros por defecto de cotizaciones de servicios y licencias ahora inician exactamente en `5.0%` de margen comercial.
- **Rediseño Estético Ejecutivo de Planilla Excel de 13 Columnas (`ccwrExcelExporter.ts`):**
  - **Logo Oficial Intcomex:** Inyección de imagen corporativa en la esquina superior izquierda (filas 1-2).
  - **Fondo Limpio sin Cuadrícula:** Desactivación de líneas grises por defecto fuera del área cotizada (`showGridLines: false`), logrando un acabado idéntico a una cotización formal.
  - **Zebra Striping (Alternancia de Filas):** Filas alternadas entre blanco puro (`#FFFFFF`) y gris/slate ejecutivo suave (`#F8FAFC`) con bordes finos completos (`#CBD5E1`) para lectura clara y ergonómica.
  - **Auto-Ajuste Ceñido de Columnas y Filas:** Dimensionamiento dinámico de anchos calculado celda a celda en base a la longitud real del texto, eliminando espacios muertos y holguras excesivas.
- **Suite de Pruebas Ampliada (`tests/ccwrCommercial.test.ts`):**
  - Incorporación de Test 8 para validar la clasificación bidireccional de archivos y el margen base de 5.0%. 100% de las 25 suites de pruebas pasando con éxito.

## [v2.10.0] - 2026-11-09
### 🚀 Añadido, Optimizado y Lanzado (Nuevo Módulo Oficial Cotizador CCW-R de Servicios & Licencias Cisco - Formato Oficial Intcomex)
- **Nuevo Módulo Especializado Cotizador CCW-R (`src/modules/ccwrQuote`):**
  - Desarrollado específicamente para la cotización de contratos de servicios Cisco (SmartNet, Solution Support, Software Support) y suscripciones/licencias exportadas desde Cisco CCW-R.
  - Ingesta inteligente de planillas de 74 columnas de CCW-R (`.xlsx`, `.xls`, `.csv`), extrayendo metadatos ejecutivos (Quote Number, Quote Name, Net Amount Cisco, Cliente Final, Vencimiento de Price Protection, Deal ID) y tabla detallada de ítems.
- **Motor Financiero y Aplicación de Margen sobre Columna Z (`Extended Net Price`):**
  - Implementación de la fórmula comercial oficial: el costo unitario base se toma de la Columna Z (`Extended Net Price / Qty`), la cual ya incluye todos los descuentos pactados con Cisco.
  - Soporte de parámetros comerciales: Margen comercial `(%)`, Arancel aduanero `(%)` e Internación/Logística `(%)`.
  - Aplicación de margen sobre el costo total: `precioVenta = costoTotal / (1 - margen / 100)`.
  - Herramienta **Buscador de Objetivo (Goal Seek)** mediante algoritmo de aproximación de búsqueda binaria de alta precisión para alcanzar automáticamente cualquier monto meta global.
- **Generación y Exportación de Planilla Oficial de 13 Columnas Intcomex:**
  - Exportador pixel-perfect con `ExcelJS` idéntico al estándar oficial entregado a clientes corporativos (formato Empresa de Transporte de Pasajeros Metro S.A.).
  - Encabezado ejecutivo con Vendedor, Empresa, Total Cotización USD, Fecha y Quote Number.
  - 13 columnas normadas: `Product Number`, `Descripcion del Producto`, `PAK/Serial Number`, `Nivel Servicios`, `Descripcion Servicio`, `SKU`, `Fecha Inicio`, `Fecha Termino`, `Cant`, `Unit`, `ID Cliente Final`, `Nombre Cliente Final`, `Direccion Cliente Final`.
  - Estilos corporativos con cabeceras verdes (`#92D050`), bordes ejecutivos, anchos calibrados y formato contable de moneda (`"$ " #,##0.00"`).
- **Copiado de Tabla para Correo Outlook:**
  - Generador de tabla HTML corporativa compacta lista para pegar directamente en correos de Microsoft Outlook o Gmail, agrupada por modelo de equipo con subtotales y seriales.
- **Integración Cruzada con Forecast Comercial y Pipeline:**
  - Enlace directo en 1 clic para sembrar o actualizar la oportunidad cotizada en el módulo de Forecast (36 columnas) y en el Pipeline Comercial.
  - Integrado con los motores anti-duplicación multi-vectoriales para no generar registros repetidos al recotizar un mismo Deal o Quote Number.
- **Pruebas Automatizadas de Integridad (`tests/ccwrCommercial.test.ts`):**
  - Cobertura de 7 áreas clave: normalización de fechas (DD-mmm-YYYY), parsing de estructura CCW-R de 74 columnas, motor de margen y aranceles sobre Columna Z, recálculo global por modelo, Goal Seek, exportación de 13 columnas y HTML para Outlook.
  - Suite de 25 pruebas unitarias e integrales ejecutadas con 100% de éxito.

## [v2.9.4] - 2026-11-08
### 🚀 Añadido, Optimizado y Blindado (Motor Anti-Duplicación Multi-Vectorial y Carga Masiva Excel para Pipeline y Forecast)
- **Motor Anti-Duplicación Multi-Vectorial en Pipeline Comercial (`pipelineService.ts`):**
  - Implementación de `findMatchingPipelineDeal` con jerarquía de 4 vectores:
    1. *Vector 1 (Primario):* Cisco CCW Deal ID oficial (# Registro de Oportunidad Marca) limpio de prefijos `#` y espacios.
    2. *Vector 2:* Estimate ID oficial proveniente del módulo Cotizador.
    3. *Vector 3 (Huella Compuesta):* Coincidencia de Partner + End User + Monto USD (dentro de tolerancia de $10 USD o ±2%).
    4. *Vector 4 (Temporal):* Coincidencia de Partner + End User + Mes de Cierre / Fecha de Cotización.
  - Protección de múltiples proyectos para un mismo cliente: Previene que diferentes negocios de un mismo cliente (por ejemplo Comtec Global con Chubb) colapsen erróneamente en un solo registro.
  - Reconciliación Inteligente en Carga Excel (`importPipelineFromExcel`): Al re-subir planillas, las oportunidades existentes se enriquecen in-situ con nuevos datos (notas, fechas, Price Protection) sin crear filas duplicadas.
- **Motor Anti-Duplicación Multi-Vectorial y Carga Excel en Forecast Comercial (`forecastService.ts`):**
  - Expansión de `findMatchingForecastRecord` con 5 vectores jerárquicos:
    1. *Vector 1:* Cisco CCW Deal ID o Promotion Authorization Number.
    2. *Vector 2:* Cisco Sales Order (SO) o Intcomex Número de Venta (NV).
    3. *Vector 3:* Purchase Order (PO) o Número de Orden de Compra (OC) validado con el Partner.
    4. *Vector 4:* Estimate ID (`sourceEstimateId`).
    5. *Vector 5 (Huella Compuesta):* Partner + End User + Monto USD (±2% o $10 USD) o Mes de Facturación.
  - Nueva función `importForecastFromExcel` que procesa archivos `.xlsx`, `.xls` o `.csv`, mapea dinámicamente las 36 columnas oficiales y ejecuta reconciliación inteligente sin duplicar.
- **Experiencia de Usuario y Modales de Importación (`PipelineView.tsx` & `ForecastView.tsx`):**
  - En `ForecastView.tsx`: Nueva zona interactiva para arrastrar o seleccionar archivos Excel (`.xlsx`, `.xls`, `.csv`) con un solo clic, junto con la opción de pegar URL de Google Sheets o texto CSV.
  - Reportes de importación detallados en ambas interfaces, informando con precisión cuántas oportunidades nuevas fueron creadas y cuántas existentes fueron enriquecidas/actualizadas sin duplicar.
- **Suite de Pruebas de Integración y Anti-Duplicación (`tests/pipelineCommercial.test.ts` & `tests/forecastCommercial.test.ts`):**
  - Pruebas automatizadas (Test 8 en Pipeline y Test 11 en Forecast) que verifican la jerarquía multi-vectorial, la no-colisión de deals para el mismo cliente y la idempotencia en cargas Excel. 100% de 24 suites de pruebas pasando con éxito.

## [v2.9.3] - 2026-11-06
### 🔧 Corregido, Optimizado y Mejorado (Integridad en Bases de Datos Pipeline & Forecast, Sincronización Nube Bidireccional y Blindaje Jerárquico DSV)
- **Blindaje y Saneamiento de Base de Datos Pipeline para Cloud Firestore (`pipelineSeeds.ts` & `pipelineStorage.ts`):**
  - Corrección de registros semilla `deal_seed_059` y `deal_seed_067` que contenían `endUser: ""` (cadena vacía), lo que provocaba rechazo por las reglas de seguridad de Firestore (`size() >= 1`). Se asignó el valor predeterminado `"-"` y se normalizaron los meses de cierre (`"Octubre"`, `"Julio"`).
  - Implementación de `sanitizeDealForCloud` en `pipelineStorage.ts` para garantizar que cualquier oportunidad creada con `endUser` o `partner` en blanco sea saneada automáticamente a `"-"` antes de enviarse a Firestore.
  - Corrección contable en `deal_seed_062` (*SupplyLine - Anglo American*), nivelando `productosSuscripciones` a $220,000 USD para cuadrar exactamente con el monto total del negocio ($220,000 USD).
- **Activación de Recordatorios de Price Protection con Formato Flexible en Pipeline (`pipelineService.ts`):**
  - Se reemplazó el constructor nativo `new Date()` por `parseFlexibleDate` en `calculatePipelineStats` y `generatePipelineReminders`.
  - Ahora reconoce y calcula correctamente fechas en formato chileno/europeo (`DD-MM-YYYY` o `DD/MM/YYYY`) con guiones y barras, evitando el error `Invalid Date` y activando las alertas de vencimiento en las tarjetas KPI y panel lateral.
- **Sincronización Bidireccional Nube Firestore en Forecast Comercial (`forecastStorage.ts` & `ForecastView.tsx`):**
  - Nueva función `syncForecastWithCloud()` con reconciliación bidireccional basada en `updatedAt` y registro de lápidas (tombstones) para borrados seguros.
  - Nuevo botón **"Nube"** en la barra de herramientas de `ForecastView.tsx` con spinner de carga y feedback emergente para sincronizar la matriz con Cloud Firestore en 1 clic.
  - Corrección de subtotales en registro semilla `FC-0007` (*Blacknet S.A. - Tarapaca Small*), alineando `productos: 10120` con `usdIntcomex: 10120`.
- **Blindaje de Líneas Jerárquicas en Exportación DSV (`dsvBomParser.ts` & `dsvEngine.ts`):**
  - Incorporación de `normalizeLineNumber` para asegurar que las líneas enteras (`1`, `2`, `3`) se formateen estrictamente como `"1.0"`, `"2.0"`, `"3.0"` en la columna D (*SO Line Number*), mientras que líneas compuestas como `"1.1.0"`, `"1.0.10"`, `"2.1.0"`, `"2.3.1"` se preservan íntegras sin degradación.

## [v2.9.2] - 2026-11-03
### 🔧 Corregido y Optimizado (Recálculo Dinámico de KPIs al Filtrar en Pipeline, Parser Flexible y Totales en Tabla)
- **Recálculo Dinámico de Métricas y KPIs al Filtrar en Pipeline (`PipelineView.tsx`):**
  - Se corrigió la llamada a `calculatePipelineStats` y `generatePipelineReminders` para operar dinámicamente sobre `filteredDeals` en lugar del catálogo global.
  - Al filtrar por PM (ej. Raúl Cuevas, Marta Adasme), Grupo de Ventas (Enterprise, Top Volume), Mes de Cierre, Etapa (% de avance) o término de búsqueda, las 5 tarjetas de KPI reflejan de inmediato el subconjunto con indicación del total filtrado (`${filteredDeals.length} de ${deals.length}`).
- **Parser Flexible de Divisas y Formatos Mixtos en Pipeline (`pipelineService.ts`):**
  - Integración de `parseFlexibleNumber` en `calculatePipelineStats` y `parseExcelToPipelineDeals`.
  - Soporte para montos con puntos y comas indistintos (`$1.085.000`, `107.849,40`, `107,849.40`), evitando que valores numéricos válidos queden truncados a 1 o evaluados como 0.
- **Nuevo Pie de Tabla con Totales Filtrados (`PipelineView.tsx`):**
  - Incorporación de fila `tfoot` con las sumas agregadas de las columnas clave: *Monto USD*, *Prod + Sub*, *Servicios* y *Meraki*, cuadrando exactamente con las tarjetas superiores.
- **Mejora Integral en Modal de Oportunidades (`PipelineDealModal.tsx`):**
  - Campos de monto adaptados a texto con previsualización en vivo: `Interpretado: $X.XX USD`.
  - Nuevo botón `"Auto-sumar a Monto Total USD"` que totaliza automáticamente `Prod+Sub + Servicios + Meraki` hacia el campo Monto Total USD.
- **Blindaje en Tablero Kanban (`PipelineView.tsx`):**
  - Suma de columnas protegida con `parseFlexibleNumber` para evitar concatenaciones de texto o valores `NaN`.

## [v2.9.1] - 2026-11-03
### 🔧 Corregido y Optimizado (Recálculo Dinámico de KPIs al Filtrar, Estética Dark Slate en Forecast y Parser Flexible)
- **Recálculo Dinámico de KPIs al Filtrar en Forecast Comercial (`ForecastView.tsx`):**
  - Se corrigió el cálculo de las 6 tarjetas de resumen KPI (`Total USD Intcomex`, `Hardware / SaaS`, `Servicios & SmartNet`, `Meraki Cloud`, `Con Sales Order` y `Recordatorios`) para que sumen dinámicamente sobre `filteredRecords` en lugar del catálogo global estático.
  - Al seleccionar cualquier filtro (por ejemplo *PM Responsable = "Raúl Cuevas"*, *Bodega = "ED"*, *Crédito*, *Grupo de Ventas* o búsqueda de texto), los totales en USD y conteos reflejan instantáneamente el subconjunto activo con indicación de deals filtrados vs total general.
- **Rediseño Visual Armónico Dark Slate / Cyber Executive (`ForecastView.tsx`):**
  - Eliminación del bloque blanco brillante (`bg-white`) que desentonaba con el tema oscuro de la plataforma.
  - Nueva estética ejecutiva con contenedor `bg-slate-900`, cabecera `bg-slate-900` con acento esmeralda, filas cebra `bg-slate-950` / `bg-slate-900/50`, bordes sutiles `border-slate-800/60` y celdas monetarias con tipografía monospace verde esmeralda de alto contraste.
  - Celdas de alerta estilizadas para modo oscuro: Crédito pendiente en ámbar oscuro (`bg-amber-950/40 text-amber-300`), Price Protection en rojo/ámbar oscuro y fecha DSV en azul petróleo (`bg-sky-950/30 text-sky-300`).
- **Parser Flexible Universal de Divisas y Números (`parseFlexibleNumber` en `forecastService.ts`):**
  - Soporte tolerante para formatos mixtos de miles y decimales con puntos y comas: chileno/CLP (`$1.085.000` o `107.849,40`), anglosajón/US (`$1,085,000.00` o `107,849.40`), y cadenas con símbolos de divisa (`$`, `USD`).
  - Previene que al tipear o pegar montos se corrompan los valores o se interpreten como cero.
  - Adaptación en `ForecastModal.tsx` de los campos numéricos a entradas de texto con formateo tolerante y previsualización en vivo del monto interpretado en USD (`${val} USD`).

## [v2.9.0] - 2026-11-03
### ✨ Añadido (Módulo Forecast Comercial 36 Columnas, Reconciliación Cruzada Multi-Módulo y Recordatorios Comerciales)
- **Nuevo Módulo de Forecast Comercial Intcomex (`src/modules/forecast/`):**
  - Implementación visual fiel de la planilla Excel corporativa de Intcomex con las **36 columnas oficiales de negocio**:
    1. *Fecha de Levantamiento*, 2. *Fecha de Cotización*, 3. *Marca* (CISCO), 4. *PM Responsable*, 5. *Partner*, 6. *Ejecutivo Partner*, 7. *End User*, 8. *USD Intcomex*, 9. *e-mail ejecutivo partner*, 10. *Mes de Facturación*, 11. *e-mail cliente final*, 12. *Detalle Productos*, 13. *OC*, 14. *Deal*, 15. *Productos*, 16. *Suscripciones*, 17. *Servicios*, 18. *Meraki*, 19. *AM*, 20. *Grupo de Ventas*, 21. *Observación*, 22. *DSV Submission*, 23. *PO*, 24. *SO*, 25. *Submitted Date*, 26. *# Cliente*, 27. *Promotion Authorization Number*, 28. *End Customer Name*, 29. *End Customer Address1*, 30. *Número de Venta*, 31. *Bodega* (E1/ED), 32. *Caso*, 33. *Price Protection Expiry Date*, 34. *Credit*, 35. *Nuevo Caso*, 36. *Confirmación Crédito*.
  - Precarga automática de **158 oportunidades reales de Intcomex** en `forecastSeeds.ts` con todos sus datos comerciales, técnicos, logísticos y financieros.
  - Estilización idéntica a Excel con encabezados verdes (`#92D050`), celdas de alerta amarilla (`#FEF08A` para crédito pendiente y revisiones), celdas de alerta roja para Price Protection vencida, y celdas azules (`#9BC2E6`) para trámites DSV.
- **Motor de Reconciliación Cruzada Multi-Módulo (CCW + BO + DSV + Pipeline):**
  - Cruce bidireccional y auto-poblado inteligente de datos desde los módulos de Cotización CCW, Back Order Tracking (BO) y Direct Ship Vendor (DSV).
  - **Motor Anti-Duplicación en 3 Niveles:** Previene duplicidad cotejando prioritariamente por *Deal ID / Promo Auth*, secundariamente por *Cisco Sales Order (SO) / Intcomex Número de Venta*, y terciariamente por *Partner + Cliente Final* normalizados. Si el negocio ya existe, actualiza los campos faltantes sin generar registros duplicados.
  - Transformación en 1 clic de **Pipeline Comercial a Forecast** sin duplicar negocios existentes.
- **Motor de Recordatorios y Alertas Comerciales (Forecast y Pipeline):**
  - Auditoría proactiva de vencimiento de Price Protection (alerta crítica si ya expiró, advertencia preventiva si vence en <= 7 días).
  - Detección de estados de crédito pendientes o en revisión (`Pdte`, `En revisión de crédito`).
  - Seguimiento de tickets y casos operacionales activos (`Caso`, `Nuevo Caso`).
  - Incorporación de Recordatorios en el módulo **Pipeline Comercial** con drawer interactivo de alertas y botón de filtro rápido "Solo con Alertas".
- **Exportación e Importación Oficial Excel y Google Sheets:**
  - Exportador a Excel/CSV con las 36 columnas exactas.
  - Importador universal con auto-mapeo de columnas para archivos Excel/CSV o enlaces públicos/compartidos de Google Sheets.
- **Colección Firestore #13 y Bóveda Multi-Tier:**
  - Reglas de seguridad endurecidas para `cisco_forecast_records/{recordId}` en `firestore.rules`.
  - Persistencia local multinivel en IndexedDB, LocalStorage Vault y tombstones.

## [v2.8.0] - 2026-11-02
### ✨ Añadido (Módulo Completo Pipeline Comercial Cisco con Integración Cruzada CCW y Tablero Kanban)
- **Nuevo Módulo de Pipeline Comercial Cisco (`src/modules/pipeline/`):**
  - Implementación integral del Pipeline de Oportunidades y Deals con las 19 columnas de negocio requeridas:
    *Fecha de Levantamiento*, *Fecha de Cotización*, *Marca*, *PM Responsable*, *Partner/Reseller*, *Ejecutivo Partner*, *End User*, *USD*, *Mes de Cierre*, *Mes de Facturación*, *Porcentaje de Avance* (20%, 30%, 50%, 70%, 100%), *#Registro Oportunidad Marca*, *Productos + Suscripciones*, *Servicios*, *Meraki*, *AM*, *GRUPO DE Ventas*, *Notas* y *Price Protection Expiry Date*.
  - Precarga automática de 70 oportunidades comerciales reales iniciales por un total de **$21,899,878 USD** distribuidas entre PMs de Intcomex (Raúl Cuevas, Marta Adasme, Johana Valencia, Mauricio Skill).
- **Integración Cruzada Multi-Módulo (Cross-Module Sync):**
  - **Cotizador Cisco CCW:** Botón de 1-clic "Vincular a Pipeline" en Navbar y barra de acciones para importar directamente la cotización activa, desglosando automáticamente las partidas en *Hardware/Prod+Sub*, *Servicios SmartNet* (`CON-`, `SVS-`, `CX-`) y *Meraki Cloud* (`MR`, `MS`, `MX`, `LIC-ENT`, `LIC-SEC`).
  - **Historial de Cotizaciones:** Botón de enlace directo en cada tarjeta de cotización para transferir montos, cliente y partner al Pipeline.
  - **Transición a Back Order (BO):** Al alcanzar el 100% de avance (Ganado / En Facturación), permite crear la orden BO en 1 clic.
  - **Price Protection Alerts:** Monitor proactivo de vencimiento de protección de precios Cisco.
- **Doble Modalidad de Visualización y Operación:**
  - **Tabla Detallada:** Visualización completa de las 19 columnas con paginación, ordenamiento por columnas, edición en línea, eliminación segura y filtros multicriterio (PM, Grupo de Ventas, Mes de Cierre, Etapa y buscador instantáneo).
  - **Tablero Kanban Interactivo:** Columnas por avance comercial (20% Levantamiento, 30% Propuesta Oficial CCW, 50% Negociación, 70% Adjudicado / Cierre, 100% Ganado / Facturación) con cambio rápido de etapa en un clic.
- **Exportación e Importación Oficial Excel:**
  - Descarga del Pipeline completo a Excel (.xlsx) respetando rigurosamente el formato y orden exacto de las 19 columnas oficiales.
  - Importador masivo desde archivos Excel con autovalidación de cabeceras y sanitización.
- **Persistencia Multi-Tier Blindada y Colección Firestore #12:**
  - Almacenamiento local redundante en IndexedDB (`cisco_pipeline_deals`), LocalStorage Vault y tracking de lápidas (tombstones).
  - Reglas de seguridad en Cloud Firestore para la colección `cisco_pipeline_deals/{dealId}` implementadas con esquema restrictivo de campos permitidos.

## [v2.7.6] - 2026-10-30
### 🩹 Corregido (Extracción de Rango de Fechas Celda A3 en Fast Track, Persistencia en IndexedDB y Compatibilidad Chrome)
- **Reparación del Parser de Rango de Fechas en Celda A3 (`fastTrackParser.ts`):**
  - Se resolvió la falla crítica por la cual cadenas como `Eligible from Oct 25th 2026- Jan 23rd 2027` se truncaban debido a una clase de caracteres que capturaba letras como separador (la "t" de "Oct"), ignorando la fecha de término (`Jan 23rd 2027`) y cayendo en fallback a `23-01-2026` (marcando erróneamente el catálogo como OBSOLETO).
  - Se introdujo `parseFastTrackDateRange` con reconocimiento determinista de meses en inglés y español, infiriendo saltos de año y extrayendo con precisión `validFrom` (25-10-2026) y `validUntil` (23-01-2027).
- **Persistencia Transaccional en IndexedDB y Compatibilidad con Google Chrome (`fastTrackDb.ts` y `FastTrackAdminModal.tsx`):**
  - `setFastTrackValidUntil` ahora es asíncrono y persiste de inmediato en el almacén `METADATA_STORE_NAME` de IndexedDB con clave `ACTIVE_LOCAL_META_KEY`, además de `localStorage` y memoria, impidiendo que `refreshData()` revierta el cambio.
  - Formato local `YYYY-MM-DD` para `<input type="date">` evitando desfases de huso horario UTC (Chile UTC-3/UTC-4).
  - Compatibilidad nativa con Google Chrome mediante `style={{ colorScheme: 'dark' }}` y clase `[color-scheme:dark]`.
  - Botones de acción rápida `+90d` (extensión de 1 trimestre) y `+30d` (1 mes) para ajustar la vigencia en 1 solo clic con feedback visual instantáneo.

## [v2.7.5] - 2026-10-29
### 🩹 Corregido (Ancho Fijo Estricto en Tabla para Outlook y Extracción de Partner/Cliente por Nombre de Archivo)
- **Eliminación del Desborde Horizontal en la Columna de Descripción:**
  - Se resolvió la causa por la cual la columna *Description* se expandía excesivamente al pegar en Microsoft Outlook: Outlook (motor Word MSO) omite `max-width` en etiquetas `<div>`, estirando las tablas al 100% del monitor y acumulando todo el exceso de ancho en la columna sin ancho fijo.
  - Se blindó la plantilla envolviéndola en una estructura `<table width="730">` con `table-layout: fixed;`, definiendo anchos en píxeles y atributos nativos `width` para cada una de las 7 columnas (`Line`: 36px, `Part Number`: 135px, `Description`: 245px con `word-wrap`, `Lead Time`: 84px, `Qty`: 35px, `Unit Net Price`: 95px, `Extended Net Price`: 100px), bloqueando la tabla a 730px fijos sin importar el tamaño de pantalla del monitor.
- **Extracción Automática de Partner y Cliente Final por Convención de Archivo:**
  - Se implementó `extractPartnerAndClientFromFilename` siguiendo la convención corporativa `[partner]_[clientefinal]_[resto].xlsx`.
  - La primera sección antes del guion bajo (`_`) se asigna al **Partner** y la segunda sección al **Cliente Final**, sustituyendo los códigos de cuentas internas de Cisco CCW (como `besalco!.9` o `Bash`) por los nombres reales de preventa identificados en el archivo.

## [v2.7.4] - 2026-10-29
### 🩹 Corregido (Redacción Dinámica, Condiciones Oficiales y Diseño Compacto en Copiar para Correo Outlook)
- **Saludo Dinámico y Apertura Ejecutiva:**
  - Se actualizó el saludo inicial a `"Estimados,\nBuenos días/tardes, adjunto cotización solicitada."`, evaluando dinámicamente según la hora del sistema (`Buenos días` < 12:00 / `Buenas tardes` >= 12:00).
- **Simplificación de Etiqueta Total:**
  - Se eliminó el contador de unidades `(x unidades)` y la palabra "Net", mostrando limpiamente `"Total Price: $XX.XX USD"`.
- **Condiciones Comerciales Oficiales del Estimate:**
  - Se incorporaron las 3 cláusulas oficiales con formato estilizado en cursiva y texto compacto (8.5pt):
    - **Validez de la Oferta:** *Esta cotización tiene una validez de* **14 días corridos** *(destacado en rojo)* *a contar de su fecha de emisión.*
    - **Plazo de entrega:** *El tiempo final de despacho está determinado por el producto con mayor tiempo de espera (lead time) de la orden.*
    - **Validación Técnica y Responsabilidad:** *La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner.*
- **Diseño Compacto y Cohesivo para Outlook:**
  - Se redujo el ancho máximo del contenedor de 960px a 760px y los paddings de celdas de 7px a 5px, logrando una densidad visual perfecta que no se desborda horizontalmente al pegarse en Outlook.

## [v2.7.3] - 2026-10-28
### 🩹 Corregido (Regla Logística de Bodegas E1/ED en Carga ERP y Formato Oficial Estimate Customizado para Correo)
- **Regla Logística Oficial Intcomex para Bodega en Carga ERP (`erpExportHelper.ts`):**
  - Se corrigió la asignación de bodega en la pestaña *"Carga ERP Intcomex"* del archivo Excel para cumplir la regla operacional:
    - Si la cotización contiene al menos un ítem de Hardware tangible, **TODAS** las líneas (hardware, licencias asociadas y servicios SmartNet) se asignan a Bodega **`E1`** (Bodega Física / Despacho), eliminando la fragmentación con líneas en ED.
    - Si la cotización contiene **EXCLUSIVAMENTE** productos intangibles (solo suscripciones de software/licencias SaaS, solo soporte SmartNet `CON-`/`SVS-`/`CX-`, o ambos sin ningún equipo físico), **TODAS** las líneas se asignan a Bodega **`ED`** (Entrega Digital).
- **Modernización y Depuración de "Copiar para Correo" (`emailClipboardHelper.ts`):**
  - **Eliminación de Etiquetas Internas:** Se eliminaron las etiquetas de clasificación interna como `(Licencia)` y `(Arancel 6%)` de la columna de descripción; las descripciones ahora se copian con la redacción oficial y limpia de Cisco CCW.
  - **Adopción del Formato Oficial Estimate Customizado:** La tabla HTML y texto plano ahora reflejan la estructura corporativa oficial de 7 columnas (`Line`, `Part Number`, `Description`, `Lead Time`, `Qty`, `Unit Net Price`, `Extended Net Price`).
  - **Avisos Oficiales Cisco:** Se integró el banner de aviso oficial Cisco CCW (*"Price Estimate for planning and information purposes only and is not a binding offer from Cisco."*) e indicación de moneda (*"All prices are shown in USD"*).
  - **Eliminación de Condiciones Comerciales Estáticas:** Se removió el cuadro obsoleto de viñetas de 4 puntos (*"Condiciones Comerciales Estándar"*).
  - **Omisión de Firma Personal por Defecto:** Se deshabilitó el anexo forzado de la firma al final del correo copiado, permitiendo que los usuarios de Outlook utilicen fluidamente su firma nativa ya configurada en su cliente de correo sin duplicidades.

## [v2.7.2] - 2026-10-28
### 🩹 Corregido (Compatibilidad Total OpenXML en Generador PowerPoint .pptx para Microsoft Office)
- **Reparación de Esquema y Contenedor OpenXML (.pptx):** Se resolvió de raíz la falla por la cual Microsoft PowerPoint indicaba *"no se puede reproducir / archivo dañado o ilegible" (HRESULT 0x80070570)* al abrir las presentaciones descargadas.
- **Plantilla Certificada Base64 de Alta Fidelidad:** Integración en `src/core/pptxTemplateBase64.ts` del paquete nativo validado de Office con temas (`ppt/theme/theme1.xml`), estilos de tabla (`ppt/tableStyles.xml`), propiedades de presentación (`ppt/presProps.xml`) y relaciones bidireccionales completas (`slideMaster` y `slideLayout`).
- **Normalización de Entidades y Geometrías DrawingML:**
  - Sustitución estricta de la entidad HTML no declarada `&bull;` por la entidad numérica XML estándar `&#8226;` en todas las diapositivas.
  - Corrección de etiquetas de cierre en el árbol de formas de diapositivas 2 y 3.
  - Asignación obligatoria de geometría predefinida (`<a:prstGeom prst="rect">`) en los bloques de texto de cabecera y títulos.
  - Inclusión del mapeo de color maestro obligatorio (`<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>`) en el esquema de cada diapositiva.
- **Validación Automatizada con Microsoft PowerPoint COM:** Verificación rigurosa mediante pruebas automáticas con la instancia nativa instalada de PowerPoint abriendo exitosamente el archivo generado (`SUCCESS: PowerPoint opened file! Slide count: 3`).

## [v2.7.1] - 2026-10-25
### 🩹 Corregido (Blindaje Total de Confidencialidad en Modo Cliente y Ocultamiento de Parámetros CCW)
- **Ocultamiento de Parámetros CCW en Modo Cliente:** En el modo de presentación al cliente (`isClientMode`), el panel lateral izquierdo de parámetros (`ParameterSidebar` con internación, arancel, margen y Goal Seek) se oculta de forma obligatoria y la vista del cotizador se expande a pantalla completa (12 columnas), blindando la privacidad de las fórmulas comerciales frente a clientes finales.
- **Depuración de Controles en Barra Superior:** Se oculta el botón `[ Parámetros ]` y las alertas de auditoría minera/Fast Track en `Navbar.tsx` mientras el Modo Cliente se encuentre activo.
- **Protección en Vista Hoja Excel CCW (`ExcelSheetPreview`):** Se sustituye el selector de versiones que mostraba *"Versión con Margen 5%"* y *"Cisco CCW Original"* por un badge corporativo de *"Propuesta Comercial Oficial (Precios PVP)"*, bloqueando el acceso al costo neto base de Cisco y forzando siempre el despliegue de precios de venta finales.
- **Ocultamiento de Arancel en Tabla Excel:** La etiqueta `ARANCEL 6%` se oculta en la vista previa Excel cuando se activa el Modo Cliente.
- **Barra de Navegación Móvil:** Se protege el indicador de margen en `MobileStickyBar` para no revelar porcentajes de ROS en dispositivos móviles o pantallas reducidas.
- **Certificación de Reglas de Hooks:** Adaptación de las reglas de Hooks en `ParameterSidebar` certificadas al 100% por React Doctor (`✔ No issues found!`).

## [v2.7.0] - 2026-10-25
### 🌟 Agregado (Modo Proyección al Cliente, Generador PowerPoint .pptx, Firmas Outlook, IndexedDB y Sincronización Offline)
- **Modo Proyección / Presentación al Cliente ("Privacy Mode" en 1 Clic):**
  - Botón interactivo `[ 👁️ Modo Cliente ]` en la barra de navegación superior y en configuración para alternar al instante la interfaz para reuniones presenciales o llamadas por Teams/Zoom compartiendo pantalla con el cliente final.
  - Ocultamiento estricto de columnas de costos de compra (`Net Cisco U`, `Internación`, `Arancel` y `Costo Total U`), así como de los porcentajes de margen interno en toda la tabla interactiva y en las tarjetas KPI resumen.
  - Despliegue de un banner informativo amigable en la tabla confirmando la protección activa de márgenes de distribución.
- **Generador de Presentación Diapositiva PowerPoint Nativo (.pptx):**
  - Botón `[📊 PPTX Slide]` en el modal de descarga (`DownloadModal`) que genera y descarga al instante una presentación editable en PowerPoint (.pptx) en formato 16:9 widescreen estándar OpenXML mediante `JSZip` sin requerir dependencias pesadas.
  - Incluye: Diapositiva de Portada Corporativa Intcomex Cisco con datos del Deal y cliente, Diapositiva de Desglose en 3 Pilares Tecnológicos (Hardware, Software Cloud, Soporte SmartNet) con porcentajes y montos, y Diapositiva con Matriz Detallada de Equipos.
- **Gestor de Firmas y Plantillas de Correo para Outlook:**
  - Nuevo módulo interactivo `EmailSignatureSettingsModal` accesible desde la configuración y directamente desde el modal de descarga mediante el enlace `[⚙️ Configurar Firma Outlook]`.
  - Permite configurar nombre del Product Manager / Preventa, cargo, teléfono, anexo, email corporativo, unidad de negocios y condiciones comerciales personalizadas (validez de oferta, tipo de cambio, condiciones de pago, tiempo de entrega).
  - Integración dinámica con el copiado rápido al portapapeles en HTML enriquecido y texto plano para Outlook y correo corporativo.
- **Migración de Almacenamiento Local de localStorage a IndexedDB (`CiscoAutomatedDB`):**
  - Módulo `indexedDbStorage` con base de datos IndexedDB estructurada en object stores (`keyval`, `estimates`, `row_notes`, `offline_queue`), superando el límite de 5 MB de localStorage.
  - Soporte asíncrono robusto con fallback automático a `localStorage` y memoria interna (`inMemoryFallback`) garantizando compatibilidad total en entornos de pruebas Node.js y navegadores antiguos.
  - Migración de las notas internas colaborativas por fila (`rowNotes`) hacia almacenamiento persistente en IndexedDB.
- **Cola de Sincronización Silenciosa Offline para Firestore (`offlineSyncQueue`):**
  - Sistema de resguardo resiliente que detecta pérdida de conexión a internet o fallos transitorios en Firebase Firestore al guardar cotizaciones.
  - Encola automáticamente las peticiones de guardado con reintentos programados y vaciado automático de la cola en segundo plano apenas el navegador detecta el evento `window.ononline`.

## [v2.6.2] - 2026-10-25
### 🗑️ Eliminado (Remoción de Atajos de Teclado y Paleta Spotlight a Petición de Usuario)
- **Eliminación de Atajos Globales y de Tabla:** Remoción completa de los atajos de teclado globales (`Ctrl+K`, `Ctrl+U`, `Ctrl+D`), atajos de reasignación en tabla (`H`, `I`, `A`, `?`, `↑ / ↓`) y depuración de componentes modales asociados (`CommandPaletteModal` y `KeyboardShortcutsModal`).
- **Preservación Integral:** Se mantienen al 100% los guardarraíles financieros con piso del 4.0%, el auditor predictivo de BOM Cisco, el extractor rápido Quick Ingest, las notas PM por fila, la plantilla de carga ERP Intcomex, la lámina ejecutiva slide y el motor completo de cálculo.

## [v2.6.1] - 2026-10-25
### 🩹 Corregido (Reparación de Reglas de Hooks de React - Error #310)
- **Blindaje de Hooks Globales en `App.tsx`:** Reubicación de la escucha de atajos de teclado globales (`useEffect` para `Ctrl+K`, `Ctrl+U`, `Ctrl+D`) al nivel superior del componente antes de la condición de renderizado de la pantalla de login (`if (!currentUser)`). Esto elimina de forma definitiva el error crítico de React #310 (*"Rendered more hooks than during the previous render"*), garantizando un número y orden idéntico de hooks en todos los ciclos de renderizado.
- **Validación Automática React Doctor:** Certificación de código con puntuación 87/100 y 0 diagnósticos de regresión.

## [v2.6.0] - 2026-10-25
### 🌟 Agregado (Guardarraíles Financieros 4%, Auditoría Preventiva de BOM, Ingesta Rápida y Productividad PM)
- **Guardarraíles de Seguridad Financiera (Piso Mínimo 4.0%):** Protección comercial automática para impedir ventas por debajo de margen. Si el margen comercial o la internación de hardware tangible es inferior al 4.0% mínimo, la aplicación despliega alertas visuales en la barra de parámetros (`ParameterSidebar`) y exige confirmación obligatoria con checkbox de autorización de jefatura antes de permitir la descarga o exportación (`DownloadModal`).
- **Auditor Predictivo de Listas de Materiales Cisco (`validateCiscoBom`):** Escáner heurístico preventivo integrado en la tabla que analiza el BOM y detecta automáticamente:
  - Switches Catalyst serie 9000 sin licencias de suscripción Cisco DNA requeridas.
  - Chasis o fuentes de poder sin cable de corriente chileno estándar (`CAB-ETH-CHL`).
  - Dispositivos Meraki sin licencias de gestión cloud obligatorias (`LIC-`).
  - Equipos de alto valor sin contratos de soporte SmartNet (`CON-SNT/SNTC`).
  - Modal interactivo (`BomValidatorModal`) con detalle de números de parte afectados y acciones recomendadas.
- **Extractor Rápido desde Portapapeles y Texto Plano (`QuickBomIngestModal`):** Permite pegar texto sin formato desde correos o chats para parsear automáticamente Part Numbers, cantidades y precios, calculando totales al vuelo y permitiendo simularlos en 1 clic.
- **Paleta Global de Comandos Spotlight (`CommandPaletteModal` - Ctrl+K / ⌘+K):** Acceso rápido para ejecutar cualquier acción del sistema (subir archivo, descargar, DSV, conmutar vistas, estudio custom, reglas) y navegar entre vistas sin levantar las manos del teclado.
- **Atajos de Teclado Profesionales y Guía Interactiva (`KeyboardShortcutsModal`):** Navegación ágil en la tabla con `↑ / ↓`, atajos instantáneos `H` (Hardware), `I` (Intangible), `A` (Arancel `=`), `Ctrl+U`, `Ctrl+D` y apertura de la chuleta de atajos con la tecla `?`.
- **Notas y Comentarios Internos Colaborativos por Fila ("PM Sticky Notes"):** Icono `💬` en cada ítem de la tabla interactiva para adjuntar observaciones de preventa o acuerdos de descuento con Cisco, con resguardo en memoria local y sin contaminar los artefactos finales del cliente.
- **Exportador Oficial de Plantilla de Carga Masiva para ERP Intcomex (`erpExportHelper`):** Botón `[📦 Plantilla ERP]` en el modal de descarga que genera un libro Excel estandarizado con códigos de bodega (`E1` vs `ED`), precios unitarios y extendidos netos en USD, clasificaciones contables y datos del Deal.
- **Lámina de Presentación Comercial Ejecutiva (`ExecutiveSlideModal`):** Generador 1-clic de diapositiva de alta resolución con membrete oficial Intcomex, desglose en 3 pilares (Infraestructura, Software Cloud y Soporte SmartNet), porcentajes del deal y plazos de entrega.

## [v2.5.0] - 2026-10-25
### 🌟 Agregado (Arquitectura Dual de Experiencia: Vista Clásica vs Vista Aesthetic + Estudio Custom en Caliente)
- **Sistema Dual de Vistas Conmutable en 1 Clic:** Interruptor interactivo en la barra de navegación superior y en Configuración (`[ 🏛️ Vista Clásica | ✨ Vista Aesthetic ]`) que permite alternar instantáneamente entre la experiencia corporativa tradicional y la nueva experiencia visual de última generación sin tocar ningún cálculo matemático o dato de cotización.
- **Barra de Navegación en Isla Flotante (`Floating Island Navbar`):** Encabezado desacoplado de bordes con esquinas redondeadas (`rounded-2xl`), efecto acrílico `backdrop-blur-xl`, borde sutil y sombreado tridimensional.
- **Malla Dinámica de Luz Ambiental (`AmbientMeshGlow`):** Esferas de luz desenfocada (`blur-[100px]`) que respiran suavemente en el fondo de la pantalla al compás de la paleta activa en modo Aesthetic.
- **Tarjetas KPI Ejecutivas con Cristal Acrílico (`aesthetic-card`):** Elevación suave hover (`-translate-y-0.5`), halo luminoso de acento y tipografía tabular monospace de alta fidelidad FinTech.
- **Micro-LEDs Pulsantes en Badges de Clasificación:** Puntos de luz LED animados en tiempo real: Verde (Hardware), Ámbar (Intangibles / Licencias) y Púrpura (Arancel aduanero `=`).
- **Efecto Spotlight en Filas de Tabla (`table-row-spotlight`):** Resaltado perimetral inteligente en cada fila de la tabla interactiva al posar el cursor para no perder el foco de lectura en cotizaciones complejas.
- **Tacómetro / Indicador de Margen Visual Dinámico:** Visualizador de margen comercial en el simulador (`QuickCalculator`) con barra degradada tricolor y porcentaje en tiempo real.
- **Zona de Dropzone con Levitación Tridimensional:** En la vista de carga de archivos (`UploadView`), el icono levita suavemente con sombra proyectada al pasar el cursor y el borde perimetral pulsa interactivamente.
- **Estudio de Personalización "Custom en Caliente" (`LiveStudioModal`):**
  - Botón directo `[ 🎨 Custom en Caliente ]` en la barra superior al activar la vista Aesthetic.
  - Paleta interactiva con color pickers en vivo para acento primario, secundario, fondo principal y paneles.
  - 6 Presets instantáneos de 1 clic: *Cisco Executive, Cyberpunk Neon, Emerald FinTech, Sunset Amber, Nordic Frost, Stealth Titanium*.
  - Sliders en vivo de desenfoque acrílico (`0px` a `24px`) y opacidad de paneles (`10%` a `95%`).
  - Selectores de radio de esquinas (`sharp`, `modern`, `curved`, `pill`) y densidad de tabla (`compact`, `comfortable`, `spacious`).
  - Toggles para luz ambiental, resplandor de tarjetas y modo Zen.
  - Botón de 1 clic para restablecer la configuración base recomendada.
- **Persistencia Reactiva en LocalStorage:** El modo de vista (`cisco_ui_experience_mode`) y la configuración del estudio (`cisco_live_studio_config`) se preservan de forma segura en el navegador y se reflejan al instante en el DOM sin recargar la página.

## [v2.4.7] - 2026-10-25
### 🎨 Experiencia de Login y Optimización de Branding
- **Logos Animados Estacionales de Alto Rendimiento:** Integración de logos animados ultralivianos en formato GIF optimizado (Halloween animado activo, y conmutación programada al logo de Navidad con nieve a partir del 1 de diciembre de 2026), reduciendo drásticamente el peso de carga sin ralentizar la aplicación.
- **Simplificación y Discreción en Pantalla de Login:** Eliminada la leyenda redundante "Autenticación Cifrada • Bloqueo al 3er Intento" para mantener discreción en la seguridad y evitar pistas innecesarias.
- **Consolidación de Mensajes de Error en Login:** Corregida la duplicidad en los avisos de error al fallar credenciales, mostrando un único mensaje claro y elegante.

### 🔒 Seguridad y Privacidad (Sanitización Total de Secretos y Datos de Usuarios)
- **Erradicación de Credenciales Hardcodeadas en Git:** Eliminadas todas las credenciales de Cisco Developer API (Client ID y Client Secret) de scripts/checkCiscoEntitlements.mjs, ciscoAuthService.ts, cisco-proxy.ts y del bundle generado, quedando 100% aisladas en variables de entorno privadas en la nube.
- **Protección de Cloudflare Turnstile Secret Key:** Eliminadas las claves secretas hardcodeadas en erify.js, erify.ts y erify-turnstile.ts, haciendo que la validación de seguridad dependa estrictamente del secreto de entorno TURNSTILE_SECRET_KEY en Cloudflare Pages.
- **Anonimización de Cuentas y Erradicación de Backdoors:** Eliminados del repositorio todos los nombres reales, correos corporativos y contraseñas por defecto en texto plano (schema.sql, db_manager.py, irestoreService.ts, LoginScreen.tsx y gui_app.py), reemplazándolos por cuentas administrativas genéricas y verificación criptográfica estricta sin contraseñas maestras maestras en el código.

### 🐛 Corregido (Eliminación de Resumen Ejecutivo, Jerarquía de Líneas Madre y Blindaje de Filas de Meses/Initial Term)
- **Blindaje y Preservación de Filas de Suscripción / Initial Term (Líneas de Meses):** Verificado y blindado el tratamiento de las filas informativas de suscripción (Initial Term - XX.00 Months | Auto Renewal Term...) que no poseen número de línea en el Excel original de Cisco CCW. Se garantiza que:
  1. Mantengan lineNumber: '' (celda Columna A vacía) y isInfoRow: true, sin consumir ni alterar la secuencia de números de producto (.1, .2...).
  2. El extractor de plazos herede de manera exacta la duración en meses (detectedDurationMonths: 12, 36, 60...) hacia las licencias de suscripción y servicios del grupo.
  3. En la exportación a Excel, se rendericen con la Columna A vacía y las Columnas B a G fusionadas con formato cursiva gris, sin ensuciar cantidades ni subtotales matemáticos.
- **Eliminación Temporal del Resumen Ejecutivo en Excel, PDF, Correo y Modal:** Retirado temporalmente el bloque de "Resumen Ejecutivo de la Solución" en todos los artefactos de salida (libro Excel, propuesta comercial PDF, borrador de correo para Outlook y previsualización modal) a la espera de auditar la estructura y criterio comercial exacto de Cisco para la totalización de servicios y licencias.
- **Corrección de Jerarquía de Sub-líneas Hijas (Eliminación de Líneas Fantasma 2.0, 3.0, 4.0):** Corregido el motor de extracción y asignación jerárquica para que todo ítem hijo, accesorio o servicio sin número de línea explícito en el CCW original herede estrictamente la clave y numeración jerárquica de su Línea Madre activa (`1.0.1`, `1.1`, `1.2`...) en lugar de ser promovido erróneamente a nuevas Líneas Madre (`2.0, 3.0, 4.0`).
- **Preservación Fiel del Estimate Original:** Garantizada la correspondencia 1:1 con la estructura oficial del BOM de Cisco CCW tanto en modo Continuo Estándar como en Agrupado por Línea Madre.

---

## [v2.4.6] - 2026-10-24
### 🌟 Agregado (Separación por Líneas Madre en Excel, PDF Comercial, Correo Outlook y Resumen Ejecutivo)
- **Exportación en Excel con Separación por Líneas Madre y Subtotales:** Opción en el modal de descarga para estructurar la cotización en bloques ordenados por cada Línea Madre (`1.0`, `2.0`, etc.) con subtotales individuales de cantidad y precio de venta mediante fórmulas nativas de Excel `=SUM(...)`, consolidando la suma en la fila final de Price Total para deals separados por OC.
- **Selector de Formato de Excel:** Alternancia en 1 clic entre `[📋 Continuo Estándar]` (formato CCW original) y `[📑 Agrupado por Líneas]` con selector de filtro para exportar todas las líneas o aislar una línea específica si el cliente formaliza solo una OC.
- **Tarjeta de Resumen Ejecutivo en Excel (Idea 1):** Inclusión opcional de un bloque resumen al pie de la cotización que categoriza el valor total en Equipamiento Hardware, Licenciamiento / Software Cloud y Servicios de Soporte SmartNet, incorporando encabezado explícito "Qty" sobre la columna de cantidades y total neto USD, sumando únicamente las unidades de ítems con valor económico real (> $0) y omitiendo componentes accesorios de valor cero ($0).
- **Motor Canónico de Clasificación de Naturaleza Cisco (`isCiscoServiceItem`):** Separación algorítmica estricta de máxima prioridad entre Servicios SmartNet (contratos `CON-*`, `SVS-*`, `CX-*`, `CXS-*`, `CSS-*`, `SAS-*`, `SWSS`, `sntc`, `8x5xnbd`, `24x7x4`, soporte técnico) y Licenciamiento/Software Cloud (DNA, Meraki LIC, Umbrella, Network Stacks, Duo, Cisco ONE, SaaS), asegurando sumas y clasificaciones 100% certeras sin solapamientos en todas las cotizaciones.
- **Repetición Simétrica de Encabezados a partir de Línea 2.0 y Plazo en Semanas:** Repetición exacta de los 7 encabezados oficiales (`Line Number | Part Number | Description | Estimated Lead Time (Weeks) | Qty | Unit Net Price | Extended Net Price`), actualizando la unidad a semanas en inglés ("Estimated Lead Time (Weeks)") para reflejar fielmente los plazos de entrega cotizados.
- **Exportación en PDF Comercial (Idea 2):** Generación instantánea de propuesta comercial en PDF lista para el cliente, con membrete oficial de Intcomex en alta definición, tabla completa de productos, desglose por líneas madre y las tres cláusulas legales vigentes.
- **Redacción de Correo al Partner en Outlook (Idea 3):** Botón `[✉️ Redactar Correo (Outlook)]` que genera un correo profesional con saludo `"Estimados,"`, datos de Deal/Estimate, resumen comercial de la solución, y copia al portapapeles la versión en HTML enriquecido con tablas estilizadas para pegado nativo en Outlook.
- **Valor Referencial Opcional en Pesos Chilenos - CLP (Idea 4):** Switch con input editable de Tipo de Cambio Observado (ej. `$950 CLP/USD`) para calcular e inyectar el total referencial en moneda local en Excel, PDF, correo Outlook y modal.
- **Previsualización Rápida en el Modal (Idea 5):** Panel interactivo desplegable que muestra el conteo de ítems, totales por categoría (HW vs SW), desglose por línea madre, tasas efectivas (`_I...M..._`) y montos antes de la descarga.
- **Blindaje Anti-Contaminación y Shadow Ledger:** La hoja oculta `sys_metadata` preserva el historial de cálculo intacto y las funciones de lectura reconocen los subtotales para evitar duplicaciones en caso de re-importación.

---

## [v2.4.5] - 2026-10-24
### 🌟 Agregado (Encabezados Repetidos en Línea 2.0+, Saludo Plural y Gestión de OC Partner en BO)
- **Encabezado Repetido de Columnas en Bloques Posteriores:** Inyección de la fila de cabecera idéntica a Línea 1.0 (`SKU | Part Number | Bodega | Qty | Unit Net Price | Extended Net Price | Quitar`) a partir de la Línea 2.0 en la interfaz modal y en la exportación HTML/Outlook para mantener perfecta alineación visual al revisar listas extensas.
- **Saludo Formal a Compras en Plural ("Estimados,"):** Corrección del encabezado de correspondencia a `"Estimados,"` tanto en las tablas HTML copiadas al portapapeles como en la versión de texto plano y en la plantilla del cliente de correo Outlook.
- **Campo Dedicado "OC Partner" por Línea Madre:** Entrada de texto individual en la cabecera de cada bloque para ingresar la Orden de Compra del cliente asociada a cada línea (`OC Partner: [____]`). Al copiar o enviar, el número de OC se incorpora automáticamente en el asunto, cuerpo y registro de auditoría de Compras.
- **Badges Inteligentes de Tipificación:** Reconocimiento dinámico de la naturaleza del lote por línea madre desplegando distintivos visuales de alto contraste: `[🔧 Hardware (E1)]`, `[☁️ Licencias / SaaS (ED)]` o `[📦 Mixto HW + SW]`.
- **Alerta Preventiva y Asistente de SKUs:** Contador reactivo `⚠️ X ítems sin SKU` con botón `[Rellenar N/A]` para asistir al ejecutivo antes de remitir la solicitud y evitar rechazos operativos por parte del equipo de Compras.

---

## [v2.4.4] - 2026-10-23
### 🌟 Agregado (Separación por Líneas y Subtotales por OC en Módulo BO)
- **Modalidad Dual de Visualización:** Switch interactivo en `BoRequestModal` entre `[📋 Vista Unificada]` (tabla estándar) y `[📑 Separar por Líneas (Subtotales por OC)]`.
- **Agrupación Automática por Línea Madre:** Agrupación visual e interactiva por cada línea principal de la cotización (`1.0`, `2.0`, etc.) calculando subtotales dedicados de cantidad y precio de venta extendido ($ USD), culminando en el Total General consolidado.
- **Pestañas de Filtrado Selectivo:** Barra de filtros interactiva con botones estilo píldora (`[Todas las Líneas]`, `[Línea 1.0 (OC #1)]`, `[Línea 2.0 (OC #2)]`...) para visualizar y procesar compras de manera aislada cuando los Partners dividen un deal en órdenes de compra separadas.
- **Botón de Copiado Rápido por Línea:** Acceso directo `[Copiar Línea {motherKey}]` en la cabecera de cada bloque para copiar al portapapeles en formato HTML enriquecido solo los ítems y subtotal de la línea seleccionada.
- **Compatibilidad Total de Portapapeles (Outlook):** Funciones `generateBoHtmlTable` y `generateBoPlainTextTable` ampliadas con soporte de opciones de agrupación (`groupByLine`) y filtro de línea (`selectedLine`) para correos electrónicos con subtotales estructurados o cotizaciones parciales.
- **Preservación Rigurosa de Reglas del Módulo BO:** Mantiene intacto el sufijo `-CBN` en part numbers editables, el autocompletado y sincronización de SKUs desde el catálogo Firestore/localStorage, la separación inteligente de bodegas E1/ED y la gaveta lateral de ítems descartados con costo $0 USD.

---

## [v2.4.3] - 2026-10-23
### 🐛 Reparado (Nomenclatura Dinámica en Descarga con Parámetros Custom)
- **Corrección de Tag Comercial en Nombre de Archivo (`_I{int}M{margen}_`):** Al descargar una cotización con parámetros personalizados por línea (`custom_lines` o `lineCustomParams`), el generador corporativo de nombres de archivo calcula y estampa exactamente las tasas efectivas aplicadas (ej. `_I23M6_`) en lugar de recaer en los valores por defecto CCW (`_I7M5_`).
- **Cálculo Económico Ponderado (`resolveEffectiveQuoteRates`):** Resolución de internación efectiva ponderada sobre el hardware tangible real cotizado y consolidación de margen comercial general para la cotización `(Total Venta - Total Costo) / Total Venta * 100`.
- **Sincronización Reactiva en `DownloadModal`:** Actualización en vivo del nombre sugerido de archivo al alternar entre modo Estándar y Por Línea, o al modificar las tasas de bloques madre en la barra lateral.
- **Protección para Licencias Puras:** Mantiene la etiqueta disimulada `_M{margen}_` (omitiendo la `I`) cuando la cotización consta exclusivamente de licencias o SaaS, reflejando el margen personalizado correspondiente.

---

## [v2.4.2] - 2026-10-23
### 🌟 Agregado (Cláusula de Validación Técnica y Armonización Legal)
- **Cláusula Formal de Validación Técnica y Responsabilidad:** Incorporación obligatoria de la nota legal y técnica al pie de página de la cotización comercial Excel (debajo del Plazo de entrega): *"Validación Técnica y Responsabilidad: La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner."*
- **Armonización Estética de Notas al Pie (3 Cláusulas):** Estandarización de las 3 notas inferiores (*Validez de la Oferta*, *Plazo de Entrega* y *Validación Técnica y Responsabilidad*) con tipografía Arial 7.5pt, cursiva atenuada en color Slate (`#64748B`), encabezados en negrita (`#334155`) y destacado sutil de los 14 días corridos.
- **Formato Excel Profesional:** Celda fusionada de ancho completo (columnas A a G), altura de fila ajustada a 30pt y activación de `wrapText: true` para que todo el párrafo sea legible en cualquier versión de Excel sin cortes.
- **Previsualización Web Idéntica (`ExcelSheetPreview`):** Reflejo visual 1:1 de las tres cláusulas en la vista previa del navegador y protección anti-contaminación en el parser CCW (`isFooterOrNoteRow`) para re-importaciones de archivos exportados.

---

## [v2.4.1] - 2026-10-23
### 🐛 Reparado (Bug Fixes & Estabilidad)
- **Restauración Inmediata de Parámetros Previos en Carga de Archivos:** Se solucionó la discrepancia donde una cotización con parámetros personalizados (ej. 23% Internación, 6% Margen, 6% Arancel) cargaba inicialmente con los valores por defecto (7% / 5%) y solo se corregía al mover un slider. Ahora el motor aplica inmediatamente los parámetros guardados en `sys_metadata` desde el primer milisegundo.
- **Sincronización Total de Estado y UI:** Los sliders de la barra lateral, el modo de cálculo (`[Estándar CCW]` o `[Por Línea]`) y la tabla de cotización se configuran de forma reactiva instantánea al abrir el archivo.
- **Integridad y Persistencia de Arancel Aduanero:** Se incluyó formalmente el campo `naranja` (Arancel) en la extracción y restauración de auditoría previa (`previousArancelPct`), garantizando que aranceles modificados no se pierdan.
- **Ampliación de Modal de Auditoría Previa (`PriorAuditDetectedModal`):** Despliegue explícito de las tres métricas base (*Internación Base*, *Arancel Base* y *Margen Base*) con badges diferenciados por color en el modal persuasivo.

---

## [v2.4.0] - 2026-10-23
### 🌟 Agregado (Parámetros CCW Custom por Línea)
- **Segmented Control de Modo de Costeo:** Switch en `ParameterSidebar` para alternar entre `[Estándar CCW]` (tasas globales para toda la cotización) y `[Por Línea]` (tasas personalizadas por bloque madre).
- **Control Granular por Bloque Madre ($N.0$):** Sliders y campos numéricos individuales para definir tasas específicas de Internación (0% - 30%), Arancel (0% - 15%) y Margen Comercial (0% - 50%) por cada bloque madre.
- **Herencia Jerárquica Automática a Sub-líneas ($N.x$):** Las sub-líneas secundarias heredan de inmediato los parámetros configurados en su línea madre respetando las excepciones de intangibles (0% int/ar).
- **Indicadores Visuales en Tabla y Tarjetas Móviles:** Badges violetas `Línea N.0 Custom` y `↳ Hereda de N.0` en `InteractiveTable` y `MobileEstimateCardList`.
- **Menú Contextual "Configurar Parámetros de Línea":** Acceso directo desde el clic derecho en cualquier fila de la tabla para ajustar parámetros del bloque madre correspondiente.
- **Persistencia en Metadatos Sombra:** Almacenamiento seguro del mapa de parámetros por línea en la hoja ultra-oculta `sys_metadata` (`lineasCustom` y `modo`).

---

## [v2.3.0] - 2026-10-22
### 📱 Agregado (Versión Móvil PWA & Modo Pocket)
- **Barra Inferior de Navegación Móvil (`MobileBottomNav`):** Barra fija en la parte inferior para pantallas `< 768px`, optimizada ergonómicamente para pulgares con accesos a *Cotizar*, *ConfigurIAtor*, *Tracking BO*, *Métricas* y *Menú*.
- **Cajón de Menú Móvil Deslizable (`MobileMenuDrawer`):** Drawer táctil tipo bottom sheet para acceso rápido a subida de archivos, generación DSV, Fast Track, reglas CCW, soporte IA y configuración del sistema.
- **Vista Táctil de Tarjetas para Cotizaciones (`MobileEstimateCardList`):** Sustitución automática de la tabla ancha de 12 columnas por tarjetas táctiles condensadas en smartphones, con desglose de cantidades, PV unitario, PV extendido y badges de reglas.
- **Drawer Táctil de Detalle de Ítems:** Modal deslizable para inspeccionar costos detallados (Net Cisco, Internación, Arancel, Costo Total) y reasignar reglas comerciales (`Hardware` / `Licencia` / `Arancel`) en un solo toque.
- **Barra Rápida de Acciones Móviles (`MobileStickyBar`):** Cabecera sticky en el cotizador con totales en USD/CLP, margen estimado y botones rápidos de acción.
- **Compartir Cotizaciones en 1 Clic (`mobileShareHelper`):** Integración con la Web Share API nativa para compartir el resumen comercial directamente a **WhatsApp**, **Telegram** o correo del teléfono.
- **Soporte PWA (Progressive Web App):** Creación de `manifest.json`, iconos vectoriales (`icon-192.svg`, `icon-512.svg`) y meta tags con `viewport-fit=cover` para instalación en pantalla de inicio de Android y iOS.
- **Aislamiento de Escritorio:** Protección total de la versión de escritorio ($\ge 768\text{ px}$) y la App Desktop `.exe`, las cuales conservan intacta la experiencia corporativa original.

---

## [v2.2.5] - 2026-10-22
### 🌟 Agregado
- **Documentación Completa en GitHub (`README.md`):** Actualización integral de la portada del repositorio con los 11 módulos del ecosistema, arquitectura híbrida (Web Standalone + Desktop Portable), persistencia en las 11 colecciones de Google Cloud Firestore y guía de despliegue.
- **Historial Completo de Versiones (`CHANGELOG.md`):** Estandarización del registro de cambios siguiendo el formato internacional SemVer y Keep a Changelog.
- **Git Tags Oficiales:** Etiquetado de todas las versiones publicadas en el repositorio de GitHub para consulta en la pestaña *Releases / Tags*.

### 🎨 UI / UX
- **Alineación Ergonómica de Acciones Principales:** Reubicación de los botones *Subir Excel*, *Generar DSV* y *Descargar Excel* hacia el extremo izquierdo superior para un flujo de trabajo más natural y accesible.
- **Limpieza Minimalista:** Eliminación del logo secundario redundante de Intcomex Cisco Partner para despejar el encabezado de cotización.

---

## [v2.2.4] - 2026-10-22
### 🎨 UI / UX
- **Minimalismo en Barra de Navegación (Navbar):** Eliminación de botones redundantes de soporte y accesos dispersos en la barra superior.
- **Submenú Unificado "Configuración del Sistema" en Sidebar:** Consolidación de 5 áreas administrativas clave en una única ubicación accesible desde la barra lateral izquierda:
  1. *Reglas y Metodología CCW* (Fórmulas comerciales, Lead Time Miami, Aranceles).
  2. *Base de Partners XCL* (Códigos Intcomex y mapeo de resellers).
  3. *Reglas de SKUs* (Reclasificación comercial y reglas compartidas).
  4. *Catálogo Fast Track* (Promociones y auditoría de descuentos).
  5. *Mejoras & Soporte IA* (Bandeja de tickets y asistencia técnica con SLA).

---

## [v2.2.3] - 2026-10-22
### ⚡ Optimizado (Performance)
- **Descarga Instantánea de Cotizaciones Excel (<500ms):** Aceleración radical del proceso de descarga tras aplicar Goal Seek o modificaciones en la cotización, reduciendo los tiempos de espera de ~5-7 segundos a una respuesta inmediata.
- **Desacoplamiento Asíncrono de Guardado:** La sincronización con Google Cloud Firestore y la persistencia en caché local se desacoplaron del hilo principal mediante procesos en segundo plano no bloqueantes.

---

## [v2.2.2] - 2026-10-22
### 🛡️ Corregido (Bug Fixes)
- **Supresión Estricta de Hardware en Licenciamiento:** Corrección en el motor heurístico y los prompts de IA de **ConfigurIAtor** para evitar que se inyecten switches físicos (Catalyst / Meraki) o equipos de red cuando la solicitud del usuario es estrictamente de software o suscripciones.
- **Filtro Post-Procesamiento de Seguridad:** Verificación determinista que purga automáticamente hardware residual de las cotizaciones cuando la intención del usuario fue clasificada como 100% intangible.

---

## [v2.2.1] - 2026-10-22
### 🌟 Agregado
- **Cotización de Licencias Puras en ConfigurIAtor:**
  - Soporte nativo para suites de colaboración Webex Calling, Webex Meetings y paquetes Flex (`A-FLEX-*`, `A-SPK-*`).
  - Cisco Enterprise Agreement (EA) en Networking, Seguridad y Data Center.
  - Renovaciones de contratos de servicio SmartNet / SNTC (`CON-SNT-*`, `CON-SNTP-*`).
  - Soluciones de Ciberseguridad Cloud SaaS (Cisco Umbrella, Secure Endpoint / AMP, Duo Security).
  - Terminales de telefonía IP (`CP-88xx`, `CP-78xx`) y salas de videoconferencia Webex Room Bar (`CS-BAR-*`).

---

## [v2.2.0] - 2026-10-22
### 🔄 Agregado (Arquitectura Enterprise)
- **Sincronización Dinámica de Versiones (SemVer):**
  - Implementación de `src/core/appVersion.ts` como única fuente de verdad transversal para Web, Desktop y Cloud.
  - Scripts automáticos de SemVer en `scripts/version_manager.js` (`npm run version:bump:patch`, `npm run version:bump:minor`, `npm run version:bump:major`).
  - Eliminación de versiones estáticas hardcodeadas en todos los componentes del sistema.
  - Extracción automática de metadatos de Git (`scripts/generate_build_info.js`) inyectando commit corto, fecha ISO y notas de release en `version.json`.

---

## [v2.1.0] - 2026-10-22
### 🌟 Agregado
- **Módulo de Soporte Técnico, Reporte de Errores y Mejoras con Triaje IA:**
  - Bandeja centralizada de tickets en Firestore (`app_feedback_tickets`).
  - Asesor de Inteligencia Artificial (`aiFeedbackAdvisor.ts`) con cascada multi-modelo (Google Gemini 3.6 Flash, OpenRouter y heurístico offline).
  - Diagnóstico estructurado: Viabilidad técnica (`YES`/`CONDITIONAL`/`NO`), Causa Raíz, Solución Técnica Paso a Paso y Estimación de Esfuerzo.
  - Matriz de SLA dinámico con semáforo en tiempo real (`CRITICAL`: 4h, `HIGH`: 24h, `MEDIUM`: 72h, `LOW`: 120h).
  - Captura técnica automática (commit Git, versión, resolución, vista activa) y adjuntos de capturas con pegado `Ctrl + V`.
- **Reglas Cloud Firestore Col 11:** Despliegue de seguridad para la colección `app_feedback_tickets`.

---

## [v2.0.8] - 2026-10-22
### 🚀 Agregado
- **Auto-Actualizador Desktop de 1-Clic en Caliente:** Motor de actualización directa para la aplicación Windows sin necesidad de reinstalar ejecutables ni usar instaladores externos.
- **Distribución CDN Global:** Despliegue automático de bundles portables en Cloudflare Pages (`desktop_build.html` y `version.json`).

---

## [v2.0.7] - 2026-10-21
### 🌟 Agregado
- **Multi-Versionamiento Comercial de Cotizaciones:**
  - Persistencia de revisiones en subcolecciones de Firestore (`estimates/{id}/versions/{vId}`).
  - Versión base original `v0_RAW` inmutable para auditoría permanente y protección contra manipulaciones.
  - Modal comparador de versiones lado a lado con variaciones de margen y precios línea por línea.

---

## [v2.0.6] - 2026-10-20
### 🛡️ Seguridad & Persistencia
- **Arquitectura Database Armor:**
  - Bóveda de persistencia de triple capa: LocalStorage Vault + IndexedDB `CiscoAppCollectionsDB` + Tombstones de borrado.
  - Respaldo de contingencia y recuperación automática ante fallas de red o indisponibilidad de la nube.

---

## [v2.0.5] - 2026-10-19
### 💵 Finanzas & Moneda
- **Indicadores Oficiales del Banco Central de Chile:**
  - Consulta en vivo de valores observados de USD y UF.
  - Incorporación de spread comercial preventivo de **+$10 CLP** sobre el dólar interbancario para cotizaciones en moneda nacional.

---

## [v2.0.4] - 2026-10-18
### 📦 Logística & Importación
- **Regla Estricta de Lead Time Miami:**
  - Fijación obligatoria de 175 días corridos (27 semanas de entrega).
  - Mecanismo anti-degradación idempotente y persistencia en metadatos sombra (`sys_metadata`) de Excel.

---

## [v2.0.3] - 2026-10-17
### 📐 Cálculos Comerciales
- **Arancel Aduanero en Accesorios de Línea Madre:**
  - Clasificación automática y aplicación de Arancel Aduanero (6.0%) a Cámaras Meraki (`MV*`), Sensores (`MT*`), Teléfonos IP (`CP-*/DP-*`) y terminales Webex Room Bar (`CS-*`).

---

## [v2.0.2] - 2026-10-16
### 🤖 Inteligencia Artificial
- **Motor Multi-Proveedor en ConfigurIAtor:**
  - Cascada de IA con Google Gemini 3.6 Flash primario y OpenRouter secundario.
  - Fallback determinista offline con plantillas de oro (*Golden Templates*) para operación sin conexión.

---

## [v2.0.1] - 2026-10-15
### ☁️ Cloud & Catálogo
- **Sincronización en la Nube de Fast Track:**
  - Almacenamiento distribuido del catálogo de promociones por bloques (chunks) en `cisco_fast_track_catalog`.
  - Detección automática de duplicados y purga de catálogo anterior.

---

## [v2.0.0] - 2026-10-12
### 🚀 Lanzamiento Inicial (Arquitectura Base)
- **Cotizador Comercial CCW:** Motor de importación y costeo de cotizaciones Cisco Commerce Workspace con solver de margen objetivo (Goal Seek).
- **Generador Oficial Cisco DSV:** Exportación en la plantilla oficial de 48 columnas, formato tipográfico Calibri 11, sanitización `.trim()` y descarte de ítems sin precio de lista.
- **Auditor Fast Track en IndexedDB:** Microservicio en frontend que cruza SKUs automáticamente contra ofertas promocionales.
- **Desktop Portable:** Empaquetado Windows con SQLite local integrado para uso 100% offline.
