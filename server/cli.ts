/**
 * Gera um anúncio direto do terminal, sem abrir o editor:
 *   npm run gerar -- fotos/*.jpg --notas "Drone FPV, R$ 3500, acompanha 1 bateria" [--nome tanq]
 * Cria Anuncios/<nome>/ com as fotos em imagens/, projeto.json e descricao.txt. Depois é só abrir no editor
 * ("Abrir"), revisar e exportar a imagem.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { emptyAd } from '../src/defaults.ts';
import { fromAiDraft, toAiDraft } from '../src/engine/aiDraft.ts';
import { buildDescription } from '../src/engine/description.ts';
import type { Project } from '../src/types.ts';
import { runClaude } from './claude.ts';
import { createProject, PROJECTS_DIR, saveImage, saveProject } from './projects.ts';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { notas: { type: 'string', short: 'n', default: '' }, nome: { type: 'string' } },
});

if (!positionals.length && !values.notas) {
  console.error('Uso: npm run gerar -- <fotos...> --notas "descrição do item" [--nome pasta]');
  process.exit(1);
}

const photos = await Promise.all(
  positionals.map(async (file) => {
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`Formato não suportado: ${file}`);
    return `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
  }),
);

const base = emptyAd();
console.error(`Chamando claude -p com ${photos.length} foto(s)...`);
const result = await runClaude({ mode: 'generate', instruction: values.notas ?? '', photos, draft: toAiDraft(base).draft });

// Pasta com o nome pedido, ou com o título que o Claude escolheu.
const id = await createProject(values.nome || result.draft.title || result.draft.subtitle);
const stored = await Promise.all(photos.map((p) => saveImage(id, p, 'foto')));
const data = fromAiDraft(result.draft, stored, base);
const project: Project = { version: 1, data, descriptionOverride: null };
const description = buildDescription(data);
await saveProject(id, project, description);

console.error(
  `Projeto salvo em ${path.join(PROJECTS_DIR, id)} (${(result.durationMs / 1000).toFixed(0)}s${result.costUsd ? `, US$ ${result.costUsd.toFixed(3)}` : ''})`,
);
if (result.notes) console.error(`\nObservações do Claude: ${result.notes}`);
console.log(`\n${description}`);
