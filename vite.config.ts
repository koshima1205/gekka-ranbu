import { defineConfig, type Plugin } from 'vite';

/** `--mode single`: JS と CSS を index.html に埋め込んだ1ファイル版を作る */
function inlineAll(): Plugin {
  return {
    name: 'inline-all',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const htmlKey = Object.keys(bundle).find((k) => k.endsWith('.html'));
      if (!htmlKey) return;
      const htmlAsset = bundle[htmlKey];
      if (htmlAsset.type !== 'asset') return;
      let html = String(htmlAsset.source);
      for (const [key, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          const code = chunk.code.replace(/<\/script/gi, '<\\/script');
          html = html.replace(new RegExp(`<script[^>]*src="[^"]*${chunk.fileName}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[key];
        } else if (chunk.type === 'asset' && key.endsWith('.css')) {
          const css = String(chunk.source);
          html = html.replace(new RegExp(`<link[^>]*href="[^"]*${chunk.fileName}"[^>]*>`), () => `<style>${css}</style>`);
          delete bundle[key];
        }
      }
      htmlAsset.source = html;
    },
  };
}

/**
 * X などにリンクを貼ったときのカード（OGP）。画像は絶対 URL でないと出ないので、
 * index.html の %SITE_URL% をビルド時に公開先の URL にする。
 * 独自ドメインにしたら環境変数 SITE_URL で指定する。Cloudflare Pages のビルドでは
 * CF_PAGES_URL（https://<ハッシュ>.<プロジェクト>.pages.dev）からプロジェクトの URL を取る。
 */
function siteUrl(): string {
  const { SITE_URL, CF_PAGES_URL } = process.env;
  if (SITE_URL) return SITE_URL.replace(/\/+$/, '');
  const pages = CF_PAGES_URL && new URL(CF_PAGES_URL).hostname.match(/[^.]+\.pages\.dev$/);
  return `https://${pages ? pages[0] : 'gekka-ranbu.pages.dev'}`;
}

function ogp(): Plugin {
  const url = siteUrl();
  return {
    name: 'ogp',
    // Vite が HTML の中の URL を読む前に置きかえる
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', url) },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  build:
    mode === 'single'
      ? {
          outDir: 'dist-single',
          // three.js を含むので1ファイルは大きめ（gzip で約 250KB）
          chunkSizeWarningLimit: 1200,
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          modulePreload: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : { outDir: 'dist', chunkSizeWarningLimit: 1200 },
  plugins: mode === 'single' ? [ogp(), inlineAll()] : [ogp()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
