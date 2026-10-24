// ============================================================================
// CISCO AUTOMATED - REGISTRO HISTÓRICO DE MODIFICACIONES Y VERSIONES
// Estructura sincronizada con CHANGELOG.md y RELEASE_NOTES.md
// ============================================================================

export interface VersionHistoryItem {
  version: string;
  date: string;
  commit: string;
  title: string;
  status: 'CURRENT' | 'STABLE' | 'LEGACY';
  type: 'major' | 'minor' | 'patch';
  highlights: string[];
}

export const VERSION_HISTORY: VersionHistoryItem[] = [
  {
    version: '2.4.4',
    date: '2026-10-23',
    commit: 'feat-bo-line-grouping',
    title: 'Separación por Líneas Madre, Subtotales por OC y Copiado Selectivo en Módulo BO',
    status: 'CURRENT',
    type: 'patch',
    highlights: [
      'Nueva modalidad de visualización interactiva en el modal de solicitud de Back Order (BO): switch entre [Vista Unificada] y [Separar por Líneas (Subtotales por OC)].',
      'Agrupación automática de ítems por línea madre (ej. 1.0, 2.0) con subtotales individuales de cantidad y precio extendido para deals divididos en múltiples órdenes de compra por el Partner.',
      'Selector dinámico y pestañas de filtrado por línea específica con 1 clic para exportar o enviar por correo solo la orden seleccionada (ej. OC #1 para Línea 1.0 u OC #2 para Línea 2.0).',
      'Botón de copiado rápido individual por bloque de línea con formato HTML enriquecido directo a Microsoft Outlook y tabla resumen con Total General consolidado.',
      'Preservación íntegra de reglas comerciales y técnicas del módulo BO: sufijos -CBN, edición de SKU, bodega E1/ED por split de hardware/servicios y gaveta de descartados de costo cero.',
    ],
  },
  {
    version: '2.4.3',
    date: '2026-10-23',
    commit: 'fix-custom-params-filename',
    title: 'Resolución Dinámica de Parámetros Custom en Nomenclatura de Descarga',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Corrección del tag comercial en el nombre del archivo al descargar: en modo custom o con líneas personalizadas refleja exactamente las tasas efectivas aplicadas (ej. _I23M6_) en lugar de los defaults CCW estándar (_I7M5_).',
      'Cálculo ponderado real de internación sobre ítems tangibles cotizados y consolidación de margen comercial general para la cotización.',
      'Sincronización reactiva inmediata en DownloadModal ante conmutación de modos o modificación de líneas custom en ParameterSidebar.',
      'Preservación de tasas efectivas y mapa de líneas en el respaldo cloud sin sobreescribir auditoría previa.',
    ],
  },
  {
    version: '2.4.2',
    date: '2026-10-23',
    commit: 'feat-tech-disclaimer',
    title: 'Cláusula Formal de Validación Técnica y Armonización de Notas al Pie',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Inyección obligatoria de la cláusula formal de Validación Técnica y Responsabilidad de preventa para Partners.',
      'Armonización estética de las 3 cláusulas al pie (Validez de Oferta, Plazo de Entrega y Validación Técnica) con tipografía Arial 7.5pt, cursiva y colores Slate corporativos.',
      'Soporte de ajuste automático de texto (wrapText) y altura ampliada para lectura clara en Microsoft Excel sin recortes.',
      'Reflejo idéntico 1:1 en la previsualización web (ExcelSheetPreview) y protección anti-contaminación de ítems en re-import.',
    ],
  },
  {
    version: '2.4.1',
    date: '2026-10-23',
    commit: 'fix-audit-load',
    title: 'Restauración Inmediata de Parámetros Previos e Integridad de Arancel',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Eliminación de saltos en cálculos al cargar cotizaciones previamente editadas: valores se despliegan de inmediato con la tasa exacta guardada (ej. 23% internación, 6% arancel, 6% margen).',
      'Preservación integral del arancel aduanero en metadatos sombra sys_metadata (naranja) y restauración bidireccional exacta.',
      'Sincronización instantánea de sliders de la barra lateral y switches de modo al momento de la carga sin requerir interacción manual previa.',
      'Ampliación del modal de detección de auditoría previa para exhibir Internación Base, Arancel Base y Margen Base con badges dedicados.',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-10-23',
    commit: 'feat-custom-lines',
    title: 'Parámetros CCW Custom por Línea y Herencia Jerárquica N.0 / N.x',
    status: 'STABLE',
    type: 'minor',
    highlights: [
      'Selector de modo de costeo [Estándar CCW] vs [Por Línea] en la barra de parámetros.',
      'Configuración granular de Internación, Arancel y Margen por bloque de línea madre (1.0, 2.0, 3.0...).',
      'Herencia matemática automática hacia todas las sub-líneas hijas (1.1, 1.2, 2.1...).',
      'Visualización interactiva con badges violetas en tabla de cotización y tarjetas móviles.',
      'Menú contextual y modal inteligente con alertas de recálculo previo al abrir archivos modificados.',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-10-22',
    commit: 'feat-mobile',
    title: 'Versión Móvil PWA & Modo Pocket Táctil para Smartphones',
    status: 'STABLE',
    type: 'minor',
    highlights: [
      'Barra de navegación inferior fija (MobileBottomNav) para cotizar, consultar BO y acceder a la IA desde el celular.',
      'Vista táctil de tarjetas en el cotizador (MobileEstimateCardList) con drawer inferior de detalle y reclasificación de reglas.',
      'Soporte completo de Progressive Web App (PWA) con manifest.json, iconos oficiales y safe-area para iOS/Android.',
      'Compartir cotizaciones en 1 clic directamente por WhatsApp o correo móvil con formato ejecutivo (Web Share API).',
      'Cero impacto en escritorio: las pantallas >= 768px y la App Desktop .exe mantienen intacta la experiencia corporativa.',
    ],
  },
  {
    version: '2.2.5',
    date: '2026-10-22',
    commit: '5d6b8f5',
    title: 'Alineación Ergonómica, Changelog Oficial & Documentación Completa',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Reubicación de botones Subir Excel, Generar DSV y Descargar hacia el extremo izquierdo.',
      'Retiro del logo redundant partner junto al botón de descarga.',
      'Creación formal de CHANGELOG.md (Keep a Changelog) y etiquetas Git oficiales.',
      'Actualización completa de README.md en GitHub con 11 módulos y persistencia en 11 colecciones Firestore.',
    ],
  },
  {
    version: '2.2.4',
    date: '2026-10-22',
    commit: '81f5354',
    title: 'Minimalismo en Navegación y Submenú Configuración del Sistema',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Consolidación de Reglas CCW, Partners XCL, Reglas SKU, Fast Track y Soporte IA en barra lateral.',
      'Eliminación de accesos directos y botones redundantes de la barra superior (Navbar).',
      'Acceso rápido y centralizado mediante el submenú "Configuración del Sistema".',
    ],
  },
  {
    version: '2.2.3',
    date: '2026-10-22',
    commit: '5f50fc6',
    title: 'Descarga Instantánea de Cotizaciones Excel (<500ms)',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Aceleración radical de descarga de cotizaciones modificadas de ~5-7s a <500ms.',
      'Desacoplamiento asíncrono no bloqueante de la sincronización en la nube con Firestore y almacenamiento local.',
    ],
  },
  {
    version: '2.2.2',
    date: '2026-10-22',
    commit: '5557327',
    title: 'Homologación Estricta de Licencias Puras sin Equipamiento Físico',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Supresión determinista de hardware residual (switches Catalyst/Meraki) cuando se cotizan únicamente licencias.',
      'Filtro post-procesamiento en ConfigurIAtor para garantizar pureza en software y SaaS.',
    ],
  },
  {
    version: '2.2.1',
    date: '2026-10-22',
    commit: '7f35c0c',
    title: 'Cotización de Licencias Puras Webex, Cisco EA y Renovaciones SmartNet',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Soporte nativo en ConfigurIAtor para Webex Calling, Webex Meetings y Colaboración Flex.',
      'Cisco Enterprise Agreement (EA) y renovaciones de soporte SmartNet / SNTC.',
      'Suscripciones SaaS de Ciberseguridad (Cisco Umbrella, Secure Endpoint, Duo Security).',
      'Telefonía IP (CP-88xx/78xx) y salas de videoconferencia Webex Room Bar.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-10-22',
    commit: 'd08b5ac',
    title: 'Sincronización Dinámica de Versiones y SemVer Automático',
    status: 'STABLE',
    type: 'minor',
    highlights: [
      'Centralización en src/core/appVersion.ts como única fuente de verdad transversal.',
      'Scripts inteligentes de SemVer (version_manager.js) para bumps patch/minor/major.',
      'Extracción automática de metadatos de Git (generate_build_info.js) en build pipeline.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-10-22',
    commit: '7b4d35e',
    title: 'Módulo de Soporte, Reporte de Errores y Mejoras con Triaje IA',
    status: 'STABLE',
    type: 'minor',
    highlights: [
      'Bandeja de tickets en Firestore (app_feedback_tickets) con SLA dinámico por prioridad.',
      'Asesor IA (Gemini 3.6 Flash / OpenRouter) con diagnóstico, factibilidad y plan técnico.',
      'Captura contextual automática (commit, versión, pantalla) y adjuntos de capturas con Ctrl+V.',
      'Reglas de seguridad en Cloud Firestore para Colección 11.',
    ],
  },
  {
    version: '2.0.8',
    date: '2026-10-22',
    commit: '2fa53d0',
    title: 'Auto-actualizador Desktop en Caliente de 1-Clic',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Actualización instantánea de la App Desktop Windows conectada a Cloudflare CDN.',
      'Distribución de artefactos portables (.html ~5MB) y version.json sin instaladores externos.',
    ],
  },
  {
    version: '2.0.7',
    date: '2026-10-21',
    commit: 'c58d432',
    title: 'Multi-versionado de Cotizaciones CCW con v0_RAW Inmutable',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Subcolección estimates/{id}/versions/{vId} en Cloud Firestore.',
      'Preservación inmutable de la versión original de importación v0_RAW.',
      'Modal comparador de versiones lado a lado con variaciones de precios y márgenes.',
    ],
  },
  {
    version: '2.0.6',
    date: '2026-10-20',
    commit: '2667366',
    title: 'Database Armor Multi-capa y Recuperación de Desastres',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Bóveda redundante: LocalStorage Vault + IndexedDB CiscoAppCollectionsDB + Tombstones.',
      'Protección de datos ante fallos de conexión o caídas temporales de red.',
    ],
  },
  {
    version: '2.0.5',
    date: '2026-10-19',
    commit: '17b5126',
    title: 'Indicadores Banco Central de Chile con Spread Comercial +$10 CLP',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Consulta en vivo de valores oficiales USD y UF.',
      'Spread comercial preventivo de +10 CLP sobre el dólar interbancario.',
    ],
  },
  {
    version: '2.0.4',
    date: '2026-10-18',
    commit: '723ffff',
    title: 'Lead Time Miami Estricto (175 Días / 27 Semanas)',
    status: 'STABLE',
    type: 'patch',
    highlights: [
      'Regla fija de 175 días corridos con anti-degradación idempotente.',
      'Persistencia en metadatos sombra sys_metadata de Excel.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-10-12',
    commit: '42a385e',
    title: 'Lanzamiento Base: Cotizador CCW, DSV 48 Columnas y Fast Track',
    status: 'LEGACY',
    type: 'major',
    highlights: [
      'Cotizador comercial con solver de margen objetivo (Goal Seek).',
      'Generador oficial Cisco DSV de 48 columnas en formato Excel Calibri 11.',
      'Auditor Fast Track en IndexedDB con base de datos cliente persistente.',
      'Empaquetado Desktop Portable Windows con SQLite local integrado.',
    ],
  },
];
