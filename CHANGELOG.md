# Registro de Cambios e Historial de Modificaciones (Changelog)

Todos los cambios notables y modificaciones de cada actualización en **Cisco Automated** están documentados en este archivo.

El formato se basa rigurosamente en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer)](https://semver.org/lang/es/).

---

## [v2.4.6] - 2026-10-24
### 🌟 Agregado (Separación por Líneas Madre en Excel, PDF Comercial, Correo Outlook y Resumen Ejecutivo)
- **Exportación en Excel con Separación por Líneas Madre y Subtotales:** Opción en el modal de descarga para estructurar la cotización en bloques ordenados por cada Línea Madre (`1.0`, `2.0`, etc.) con subtotales individuales de cantidad y precio de venta mediante fórmulas nativas de Excel `=SUM(...)`, consolidando la suma en la fila final de Price Total para deals separados por OC.
- **Selector de Formato de Excel:** Alternancia en 1 clic entre `[📋 Continuo Estándar]` (formato CCW original) y `[📑 Agrupado por Líneas]` con selector de filtro para exportar todas las líneas o aislar una línea específica si el cliente formaliza solo una OC.
- **Tarjeta de Resumen Ejecutivo en Excel (Idea 1):** Inclusión opcional de un bloque resumen al pie de la cotización que categoriza el valor total en Equipamiento Hardware, Licenciamiento / Software Cloud y Servicios de Soporte SmartNet (omitiendo códigos internos de bodega para el cliente final).
- **Repetición Simétrica de Encabezados a partir de Línea 2.0:** Eliminación de la fila de banner (`📦 Bloque Línea...`) para iniciar directamente bajo el encabezado principal en Línea 1.0, y repetición exacta de los 7 encabezados oficiales (`Line Number | Part Number | Description | Estimated Lead Time (Days) | Qty | Unit Net Price | Extended Net Price`) a partir de Línea 2.0 en Excel y PDF, permitiendo que el cliente final pueda filtrar y ordenar sin obstáculos visuales.
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
