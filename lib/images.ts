// Endereços de imagem aceitos (HTTPS, raster, sem credenciais/porta) e miniaturas oferecidas pelo próprio CDN da
// loja. A miniatura vem primeiro; o original fica como segunda tentativa (nunca outro arquivo ou outra loja).
// Medido em 27/11/2026: KaBuM _gg 1000 px/113 KB → _g 395 px/27 KB (_m 200 px/10 KB); VTEX original 1000 px/78 KB →
// ids/N-400-400 18 KB; Shopify width=1920 251 KB → width=480 92 KB (webp quando o navegador aceita).
export function rasterUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      /\.(avif|webp|jpe?g|png|gif)$/i.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}

// Largura exibida em px CSS → miniatura suficiente para telas 2× (cards de 230 px; sugestões de 48 px).
export function thumbnailUrl(original: string, width: number): string | null {
  const small = width <= 64;
  const kabum = original.match(/^(https:\/\/images\.kabum\.com\.br\/produtos\/fotos\/\d+\/[^/?#]+)_gg(\.jpg)$/i);
  if (kabum && width <= 230) return kabum[1] + (small ? '_m' : '_g') + kabum[2];
  const vtex = original.match(/^(https:\/\/[a-z0-9-]+\.vtexassets\.com\/arquivos\/ids\/)(\d+)(\/[^?#]+(?:\?[^#]*)?)$/i);
  if (vtex && width <= 230) { const px = small ? 120 : 400; return vtex[1] + vtex[2] + '-' + px + '-' + px + vtex[3]; }
  try {
    const u = new URL(original);
    if (u.pathname.startsWith('/cdn/shop/') && u.searchParams.has('width') && width <= 230) {
      const px = small ? 120 : 480;
      if (Number(u.searchParams.get('width')) > px) { u.searchParams.set('width', String(px)); return u.href; }
    }
  } catch { /* endereço já validado */ }
  return null;
}

export function imageCandidates(src: string | null | undefined, width: number): string[] {
  const original = rasterUrl(src);
  if (!original) return [];
  const thumb = thumbnailUrl(original, width);
  return thumb && thumb !== original ? [thumb, original] : [original];
}
