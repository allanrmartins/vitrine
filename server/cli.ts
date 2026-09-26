/**
 * Gera um anúncio direto do terminal, sem abrir o editor:
 *   npm run gerar -- fotos/*.jpg --notas "Drone FPV, R$ 3500, acompanha 1 bateria" [--nome tanq] [--ia gemini]
 * Cria Anuncios/<nome>/ com as fotos em imagens/, projeto.json e descricao.txt. Depois é só abrir no editor
 * ("Abrir"), revisar e exportar a imagem.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { emptyAd } from '../src/defaults.ts';
import { fromAiDraft, PROVIDER_NAMES, toAiDraft, type ProviderId } from '../src/engine/aiDraft.ts';
import { buildDescription } from '../src/engine/description.ts';
import type { Project } from '../src/types.ts';
import { aiStatus, forcedProvider, pickProvider, runAi } from './ia.ts';
import { createProject, PROJECTS_DIR, saveImage, saveProject } from './projects.ts';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { notas: { type: 'string', short: 'n', default: '' }, nome: { type: 'string' }, ia: { type: 'string' } },
});

if (!positionals.length && !values.notas) {
  console.error('Uso: npm run gerar -- <fotos...> --notas "descrição do item" [--nome pasta] [--ia claude|gemini]');
  process.exit(1);
}

const photos = await Promise.all(
  positionals.map(async (file) => {
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`Formato não suportado: ${file}`);
    return `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
  }),
);

const requested = values.ia ? (values.ia.toLowerCase() as ProviderId) : undefined;
const status = await aiStatus();
const provider = pickProvider(status.providers, forcedProvider(), requested);
if (!provider || (requested && provider !== requested)) {
  for (const p of status.providers) console.error(`${PROVIDER_NAMES[p.id]}: ${p.detail}`);
  console.error(requested ? `\n${values.ia} não está pronto nesta máquina.` : '\nNenhuma IA pronta nesta máquina.');
  process.exit(1);
}

const base = emptyAd();
console.error(`Chamando ${provider} -p com ${photos.length} foto(s)...`);
const result = await runAi({ mode: 'generate', instruction: values.notas ?? '', photos, draft: toAiDraft(base).draft, provider });

// Pasta com o nome pedido, ou com o título que a IA escolheu.
const id = await createProject(values.nome || result.draft.title || result.draft.subtitle);
const stored = await Promise.all(photos.map((p) => saveImage(id, p, 'foto')));
const data = fromAiDraft(result.draft, stored, base);
const project: Project = { version: 1, data, descriptionOverride: null };
const description = buildDescription(data);
await saveProject(id, project, description);

console.error(
  `Projeto salvo em ${path.join(PROJECTS_DIR, id)} (${(result.durationMs / 1000).toFixed(0)}s${result.costUsd ? `, US$ ${result.costUsd.toFixed(3)}` : ''})`,
);
if (result.notes) console.error(`\nObservações do ${PROVIDER_NAMES[provider]}: ${result.notes}`);
console.log(`\n${description}`);
