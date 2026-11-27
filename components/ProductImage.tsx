'use client';

import { ImageIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { imageCandidates } from '@/lib/images';

type Props = {
  src: string | null | undefined;
  alt?: string;
  width: number;
  height: number;
  priority?: boolean;
  /** Carrega sem esperar a rolagem (primeiros cards visíveis), sem prioridade alta de rede. */
  eager?: boolean;
};

// Imagens das lojas: miniatura do próprio CDN quando existe (KaBuM _g, VTEX -400-400, Shopify width) e o arquivo
// original só se a miniatura falhar. Falha temporária ganha novas tentativas com espera crescente e parâmetro de
// recarga (o navegador não reaproveita a resposta com erro). Esgotadas as tentativas, mostra o ícone e tenta de novo
// quando a conexão volta, a aba volta a ficar visível ou depois de 20 s — uma falha não fica permanente na navegação.
// O HTML do servidor já traz as <img>: no celular elas começam a baixar antes da hidratação e um erro nesse intervalo
// não chega ao onError do React. O script do layout registra esses erros em window.__baixouImgErr e o efeito de
// montagem os reprocessa.
const RETRY_DELAYS = [700, 2000];
const RECOVER_MS = 20000;
// Memória da sessão por URL: miniatura que falhou definitivamente não é pedida de novo por outros cards.
const failedUrls = new Set<string>();

declare global { interface Window { __baixouImgErr?: WeakSet<EventTarget> } }

export default function ProductImage({src, ...props}: Props) {
  return <ImageAttempt key={src ?? ''} src={src} {...props}/>;
}

function withRetry(url: string, n: number) {
  if (!n) return url;
  return url + (url.includes('?') ? '&' : '?') + '_r=' + n;
}

function ImageAttempt({src, alt = '', width, height, priority, eager}: Props) {
  const candidates = imageCandidates(src, width);
  const first = Math.max(0, candidates.findIndex(u => !failedUrls.has(u)));
  const [state, setState] = useState({index: first, tries: 0, failed: candidates.length === 0, round: 0});
  const ref = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = candidates[state.index];

  const onError = () => {
    if (timer.current) return;
    const delay = RETRY_DELAYS[state.tries];
    if (delay !== undefined && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      timer.current = setTimeout(() => { timer.current = null; setState(s => ({...s, tries: s.tries + 1})); }, delay);
      return;
    }
    if (url) failedUrls.add(url);
    if (state.index + 1 < candidates.length) setState(s => ({...s, index: s.index + 1, tries: 0}));
    else setState(s => ({...s, failed: true}));
  };

  // Erro ocorrido antes da hidratação (ou imagem já quebrada no cache do navegador).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.__baixouImgErr?.has(el) || (el.complete && el.naturalWidth === 0 && !!el.currentSrc)) onError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, state.tries, state.round]);

  // Recuperação depois de esgotar as tentativas: volta para a miniatura (a falha pode ter sido da rede).
  useEffect(() => {
    if (!state.failed || !candidates.length) return;
    const recover = () => { for (const u of candidates) failedUrls.delete(u); setState(s => s.failed ? {index: 0, tries: 0, failed: false, round: s.round + 1} : s); };
    const onVisible = () => { if (document.visibilityState === 'visible') recover(); };
    const t = state.round < 3 ? setTimeout(recover, RECOVER_MS * (state.round + 1)) : null;
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', onVisible);
    return () => { if (t) clearTimeout(t); window.removeEventListener('online', recover); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.failed, state.round]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const image = state.failed || !url ? null : withRetry(url, state.tries + (state.round ? 10 * state.round : 0));
  return <span className="product-photo" style={{width, height}}>
    <ImageIcon className="product-photo-placeholder" size={Math.min(40, width / 2)} aria-hidden="true"/>
    {image && <img
      key={image}
      ref={ref}
      src={image}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      loading={priority || eager ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={onError}
    />}
  </span>;
}
