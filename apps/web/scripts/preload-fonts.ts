import type { Plugin } from 'vite';

/**
 * Preloads the Latin Figtree file so first text renders in the brand face without a late swap
 * (doc 07 §3). The hashed file name is only known after bundling, hence a build-time plugin.
 */
export function preloadFonts(pattern = /figtree-latin-wght-normal-[\w-]+\.woff2$/): Plugin {
  return {
    name: 'cy-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const files = Object.keys(context.bundle ?? {}).filter((file) => pattern.test(file));
        return files.map((file) => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            href: `/${file}`,
            as: 'font',
            type: 'font/woff2',
            crossorigin: '',
          },
          injectTo: 'head-prepend' as const,
        }));
      },
    },
  };
}
