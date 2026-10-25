# Registro de Cambios e Historial de Modificaciones (Changelog)

Todos los cambios notables y modificaciones de cada actualización en **Cisco Automated** están documentados en este archivo.

El formato se basa rigurosamente en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer)](https://semver.org/lang/es/).

---

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
