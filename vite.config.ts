import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { defineConfig, PluginOption } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export function resolveBuildTargetConfig(env: Record<string, string | undefined> = process.env) {
  const isPortableSingleFile = env.VITE_SINGLE_FILE === 'true';
  return {
    isPortableSingleFile,
    targetMode: isPortableSingleFile ? ('portable_singlefile' as const) : ('web_chunked' as const),
  };
}

export default defineConfig(() => {
  const { isPortableSingleFile } = resolveBuildTargetConfig(process.env);

  const plugins: PluginOption[] = [react(), tailwindcss()];

  if (isPortableSingleFile) {
    plugins.push(viteSingleFile({ removeViteModuleLoader: true }));
  } else {
    plugins.push(cloudflare());
  }

  return {
    base: './',
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      emptyOutDir: true,
      rollupOptions: isPortableSingleFile
        ? undefined
        : {
            output: {
              manualChunks(id: string) {
                if (!id.includes('node_modules')) return undefined;
                if (id.includes('exceljs')) return 'vendor-exceljs';
                if (id.includes('xlsx') || id.includes('jszip')) return 'vendor-xlsx';
                if (id.includes('firebase')) return 'vendor-firebase';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('react-dom') || id.includes('react')) return 'vendor-react';
                return undefined;
              },
            },
          },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});