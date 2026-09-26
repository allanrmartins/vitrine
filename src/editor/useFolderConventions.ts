import { useEffect } from 'react';
import type { AdData } from '../types.ts';
import type { FolderImage } from '../engine/projects.ts';
import { fileMatchesLabel } from '../engine/match.ts';
import { imageUsage } from './FolderImages.tsx';
import type { Update } from './Sections.tsx';
import { setHero } from './useHeroCutout.ts';

/** Arquivos já aplicados por convenção nesta pasta ("url|mtime"): cada arquivo é aplicado uma vez só. */
function appliedSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveApplied(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // Sem storage: no pior caso a convenção é reavaliada ao reabrir (e só age em itens ainda sem foto).
  }
}
const signature = (img: FolderImage) => `${img.url}|${img.modifiedAt}`;

/**
 * Convenções de nome para fotos copiadas na pasta imagens/ do projeto:
 * - "hero.*" vira a foto principal;
 * - uma foto cujo nome combina com um item do kit ou dos diferenciais sem foto ("helice_reserva.png" ->
 *   "1x Jogo de hélices reserva") é ligada a ele.
 * Cada arquivo é aplicado uma vez (nome + data de modificação), para não brigar com escolhas manuais depois.
 */
export function useFolderConventions(
  folder: string | null,
  images: FolderImage[],
  data: AdData,
  update: Update,
  notify: (msg: string) => void,
) {
  const ours = folder ? images.filter((img) => img.url.startsWith(`/anuncios/${folder}/`)) : [];
  const imagesKey = ours.map(signature).join('\n');
  const itemsKey = JSON.stringify([
    data.images.main,
    data.images.mainOriginal,
    data.kit.items.map((k) => [k.label, k.image]),
    data.extras.items.map((e) => [e.text, e.image]),
  ]);

  useEffect(() => {
    if (!folder || !ours.length) return;
    const key = `vitrine:convencoes:${folder}`;
    const applied = appliedSet(key);
    const fresh = ours.filter((img) => !applied.has(signature(img)));
    if (!fresh.length) return;
    const messages: string[] = [];

    const hero = fresh.find((img) => /^hero\.[a-z0-9]+$/i.test(img.name));
    if (hero) {
      applied.add(signature(hero));
      if (data.images.main !== hero.url && data.images.mainOriginal !== hero.url) {
        setHero(update, hero.url);
        messages.push(`"${hero.name}" virou a foto principal`);
      }
    }

    const used = imageUsage(data);
    const links: { list: 'kit' | 'extras'; id: string; url: string; name: string; label: string }[] = [];
    const taken = new Set<string>();
    for (const img of fresh) {
      if (img === hero || used.has(img.url)) continue;
      const kit = data.kit.items.find((k) => !k.image && !taken.has(k.id) && fileMatchesLabel(img.name, k.label));
      const extra = kit ? undefined : data.extras.items.find((e) => !e.image && !taken.has(e.id) && fileMatchesLabel(img.name, e.text));
      const target = kit ? { list: 'kit' as const, id: kit.id, label: kit.label } : extra ? { list: 'extras' as const, id: extra.id, label: extra.text } : null;
      if (!target) continue;
      taken.add(target.id);
      applied.add(signature(img));
      links.push({ ...target, url: img.url, name: img.name });
    }
    if (links.length) {
      update((d) => {
        for (const l of links) {
          const item = l.list === 'kit' ? d.kit.items.find((k) => k.id === l.id) : d.extras.items.find((e) => e.id === l.id);
          if (item && !item.image) item.image = l.url;
        }
      });
      messages.push(...links.map((l) => `"${l.name}" -> ${l.label}`));
    }

    saveApplied(key, applied);
    if (messages.length) notify(`Fotos da pasta: ${messages.join('; ')}`);
    // Reage à chegada de arquivos e a mudanças nos itens (um item novo pode casar com uma foto já na pasta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, imagesKey, itemsKey]);
}
