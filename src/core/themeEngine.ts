// ============================================================================
// CISCO AUTOMATED - ADVANCED THEME ENGINE (12 PROFESSIONAL THEMES)
// ============================================================================

export interface AppTheme {
  id: string;
  name: string;
  category: 'Cisco & Intcomex' | 'FinTech & Dark' | 'Cyber & Neon' | 'Executive & Minimal';
  description: string;
  swatchColors: [string, string, string]; // [Background, Primary Accent, Secondary Accent]
  cssVars: {
    '--bg-app': string;
    '--bg-panel': string;
    '--bg-card': string;
    '--border-card': string;
    '--accent-primary': string;
    '--accent-secondary': string;
    '--accent-glow': string;
    '--text-highlight': string;
  };
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'cisco-blue',
    name: 'Cisco Executive Blue (Por Defecto)',
    category: 'Cisco & Intcomex',
    description: 'Paleta corporativa oficial Cisco con azul cobalto y acentos índigo modernos.',
    swatchColors: ['#030712', '#4f46e5', '#06b6d4'],
    cssVars: {
      '--bg-app': '#020617',
      '--bg-panel': '#0b132b',
      '--bg-card': '#0f172a',
      '--border-card': 'rgba(79, 70, 229, 0.3)',
      '--accent-primary': '#4f46e5',
      '--accent-secondary': '#6366f1',
      '--accent-glow': 'rgba(99, 102, 241, 0.25)',
      '--text-highlight': '#818cf8',
    },
  },
  {
    id: 'intcomex-cyber-red',
    name: 'Intcomex Crimson Flame',
    category: 'Cisco & Intcomex',
    description: 'Estilo inspirado en la marca Intcomex con rojos intensos y negro carbón.',
    swatchColors: ['#09090b', '#e11d48', '#f59e0b'],
    cssVars: {
      '--bg-app': '#0a0a0c',
      '--bg-panel': '#161113',
      '--bg-card': '#241419',
      '--border-card': 'rgba(225, 29, 72, 0.4)',
      '--accent-primary': '#e11d48',
      '--accent-secondary': '#f43f5e',
      '--accent-glow': 'rgba(225, 29, 72, 0.3)',
      '--text-highlight': '#fda4af',
    },
  },
  {
    id: 'emerald-fintech',
    name: 'Emerald Profit & FinTech',
    category: 'FinTech & Dark',
    description: 'Diseño enfocado en alta rentabilidad financiera con verdes esmeralda y menta.',
    swatchColors: ['#022c22', '#10b981', '#34d399'],
    cssVars: {
      '--bg-app': '#02130e',
      '--bg-panel': '#052219',
      '--bg-card': '#0a3225',
      '--border-card': 'rgba(16, 185, 129, 0.4)',
      '--accent-primary': '#059669',
      '--accent-secondary': '#10b981',
      '--accent-glow': 'rgba(16, 185, 129, 0.3)',
      '--text-highlight': '#6ee7b7',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon Matrix',
    category: 'Cyber & Neon',
    description: 'Fusión de cian eléctrico, rosa neón y púrpuras oscuros futuristas.',
    swatchColors: ['#090514', '#ec4899', '#06b6d4'],
    cssVars: {
      '--bg-app': '#080512',
      '--bg-panel': '#150926',
      '--bg-card': '#210d3d',
      '--border-card': 'rgba(236, 72, 153, 0.45)',
      '--accent-primary': '#db2777',
      '--accent-secondary': '#ec4899',
      '--accent-glow': 'rgba(236, 72, 153, 0.35)',
      '--text-highlight': '#f472b6',
    },
  },
  {
    id: 'midnight-amethyst',
    name: 'Midnight Amethyst & Violet',
    category: 'Cyber & Neon',
    description: 'Elegancia nocturna con tonos amatista profunda, lavanda y violeta suave.',
    swatchColors: ['#0a0518', '#8b5cf6', '#c084fc'],
    cssVars: {
      '--bg-app': '#090414',
      '--bg-panel': '#160a2e',
      '--bg-card': '#221147',
      '--border-card': 'rgba(139, 92, 246, 0.4)',
      '--accent-primary': '#7c3aed',
      '--accent-secondary': '#8b5cf6',
      '--accent-glow': 'rgba(139, 92, 246, 0.3)',
      '--text-highlight': '#c084fc',
    },
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber & Bronze Gold',
    category: 'Executive & Minimal',
    description: 'Calidez ejecutiva con oro pulido, ámbar brillante y grafito mate.',
    swatchColors: ['#120c04', '#f59e0b', '#fbbf24'],
    cssVars: {
      '--bg-app': '#0e0a04',
      '--bg-panel': '#1a1306',
      '--bg-card': '#2b1f09',
      '--border-card': 'rgba(245, 158, 11, 0.4)',
      '--accent-primary': '#d97706',
      '--accent-secondary': '#f59e0b',
      '--accent-glow': 'rgba(245, 158, 11, 0.3)',
      '--text-highlight': '#fde68a',
    },
  },
  {
    id: 'titanium-stealth',
    name: 'Titanium Stealth Minimal',
    category: 'Executive & Minimal',
    description: 'Monocromía ultra moderna con zinc oscuro, titanio cepillado y blanco nítido.',
    swatchColors: ['#09090b', '#71717a', '#e4e4e7'],
    cssVars: {
      '--bg-app': '#09090b',
      '--bg-panel': '#18181b',
      '--bg-card': '#27272a',
      '--border-card': 'rgba(161, 161, 170, 0.35)',
      '--accent-primary': '#52525b',
      '--accent-secondary': '#71717a',
      '--accent-glow': 'rgba(228, 228, 231, 0.15)',
      '--text-highlight': '#f4f4f5',
    },
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Arctic Glacier',
    category: 'FinTech & Dark',
    description: 'Frescura escandinava con azul hielo, aguamarina y pizarra polar.',
    swatchColors: ['#031720', '#0ea5e9', '#67e8f9'],
    cssVars: {
      '--bg-app': '#02131c',
      '--bg-panel': '#062333',
      '--bg-card': '#0a354c',
      '--border-card': 'rgba(14, 165, 233, 0.4)',
      '--accent-primary': '#0284c7',
      '--accent-secondary': '#0ea5e9',
      '--accent-glow': 'rgba(14, 165, 233, 0.3)',
      '--text-highlight': '#7dd3fc',
    },
  },
  {
    id: 'matrix-terminal',
    name: 'Matrix Hacker Terminal',
    category: 'Cyber & Neon',
    description: 'Fósforo verde de terminal retro sobre negro absoluto CRT.',
    swatchColors: ['#000000', '#22c55e', '#4ade80'],
    cssVars: {
      '--bg-app': '#000000',
      '--bg-panel': '#041607',
      '--bg-card': '#07240c',
      '--border-card': 'rgba(34, 197, 94, 0.45)',
      '--accent-primary': '#16a34a',
      '--accent-secondary': '#22c55e',
      '--accent-glow': 'rgba(34, 197, 94, 0.35)',
      '--text-highlight': '#86efac',
    },
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare Copper & Sun',
    category: 'Executive & Minimal',
    description: 'Fuerza solar con cobre ardiente, naranja fuego y carbón volcánico.',
    swatchColors: ['#120803', '#ea580c', '#fdba74'],
    cssVars: {
      '--bg-app': '#0e0602',
      '--bg-panel': '#1c0d05',
      '--bg-card': '#2e1509',
      '--border-card': 'rgba(234, 88, 12, 0.4)',
      '--accent-primary': '#c2410c',
      '--accent-secondary': '#ea580c',
      '--accent-glow': 'rgba(234, 88, 12, 0.3)',
      '--text-highlight': '#fed7aa',
    },
  },
  {
    id: 'ruby-luxury',
    name: 'Ruby Luxury & Wine',
    category: 'Executive & Minimal',
    description: 'Sofisticación ejecutiva con borgoña, rubí oscuro y destellos oro rosa.',
    swatchColors: ['#140308', '#be123c', '#fb7185'],
    cssVars: {
      '--bg-app': '#0f0307',
      '--bg-panel': '#1f060f',
      '--bg-card': '#330a19',
      '--border-card': 'rgba(190, 18, 60, 0.4)',
      '--accent-primary': '#be123c',
      '--accent-secondary': '#e11d48',
      '--accent-glow': 'rgba(225, 29, 72, 0.3)',
      '--text-highlight': '#fecdd3',
    },
  },
  {
    id: 'sapphire-royal',
    name: 'Royal Sapphire & Azure',
    category: 'Cisco & Intcomex',
    description: 'Profundidad oceánica con azul zafiro real y celeste brillante.',
    swatchColors: ['#020b1e', '#2563eb', '#60a5fa'],
    cssVars: {
      '--bg-app': '#020919',
      '--bg-panel': '#04173d',
      '--bg-card': '#07245e',
      '--border-card': 'rgba(37, 99, 235, 0.4)',
      '--accent-primary': '#1d4ed8',
      '--accent-secondary': '#2563eb',
      '--accent-glow': 'rgba(37, 99, 235, 0.3)',
      '--text-highlight': '#93c5fd',
    },
  },
];

const STORAGE_KEY_THEME = 'cisco_active_theme_id';

/**
 * Obtiene el ID del tema activo actualmente desde localStorage o por defecto 'cisco-blue'.
 */
export function getSavedThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved && APP_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch (_) {}
  return 'cisco-blue';
}

/**
 * Aplica el tema seleccionado a nivel global inyectando las variables CSS y sobreescribiendo el stylesheet en el DOM.
 */
export function applyTheme(themeId: string): AppTheme {
  const theme = APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0];
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme.id);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);

    Object.entries(theme.cssVars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    if (typeof document !== 'undefined') {
      let styleTag = document.getElementById('cisco-theme-runtime') as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'cisco-theme-runtime';
        document.head.appendChild(styleTag);
      }

      const cssRules = `
        body, #root, .bg-slate-950 {
          background-color: var(--bg-app) !important;
        }
        .bg-slate-900, .bg-slate-900\\/95, .bg-slate-900\\/90, .bg-slate-900\\/80, .bg-slate-900\\/70, .bg-slate-900\\/60 {
          background-color: var(--bg-panel) !important;
        }
        .bg-slate-800, .bg-slate-800\\/90, .bg-slate-800\\/80, .bg-slate-800\\/70, .bg-slate-800\\/60, .bg-slate-800\\/40 {
          background-color: var(--bg-card) !important;
        }
        .border-slate-800, .border-slate-800\\/80, .border-slate-800\\/60, .border-slate-700, .border-slate-700\\/50 {
          border-color: var(--border-card) !important;
        }
        .bg-indigo-600 {
          background-color: var(--accent-primary) !important;
        }
        .hover\\:bg-indigo-500:hover, .bg-indigo-500 {
          background-color: var(--accent-secondary) !important;
        }
        .text-indigo-400, .text-indigo-300, .text-indigo-200 {
          color: var(--text-highlight) !important;
        }
        .border-indigo-500, .border-indigo-500\\/40, .border-indigo-500\\/50, .border-indigo-600\\/50, .border-indigo-700\\/50 {
          border-color: var(--accent-primary) !important;
        }
        .bg-indigo-950\\/80, .bg-indigo-950\\/70, .bg-indigo-950\\/40, .bg-indigo-950\\/30, .bg-indigo-950\\/20 {
          background-color: var(--accent-glow) !important;
        }
        .shadow-indigo-600\\/30, .shadow-indigo-500\\/20 {
          box-shadow: 0 10px 25px -5px var(--accent-glow) !important;
        }
      `;

      styleTag.textContent = cssRules;
    }
  } catch (e) {
    console.warn('Error applying theme:', e);
  }
  return theme;
}
