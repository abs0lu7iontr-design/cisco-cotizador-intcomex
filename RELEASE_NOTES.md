# HISTORIAL DE VERSIONES Y NOTAS DE RELEASE (RELEASE NOTES)
## Cisco Automated v2.3.0 (Arquitectura Enterprise Suite)
### Intcomex Chile

---

## 📅 Tabla General de Versiones y Releases

| Versión | Commit Principal | Fecha / Periodo | Hitos y Cambios Arquitectónicos Principales | Estado |
|---|---|---|---|---|
| **v2.3.0 (Enterprise)** | Pendiente | Octubre 2026 | **Versión Móvil PWA & Modo Pocket:** Barra inferior fija de navegación, tarjetas táctiles en el cotizador con drawer de desglose, compartir en 1 clic por WhatsApp/correo móvil con Web Share API, manifest PWA con soporte de pantalla completa en Android/iOS y aislamiento total de la experiencia de escritorio. | **VIGENTE / PRODUCCIÓN** |
| **v2.2.5** | `5d6b8f5` / `e4a460b` | Octubre 2026 | **Alineación Ergonómica & Documentación Completa:** Reubicación de botones de acción rápida a la izquierda, retiro de logos redundantes, estandarización de `CHANGELOG.md` (Keep a Changelog) y actualización de `README.md` en GitHub con los 11 módulos y 11 colecciones Firestore. | Estable |
| **v2.2.4** | `81f5354` | Octubre 2026 | **Minimalismo en Barra de Navegación & Submenú de Configuración:** Consolidación de reglas CCW, Partners XCL, reglas de SKU, catálogo Fast Track y soporte IA dentro del submenú "Configuración del Sistema" en la barra lateral. | Estable |
| **v2.2.3** | `5f50fc6` | Octubre 2026 | **Descarga Instantánea de Cotizaciones:** Aceleración de la generación y descarga Excel (<500ms) mediante desacoplamiento asíncrono de persistencia local y sincronización cloud. | Estable |
| **v2.2.2** | `5557327` | Octubre 2026 | **Homologación Estricta de Licencias:** Supresión determinista de hardware residual (switches Catalyst/Meraki) cuando la solicitud del usuario en ConfigurIAtor es puramente de software o suscripciones. | Estable |
| **v2.2.1** | `7f35c0c` | Octubre 2026 | **Cotización de Licencias Puras en ConfigurIAtor:** Soporte integral para Webex Calling, Webex Meetings, Cisco EA, renovaciones SmartNet y Ciberseguridad Cloud SaaS. | Estable |
| **v2.2.0** | `d08b5ac` / `260bdfa` | Octubre 2026 | **Sincronización Dinámica de Versiones:** Centralización de versión en `src/core/appVersion.ts`, scripts automáticos de SemVer (`scripts/version_manager.js`) para actualizaciones chicas (`patch`) y grandes (`minor`/`major`), y eliminación de versiones estáticas en todo el código. Módulo de Mejoras & Soporte con triaje y diagnóstico de IA (Gemini 3.6 Flash / OpenRouter), SLA dinámico y Firestore Col 11. Transición automática a Back Order (BO), catálogo de SKUs manuales en Firestore (`cisco_bo_sku_catalog`), pipeline logístico Kanban (`bo_order_tracking`) con FedEx/UPS/DHL, recordador de Deals escalados (`deal_reminders`), auto-updater de 1-clic para Desktop con Cloudflare CDN, y despliegue de reglas Cloud Firestore. | Predecesora Estable |
| **v2.1.0** | `7b4d35e` / `511c934` | Octubre 2026 | Integración inicial del módulo de Mejoras y Soporte Técnico, botón de acceso en Navbar y despliegue de reglas Firestore. | Predecesora Estable |
| **v2.0.8** | `2fa53d0` | Octubre 2026 | Implementación del motor de auto-actualización en caliente de 1-clic para la App de Escritorio Windows conectado a `version.json` en Cloudflare CDN. | Estable |
| **v2.0.7** | `c58d432` | Octubre 2026 | Sistema de Multi-Versionamiento de Cotizaciones CCW (`estimates/{id}/versions/{vId}`) con `v0_RAW` inmutable y modal comparador de versiones. | Estable |
| **v2.0.6** | `2667366` | Octubre 2026 | Arquitectura Database Armor con bóveda redundante multi-capa (LocalStorage Vault + IndexedDB `CiscoAppCollectionsDB` + Tombstones `deleted_ids`). | Estable |
| **v2.0.5** | `17b5126` | Octubre 2026 | Integración de indicadores oficiales de Banco Central de Chile (USD / UF) con spread comercial preventivo de +10 CLP para cotizaciones en moneda local. | Estable |
| **v2.0.4** | `723ffff` | Octubre 2026 | Regla estricta de Lead Time Miami (175 días corridos = 27 semanas de entrega) con anti-degradación idempotente y snapshot `sys_metadata`. | Estable |
| **v2.0.3** | `e00c3a0` | Octubre 2026 | Clasificación de accesorios en Líneas Madre $N.0$ (Cámaras Meraki `MV*`, Sensores `MT*`, Teléfonos IP `CP-*/DP-*`, Webex Room Bar `CS-*`) con Arancel Aduanero del 6.0%. | Estable |
| **v2.0.2** | `34a89c4` | Octubre 2026 | Cascada de IA con Google Gemini 3.6 Flash para ConfigurIAtor con fallback a OpenRouter y motor heurístico determinista offline. | Estable |
| **v2.0.1** | `6b00ee7` | Octubre 2026 | Sincronización en la nube del catálogo Fast Track mediante particionado en bloques (chunks) en `cisco_fast_track_catalog`. | Estable |
| **v2.0.0** | `42a385e` | Septiembre 2026 | Lanzamiento inicial v2.0: Cotizador CCW con Goal Seek, Generador DSV 48 columnas, Auditor Fast Track en IndexedDB y wrapper Desktop PyInstaller. | Predecesora |

---

## [v2.3.0] - Octubre 2026 (Enterprise Release Actual)

### 📱 Experiencia Móvil PWA & Modo Pocket Ejecutivo
- **Barra de Navegación Inferior Móvil (`MobileBottomNav`):** Barra fija al estilo de las aplicaciones nativas con accesos directos ergonómicos a *Cotizar*, *ConfigurIAtor*, *Tracking BO*, *Métricas* y *Menú*.
- **Cajón de Menú Rápido Deslizable (`MobileMenuDrawer`):** Drawer táctil que permite subir archivos Excel, generar órdenes DSV, consultar Fast Track, revisar reglas CCW y gestionar tickets de soporte con triaje IA.
- **Cotizador Táctil por Tarjetas (`MobileEstimateCardList`):** Sustitución responsiva de la tabla ancha de 12 columnas por tarjetas interactivas adaptadas al tamaño de mano, con badges de tipo de producto y drawer inferior para inspeccionar costos y reclasificar reglas comerciales.
- **Compartir en 1 Clic (Web Share API):** Integración nativa con WhatsApp, Telegram y correo del teléfono para enviar resúmenes de cotizaciones al instante.
- **PWA Instalable:** `manifest.json`, iconos corporativos de alta resolución y meta tags móviles para anclar la app a la pantalla de inicio en Android y iOS sin necesidad de tiendas de aplicaciones.
- **Aislamiento Total de Escritorio:** Monitores de escritorio y la aplicación Desktop `.exe` permanecen 100% inalteradas.

---

## [v2.2.5] - Octubre 2026

### 🎨 Alineación Ergonómica y Documentación Completa
- **Reubicación de Acciones Rápidas:** Los botones *Subir Excel*, *Generar DSV* y *Descargar Excel* fueron trasladados al extremo superior izquierdo, eliminando el desplazamiento innecesario del ratón hacia la derecha.
- **Limpieza Visual:** Retiro del logo partner redundante contiguo al botón de descarga para optimizar el espacio útil en pantalla.
- **Portabilidad & Documentación en GitHub:** `README.md` reescrito para reflejar los 11 módulos, 11 colecciones de Cloud Firestore y control de versiones centralizado.
- **Changelog Estándar:** Creación de `CHANGELOG.md` basado en el estándar internacional *Keep a Changelog*.

---

## [v2.2.4] - Octubre 2026

### 🎨 Minimalismo en Navegación y Submenú Unificado
- **Consolidación en Barra Lateral (Sidebar):** Reagrupación de las pantallas de *Reglas y Metodología CCW*, *Base de Datos de Partners XCL*, *Reglas de SKUs*, *Catálogo Fast Track* y *Mejoras & Soporte IA* bajo un solo submenú colapsable denominado **"Configuración del Sistema"**.
- **Reducción de Ruido Visual en Navbar:** Eliminación de accesos directos redundantes en la cabecera, logrando un encabezado limpio y profesional.

---

## [v2.2.3] - Octubre 2026

### ⚡ Optimización de Rendimiento en Descarga
- **Descarga Instantánea de Estimates:** Optimización del ciclo de renderizado y guardado de archivos Excel (`.xlsx`), reduciendo el tiempo de procesamiento de más de 5 segundos a menos de 500 milisegundos.
- **Persistencia Asíncrona Desacoplada:** El guardado en IndexedDB local y el envío a Cloud Firestore se desacoplaron del evento de guardado en el navegador, permitiendo al usuario recibir el archivo de forma instantánea.

---

## [v2.2.2] - Octubre 2026

### 🛡️ Homologación Estricta de Licencias Puras
- **Supresión Determinista de Hardware:** Ajuste en el motor de extracción de BOMs de ConfigurIAtor para eliminar switches o hardware físico cuando la intención del usuario es exclusivamente adquirir licencias (Webex, Cisco EA o Meraki License).
- **Regla Heurística Post-Generación:** Validación post-IA que purga líneas de hardware añadidas por error cuando se detectan palabras clave de licenciamiento puro.

---

## [v2.2.1] - Octubre 2026

### 🌟 Cotización de Licencias Puras en ConfigurIAtor
- **Soporte de Software y Colaboración:**
  - Webex Calling y Webex Meetings (`A-FLEX-*`, `A-SPK-*`).
  - Cisco Enterprise Agreement (EA) en Networking, Seguridad y Data Center.
  - Renovaciones de contratos SmartNet / SNTC (`CON-SNT-*`, `CON-SNTP-*`).
  - Ciberseguridad Cloud SaaS (Cisco Umbrella, Secure Endpoint / AMP, Duo Security).
  - Terminales de telefonía IP (`CP-88xx`, `CP-78xx`) y terminales de videoconferencia Webex Room Bar (`CS-BAR-*`).

---

## [v2.2.0] - Octubre 2026

### 🔄 Sincronización Dinámica de Versiones y SemVer Automático
- **Única Fuente de Verdad (`src/core/appVersion.ts`):** Eliminación de versiones hardcodeadas estáticas en el frontend, bridge de escritorio y servicios en la nube. Todas las vistas (`SettingsView`, `Sidebar`, `App`, `feedbackService`, `databaseBackupManager`, `desktopBridge`) leen de forma dinámica `APP_VERSION` y `getFormattedAppVersion()`.
- **Motor Inteligente de Versiones (`scripts/version_manager.js`):** Analiza los mensajes de commits y la envergadura del cambio para determinar si es una actualización chica (`patch`, ej: `2.2.1`) o grande (`minor`, ej: `2.3.0` o `major` `3.0.0`).
- **Nuevos Scripts en `package.json`:** `npm run version:bump:patch`, `npm run version:bump:minor`, `npm run version:bump:major`, `npm run version:sync`.
- **Sincronización Transversal en Build:** En cada compilación `prepare:pages`, se regeneran automáticamente `version.json` en todas las carpetas (`public/`, `dist/`, `desktop_app/`, `dist_exe/`) y el runtime desktop `desktop_window.py`.

---

## [v2.1.0] - Octubre 2026

### 🚀 Módulo Destacado: Mejoras, Reporte de Errores y Soporte Técnico con Triaje IA
- **Bandeja Centralizada de Tickets (`app_feedback_tickets` en Firestore):**
  - Registro estructurado de solicitudes de usuarios clasificados en 6 categorías: `BUG` (error técnico), `IMPROVEMENT` (optimización existente), `FEATURE_REQUEST` (nueva función), `UX_UI` (diseño y visualización), `DATA_CATALOG` (reglas o SKUs) y `OTHER` (consultas generales).
  - **SLA Dinámico por Prioridad:**
    - `CRITICAL`: 4 horas (bloqueo de cálculos comerciales o bases de datos).
    - `HIGH`: 24 horas (falla severa sin workaround ágil).
    - `MEDIUM`: 72 horas (mejora relevante o problema menor).
    - `LOW`: 120 horas (sugerencia estética o idea futura).
    - Indicadores de tiempo real de SLA: `ON_TIME` (en plazo), `NEAR_BREACH` (en riesgo, menos del 25% restante) y `BREACHED` (plazo vencido).
  - **Captura Técnica Automática:** Incluye hash de commit de Git, versión de la app, entorno (Web/Desktop), resolución de pantalla y vista activa al momento del reporte.
  - **Adjuntos Visuales:** Soporte para adjuntar y pegar imágenes (`Ctrl + V`) directamente en el modal de creación.
- **Asesor de Soluciones y Triaje con Inteligencia Artificial (`aiFeedbackAdvisor.ts`):**
  - Cascada multi-modelo (Google Gemini 3.6 Flash primario, OpenRouter secundario, heurístico determinista offline).
  - **Dictamen Estructurado:**
    1. *Factibilidad:* Veredicto claro (`YES` / `CONDITIONAL` / `NO`) indicando si es viable realizar lo que solicita el usuario.
    2. *Diagnóstico de Causa Raíz:* Explicación técnica detallada de por qué ocurre el error o cómo funciona el flujo actual.
    3. *Propuesta de Solución Técnica:* Plano de diseño e ingeniería paso a paso, archivos a intervenir e impacto técnico.
    4. *Estimación de Esfuerzo:* `Bajo (1-2h)`, `Medio`, `Alto` o `Complejo`.
    5. *Respuesta Recomendada al Usuario:* Texto cordial y profesional listo para enviar como feedback.
  - **Directiva Estricta de No Modificación:** La IA formula la propuesta técnica y el dictamen de factibilidad sin aplicar modificaciones automáticas en el código fuente, garantizando el control del equipo de ingeniería.
  - **Acciones Rápidas:** Botón *"Usar como Respuesta al Usuario"*, *"Copiar Dictamen"* y *"Re-analizar con IA"*.
- **Acceso Inmediato en Navbar:** Botón violeta dedicado con icono de salvavidas integrado en la barra de navegación superior para máxima accesibilidad.

---

## [v2.0.8] - Octubre 2026
- Auto-actualización de 1-clic para la App de Escritorio Windows conectado a `version.json` en Cloudflare CDN.

---

## [v2.0.7] - Octubre 2026
- Multi-versionamiento de cotizaciones CCW (`estimates/{id}/versions/{vId}`) con `v0_RAW` inmutable y modal comparador.

---

## [v2.0.6] - Octubre 2026
- Arquitectura Database Armor con bóveda redundante multi-capa (LocalStorage Vault + IndexedDB + Tombstones).

---

## [v2.0.5] - Octubre 2026
- Indicadores oficiales de Banco Central de Chile (USD / UF) con spread comercial preventivo de +10 CLP.

---

## [v2.0.4] - Octubre 2026
- Regla estricta de Lead Time Miami (175 días corridos = 27 semanas de entrega) con snapshot `sys_metadata`.

---

## [v2.0.3] - Octubre 2026
- Clasificación de accesorios en Líneas Madre $N.0$ (Cámaras Meraki `MV*`, Sensores `MT*`, Teléfonos IP `CP-*/DP-*`, Webex Room Bar `CS-*`) con Arancel Aduanero del 6.0%.

---

## [v2.0.2] - Octubre 2026
- Cascada de IA con Google Gemini 3.6 Flash para ConfigurIAtor con fallback a OpenRouter y heurística offline.

---

## [v2.0.1] - Octubre 2026
- Sincronización en la nube del catálogo Fast Track mediante particionado en bloques (chunks) en `cisco_fast_track_catalog`.

---

## [v2.0.0] - Septiembre 2026
- Lanzamiento inicial: Cotizador CCW con Goal Seek, Generador DSV 48 columnas, Auditor Fast Track en IndexedDB y wrapper Desktop PyInstaller.
