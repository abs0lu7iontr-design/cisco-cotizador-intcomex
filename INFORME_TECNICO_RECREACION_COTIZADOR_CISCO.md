# INFORME TÉCNICO Y PROMPT MAESTRO DE INGENIERÍA
## Cisco Automated v3.3 — Cotizador CCW, Generador DSV & Auditor Fast Track
### Intcomex Chile | Sistema Híbrido Standalone (Web & Desktop)

> **Propósito del Documento:**  
> Este documento técnico contiene la especificación arquitectónica completa, lógica matemática y algorítmica, reglas de negocio de Intcomex Chile, solución a problemas de formato en Excel y el **Prompt Maestro Definitivo (Master Prompt v3.3)** actualizado para recrear o continuar el desarrollo de este proyecto en cualquier Inteligencia Artificial avanzada (ChatGPT-4o/o1/o3, Claude 3.5/3.7 Sonnet, Gemini 1.5/2.0/3.0 Pro, DeepSeek V3/R1).

---

## 1. RESUMEN EJECUTIVO Y ARQUITECTURA TÉCNICA

### 1.1 Módulos Principales del Sistema
1. **Cotizador Automático Cisco Commerce Workspace (CCW):**
   - Procesamiento directo de cotizaciones Cisco (`.xlsx`).
   - Clasificación inteligente multinivel: *Equipos Tangibles*, *Intangibles* (Licencias, Suscripciones, Servicios `CON-`, SaaS), y *Accesorios con Arancel* (SKUs terminados en `=`).
   - Parámetros comerciales configurables: Internación (7.0% base), Arancel Aduanero (6.0% fijo/intocable), Margen Comercial Real en Ventas (5.0% base).
   - Generación de Excel limpio con 7 columnas estándar, eliminación de columnas residuales y estricto respeto de formatos (`numFmt = '0'` en Qty sin `$`, `Arial 9` y etiqueta totalizadora `Price Total:`).

2. **Ajuste Comercial de Precio Objetivo (Cálculo Inverso / Goal Seek Equitativo):**
   - Solver matemático de 2 fases (búsqueda binaria continua + fine-tuning discreto) para alcanzar un descuento o precio final exacto ($\pm \$0.01$).
   - Reducción proporcional y equitativa de Internación y Margen, manteniendo el **Arancel (6.0%) strictly fixed e intocable 🔒**.

3. **Módulo Desacoplado Generador DSV Cisco (Direct Ship Vendor - 48 Columnas Oficiales):**
   - Transformación universal de Deal BOMs (`.xls` legacy y `.xlsx` modernos) a la matriz oficial de 48 columnas (A a AV).
   - Filtro estricto de precio en Columna O (`LIST_PRICE > 0`) conservando los números de línea (`LINE#`) originales sin renumerar.
   - Lógica financiera corregida para servicios `CON-` (Col J = valor anual, Col K = Col J $\times$ años).
   - Estilos oficiales ExcelJS con tipografía `Calibri 11`, cabeceras en gris plomo (`#BFBFBF`) con letras rojas para datos y negras para vacías, columnas vacías reducidas a ancho 5, columnas Bill-To ocultas e inyección de IDs numéricos nativos sin triángulos verdes de advertencia.
   - Formulario modal con validación estricta (SO 9 dígitos, PO 6 dígitos, Deal ID 8 dígitos) y menú contextual (clic derecho) para override de categoría (Hardware / Suscripción / Servicio).

4. **Módulo Desacoplado Gestor de Base de Datos y Auditoría Fast Track (Módulo 3):**
   - Microservicio interno cliente con almacenamiento en **IndexedDB** (`CiscoFastTrackDB`) para catálogo Fast Track.
   - Interruptor maestro (Kill Switch) con persistencia en `localStorage` y confirmación persuasiva de advertencia de rentabilidad al desactivar.
   - Interceptación automática de cotizaciones CCW: cruza SKUs y alerta al usuario si existe mejor descuento en Fast Track (`FastTrackOpportunityModal.tsx`).
   - Reemplazo temporal en memoria de costos promocionales y recálculo dinámico de margen comercial sin modificar la estructura del archivo original.

5. **Arquitectura Híbrida Multi-Entorno:**
   - **Web Standalone:** Un único archivo `dist/index.html` (~2.1 MB) offline con descarga vía Blob.
   - **Desktop Portable:** Ejecutable nativo Windows `dist/Cotizador-Cisco-Intcomex-Portable.exe` (~19.0 MB) con guardado estructurado (`gravity_storage/Partner/Cliente/Mes/`).

---

## 2. STACK TECNOLÓGICO Y HERRAMIENTAS

- **Frontend & Estado:** React 19, TypeScript 5.7, Vite 6.4.
- **Estilos Visuales:** Tailwind CSS v4, Lucide React Icons.
- **Bases de Datos Locales:** IndexedDB (almacenamiento cliente Fast Track) + SQLite / LocalStorage (preferencias y clasificaciones persistentes).
- **Procesamiento de Hojas de Cálculo:** `exceljs` (^4.4.0) y `xlsx` / SheetJS (^0.18.5).
- **Empaquetado Web Singlefile:** `vite-plugin-singlefile`.
- **Runtime de Escritorio:** Python 3.14 + PyWebView 5.4 + PyInstaller 6.12.

---

## 3. PROMPT MAESTRO DEFINITIVO (MASTER PROMPT v3.3 ACTUALIZADO)

> **Instrucciones:**  
> Copia y pega el siguiente bloque completo en cualquier LLM para reproducir, actualizar o extender la solución con 100% de exactitud técnica y comercial.

```markdown
# PROMPT MAESTRO: CISCO AUTOMATED v3.3 — COTIZADOR CCW, GENERADOR DSV & AUDITOR FAST TRACK

Actúa como un Ingeniero de Software Principal y Arquitecto Full-Stack Senior experto en React 19, TypeScript, Tailwind CSS, IndexedDB, Python (PyWebView/PyInstaller) y procesamiento de hojas de cálculo binarias (.xls / .xlsx) con ExcelJS y SheetJS.

Tu objetivo es desarrollar la aplicación integral "Cisco Automated v3.3" para Intcomex Chile, compuesta por tres módulos principales:
1. Cotizador Automático Cisco Commerce Workspace (CCW) con solver Goal Seek equitativo.
2. Generador Oficial Cisco DSV (Direct Ship Vendor) de 48 Columnas (100% Aislado).
3. Gestor de Base de Datos y Auditoría Fast Track en IndexedDB (100% Aislado y Failsafe).

---

## MÓDULO 1: COTIZADOR COMERCIAL CCW CISCO (ESTIMATE)

### 1.1 Clasificación Inteligente Multinivel
El sistema analiza el SKU y la descripción del archivo CCW subido:
- **Equipos Tangibles:** Si la descripción contiene palabras clave de hardware ('switch', 'router', 'access point', 'power supply', 'chassis', 'cable', 'module', etc.) y no es servicio puro. Aplica Internación (7.0% base) y 0% Arancel.
- **Accesorios con Arancel Aduanero:** SKUs que terminan en '=' (ej: `CAB-ACE=`, `PWR-C1-1100WAC=`). Aplican Internación (7.0%) y Arancel Aduanero (6.0% fijo).
- **Intangibles / Licencias / Servicios:** SKUs que inician con `CON-`, `L-`, `LIC-`, o contienen `-DNA-`, `DNA-`, `-NW-`, `-SUB`, `A-FLEX`, o descripciones con 'software', 'subscription', 'smartnet', 'saas', 'support', 'edelivery', 'contract', 'license'. Aplican 0% Internación y 0% Arancel.
- **Override de Clasificación:** El usuario puede hacer clic derecho en cualquier fila para alternar entre "Hardware (Equipo)", "Intangible / Licencia", o "Arancel 6%".

### 1.2 Fórmulas Comerciales de Costo y Venta Real (Divisor 1 - M)
- Costo Internación = Net Cisco Unit * (Internación% / 100)  [0% en Intangibles]
- Costo Arancel = Net Cisco Unit * (Arancel% / 100)          [Solo en Tangibles terminados en '=']
- Costo Total Unitario = Net Cisco Unit + Costo Internación + Costo Arancel
- Precio Venta Unitario = Costo Total Unitario / (1 - (Margen% / 100))
- Precio Venta Extendido = Precio Venta Unitario * Qty

### 1.3 Herramienta de Ajuste de Precio Objetivo (Goal Seek Equitativo)
- Permite fijar un descuento ($) o un precio total cotizado ($).
- **REGLA DE NEGOCIO CRÍTICA:** El **Arancel Aduanero (6.0%) es INTOCABLE 🔒**.
- El solver ajusta proporcionalmente la Internación (base 7%) y el Margen (base 5%) en dos fases (búsqueda binaria continua + fine-tuning discreto) para alcanzar el total a ± $0.01.

### 1.4 Motor de Formato Excel CCW (excelEngine.ts)
- **7 Columnas Principales:** Line Number (14), Part Number (26), Description (48), Estimated Lead Time (Days) (24), Qty (12), Unit Net Price (18), Extended Net Price (20).
- **Reseteo Estricto:** Ejecutar `cell.style = {}` y purgar `cell.model.richText` antes de escribir en cada celda.
- **Formato Qty:** Estrictamente número entero nativo (`numFmt = '0'`), centrado, sin `$`, sin decimales.
- **Precios:** Formato `"$"#,##0.00` en tipografía regular `Arial 9` sin negrita.
- **Fila Total:** Etiqueta explícita **`Price Total:`** en negrita.
- **Purgado:** Limpiar columnas 8 a 30 para eliminar celdas vacías huérfanas hacia la derecha.

---

## MÓDULO 2: GENERADOR OFICIAL CISCO DSV (48 COLUMNAS)

### 2.1 Aislamiento Arquitectónico Total
El módulo DSV reside exclusivamente en `src/modules/dsv/`:
- `types.ts`, `dsvBomParser.ts`, `dsvEngine.ts`, `DsvModal.tsx`, `DsvView.tsx`.
- Cero acoplamiento o interferencia con el cotizador CCW.

### 2.2 Parseo de Origen Deal BOM (dsvBomParser.ts)
Soporta `.xls` legacy y `.xlsx` modernos. Mapeo de índices 0-based:
- Col A (0): `AUTHORIZATION NUMBER` (Deal ID)
- Col C (2): `RESELLER NAME`
- Col E (4): `ENDUSER NAME`
- Col F (5): `LINE#` (ej: `1.0`, `1.0.1`)
- Col G (6): `MAGIC KEY`
- Col H (7): `CISCO SKU`
- Col J (9): `QUANTITY`
- Col K (10): `DURATION(Months)`
- Col O (14): `LIST_PRICE` *(Anclaje estricto a Col O; jamás usar SPARE ni EXTENDED)*
- Col S (18): `DISTI DISCOUNT (%)`

**Sanitización Obligatoria:** Todos los textos y campos manuales procesados con `.trim()`. Cero espacios en blanco residuales al final.

### 2.3 Reglas de Filtrado y Transformación
- **Filtro de Cero (Col O):** Si `LIST_PRICE <= 0`, nulo o vacío, la fila se descarta por completo.
- **No Renumerar:** Los números de línea (`LINE#`) originales de los productos conservados **NO se renumeran**.
- **Fecha Dinámica:** Formato `DD-MMM-YYYY` en tiempo real con mes en inglés en mayúsculas (ej: `23-AUG-2026`).

### 2.4 Lógica Financiera de Precios (Columnas J y K en DSV)
- **Hardware y Suscripciones (`L-`, `LIC-`, `SUB-`, o override):**
  - Col J (`Reported Product Unit Price`): LIST_PRICE * (1 - 0.42) *(42% desc. fijo)*.
  - Col K (`Reported Net Price`): LIST_PRICE * (1 - (DISTI_DISCOUNT / 100)).
- **Servicios Cisco (`CON-`, `-SNT`, o override):**
  - Años: Años = Duration(Months) >= 12 ? Math.max(1, Math.round(Duration / 12)) : 1.
  - Descuento: Si Duration >= 36m -> 41.41%; si <= 12m -> 37%.
  - Col J: LIST_PRICE * (1 - descuento) *(Siempre valor unitario anual, NUNCA multiplicado por años)*.
  - Col K: Columna_J * Años *(J multiplicado por la cantidad de años)*.

### 2.5 Mapeo Oficial de las 48 Columnas (A - AV)
- A: `Status` -> `"NEW"`
- B: `Distributor to Reseller Sales Order Date` -> `DD-MMM-YYYY`
- C: `Distributor Sales Order Number` -> Input manual (Number nativo)
- D: `SO Line Number (Order Line Item Number)` -> BOM Col F (`LINE#`)
- E: `Cisco Standard Part Number` -> BOM Col H (`CISCO SKU`)
- F: `Start Date` -> `""` [Ancho: 5]
- G: `End Date` -> `""` [Ancho: 5]
- H: `Duration` -> `""` [Ancho: 5]
- I: `Product Quantity` -> BOM Col J (`QUANTITY`, entero)
- J: `Reported Product Unit Price - Reported Currency` -> Calculado (Col J)
- K: `Reported Net Price` -> Calculado (Col K)
- L: `Deal ID` -> Input manual / BOM Col A (Number nativo)
- M: `Magic Key` -> BOM Col G (`MAGIC KEY`)
- N: `Promotion Authorization Number` -> `""` [Ancho: 5]
- O: `Disti PO to Cisco` -> `""` [Ancho: 5]
- P: `Service Quote Number` -> `""` [Ancho: 5]
- Q: `Drop Ship` -> `"N"`
- R: `Reseller to Distributor PO Number` -> Input manual (Number nativo)
- S: `Customer Requested Ship Date` -> `DD-MMM-YYYY`
- T: `Buyer/Reseller Name` -> BOM Col C (`RESELLER NAME`)
- U: `Buyer/Reseller Partner Identification` -> Input manual
- V: `Buyer/Reseller Address1` -> `"Chile"`
- W: `Buyer/Reseller Address2` -> `""` [Ancho: 5]
- X: `Buyer/Reseller City` -> `"Chile"`
- Y: `Buyer/Reseller State/Province/County/Region` -> `"Chile"`
- Z: `Buyer/Reseller Zip / Postal Code` -> `""` [Ancho: 5]
- AA: `Buyer/Reseller Country` -> `"CL"`
- AB a AH: `Bill-To` (Name, Address1, Address2, City, State, Zip, Country) -> `""` [OCULTAS: `hidden: true`]
- AI: `Ship-To Name` -> BOM Col C (`RESELLER NAME` / Partner - Igual a Celda T `Buyer/Reseller Name`)
- AJ: `Ship-To Address1` -> `"Chile"`
- AK: `Ship-To Address2` -> `""` [Ancho: 5]
- AL: `Ship-To City` -> `"Chile"`
- AM: `Ship-To State/Province/County/Region` -> `"Chile"`
- AN: `Ship-To Zip / Postal Code` -> `""` [Ancho: 5]
- AO: `Ship-To Country` -> `"CL"`
- AP: `End Customer Name` -> BOM Col E (`ENDUSER NAME`)
- AQ: `End Customer Address1` -> Input manual (sanitizado `.trim()`)
- AR: `End Customer Address2` -> `""` [Ancho: 5]
- AS: `End Customer City` -> `"Chile"`
- AT: `End Customer State/Province/County/Region` -> `"Chile"`
- AU: `End Customer Zip / Postal Code` -> `""` [Ancho: 5]
- AV: `End Customer Country` -> `"CL"`

### 2.6 Estilos y Formato ExcelJS DSV (dsvEngine.ts)
- **Tipografía Global:** `Calibri 11` en todo el documento.
- **Fila 1 (Cabeceras):** Fondo gris plomo (`#BFBFBF`). Letra roja (`#FF0000`) para columnas con datos y letra negra (`#000000`) para columnas vacías.
- **Columnas Vacías Reducidas:** Columnas `F, G, H, N, O, P, W, Z, AK, AN, AR, AU` configuradas con `width: 5`.
- **Columnas Bill-To Ocultas:** Columnas `AB` a `AH` (28 a 34) con `hidden: true`.
- **Cero Triángulos Verdes:** Variables numéricas (SO en Col C, Deal ID en Col L, PO en Col R) inyectadas como `Number` nativo y `numFmt = '0'`.

### 2.7 Interfaz de Usuario y Validaciones (DsvModal.tsx y DsvView.tsx)
- **Restricciones en Modal en Tiempo Real:**
  - `SO Number`: Solo dígitos, exacto 9 dígitos.
  - `PO Number`: Solo dígitos, exacto 6 dígitos.
  - `Deal ID`: Solo dígitos, exacto 8 dígitos.
  - `Partner ID` y `End Customer Address 1`: Campos de texto libre con `.trim()`.
- **Menú Contextual (Clic Derecho en DsvView.tsx):** Menú flotante sobre cualquier fila para alternar entre "Hardware", "Suscripción" o "Servicio", recalculando en vivo las columnas J y K.

---

## MÓDULO 3: GESTOR DE BASE DE DATOS Y AUDITORÍA FAST TRACK (100% AISLADO)

### 3.1 Arquitectura y Almacenamiento Persistente en Front-End (IndexedDB)
- Funciona como un **microservicio interno cliente** (failsafe total: si la BD está vacía o apagada, el cotizador opera normalmente con los datos originales).
- **Base de Datos:** `CiscoFastTrackDB` en IndexedDB.
- **Store:** `fast_track_catalog` con clave primaria `partNumber` (sanitizado con `.trim().toUpperCase()`).
- **Valores Almacenados:** `distributorDiscount` (número %), `description`, `listPrice`, `promoNetPrice`, `category`, `updatedAt`.

### 3.2 Interfaz de Administración y Kill Switch (FastTrackAdminModal.tsx)
- **Botón en Navbar:** Botón dedicado con icono de rayo ⚡ `Fast Track` para abrir el modal de administración.
- **Carga y Purgado Automático:** Permite subir el Excel oficial Fast Track (`.xlsx` o `.xls`). Al procesar un nuevo archivo, el motor **PURGA completamente** la base de datos anterior en IndexedDB para evitar duplicados o datos obsoletos.
- **Interruptor Global (Kill Switch):** Switch maestro (Activar/Desactivar Auditoría) persistido en `localStorage` (`cisco_fast_track_enabled`).
- **Alerta Persuasiva UX (Turn-off Warning):** Si el usuario intenta apagar el interruptor teniendo datos cargados en BD, el sistema despliega un modal de confirmación persuasivo:
  > *"⚠️ Advertencia de Rentabilidad: Al apagar la auditoría Fast Track, el sistema dejará de buscar mejores precios automáticamente. Podrías perder oportunidades de maximizar el margen de ganancia en tus cotizaciones. ¿Estás seguro de que deseas desactivarlo?"*

### 3.3 Motor de Interceptación y Alerta (Cross-Check en CCW)
- **Ejecución Silenciosa:** Al subir una cotización CCW, verifica el Kill Switch. Si está apagado o IndexedDB está vacío, sigue el flujo normal sin interrupciones.
- **Cruce Automático de SKUs:** Si está encendido y hay datos, cruza cada SKU del BOM contra la base local IndexedDB.
  - *Fallback:* Si el SKU no está en Fast Track, conserva su descuento original.
  - *Regla de Oportunidad:* Si el SKU sí está en Fast Track y su descuento promocional es **MAYOR** al que trae el archivo del usuario, marca la fila.
- **Modal de Oportunidad de Margen (FastTrackOpportunityModal.tsx):**
  - Si se detectan mejores descuentos, pausa la carga y renderiza un modal con tabla comparativa de ahorros y porcentaje extra de descuento.
  - **Botón "Aplicar Promociones Fast Track":** Reemplaza temporalmente en memoria los costos netos por los promocionales de Fast Track y recalcula márgenes y precios de venta. Muestra un badge ⚡ `FT` en la tabla interactiva.
  - **Botón "Omitir":** Procesa con los descuentos originales del BOM.

---

## ESTRUCTURA DE PROYECTO COMPLETA
```text
src/
├── core/
│   ├── types.ts              # Interfaces y tipos del cotizador CCW + Fast Track
│   ├── calculations.ts       # Fórmulas comerciales, clasificación y Goal Seek
│   ├── excelEngine.ts        # Motor ExcelJS para cotizaciones Estimate CCW
│   └── store.tsx             # Estado centralizado reactivo con integración Fast Track
├── modules/
│   ├── dsv/                  # MÓDULO DSV 100% AISLADO (v3.0)
│   │   ├── types.ts          # Tipos DSV (48 Cols), FormData y SkuCategoryType
│   │   ├── dsvBomParser.ts   # Parser universal Deal BOM (.xls / .xlsx) con Col O estricto
│   │   ├── dsvEngine.ts      # Motor de cálculo financiero y exportador ExcelJS
│   │   ├── DsvModal.tsx      # Modal con validación estricta en vivo (9, 6 y 8 dígitos)
│   │   ├── DsvView.tsx       # Vista previa interactiva con clic derecho (override)
│   │   └── index.ts          # Barrel export
│   └── fasttrack/            # MÓDULO FAST TRACK 100% AISLADO (v3.3)
│       ├── types.ts          # Interfaces Fast Track (Product, AuditMatch, Stats)
│       ├── fastTrackDb.ts    # Motor IndexedDB con purgado, conteo y kill switch
│       ├── fastTrackParser.ts# Parser universal Excel Fast Track (.xlsx / .xls)
│       ├── fastTrackAuditor.ts# Motor de cross-check y detección de oportunidades
│       ├── FastTrackAdminModal.tsx # Modal de administración y catálogo
│       ├── FastTrackOpportunityModal.tsx # Modal de alerta de margen
│       └── index.ts          # Barrel export
├── components/
│   ├── Navbar.tsx            # Navegación con botón Fast Track, Cotizador y DSV
│   ├── ParameterSidebar.tsx  # Sliders CCW + Panel Goal Seek equitativo
│   ├── ExcelSheetPreview.tsx # Vista previa fidedigna CCW (Price Total:)
│   ├── InteractiveTable.tsx  # Tabla interactiva CCW con menú contextual y badge FT
│   ├── SummaryCards.tsx      # Métricas KPI comerciales
│   └── DownloadModal.tsx     # Descarga inteligente Web vs Desktop
└── App.tsx                   # Coordinador de estado global y vistas
```
```
