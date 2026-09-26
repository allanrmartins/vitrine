import { useLayoutEffect, useRef } from 'react';

/**
 * Reduz o font-size do elemento (em px) até o conteúdo caber na caixa, sem estourar largura nem altura.
 * Filhos que usam `em` escalam junto. `axis` 'y' ignora a largura (blocos que quebram linha). Reexecuta quando `deps` mudam e quando as fontes terminam de carregar.
 */
export function useAutoFit<T extends HTMLElement>(max: number, min: number, deps: unknown[], axis: 'x' | 'y' | 'both' = 'both') {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = max;
      el.style.fontSize = `${size}px`;
      const overflows = () =>
        (axis !== 'y' && el.scrollWidth > el.clientWidth + 1) || (axis !== 'x' && el.scrollHeight > el.clientHeight + 1);
      while (size > min && overflows()) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => alive && fit());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, min, axis, ...deps]);

  return ref;
}
