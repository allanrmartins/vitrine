import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { AiRequest } from '../src/engine/aiDraft.ts';
import type { Project } from '../src/types.ts';
import { aiStatus, runAi } from './ia.ts';
import {
  createProject,
  FILES_PREFIX,
  HttpError,
  listFolderImages,
  listProjects,
  loadProject,
  revealProject,
  saveExport,
  saveImage,
  saveProject,
  serveProjectFile,
} from './projects.ts';

const MAX_BODY = 60 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Arquivo grande demais para enviar de uma vez.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/**
 * /api/projetos: pastas de projeto em Anuncios/.
 *   GET    /                  lista
 *   POST   /                  { name } -> { id }
 *   GET    /:id               { project, exportedAt }
 *   PUT    /:id               { project, description }
 *   GET    /:id/imagens       { images, ignored } (inclui fotos copiadas à mão na pasta)
 *   POST   /:id/imagens       { dataUrl, hint } -> { url }
 *   POST   /:id/exportar      { png, description } -> { path, exportedAt }
 *   POST   /:id/revelar       abre a pasta no Explorer
 */
async function projectsHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    const parts = (req.url ?? '/').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
    const [id, action] = parts;
    const body = async <T>() => JSON.parse(await readBody(req)) as T;

    if (!id && req.method === 'GET') return send(res, 200, await listProjects());
    if (!id && req.method === 'POST') return send(res, 200, { id: await createProject((await body<{ name: string }>()).name ?? '') });
    if (id && !action && req.method === 'GET') return send(res, 200, await loadProject(id));
    if (id && !action && req.method === 'PUT') {
      const b = await body<{ project: Project; description: string }>();
      return send(res, 200, { ok: true, savedAt: await saveProject(id, b.project, b.description ?? '') });
    }
    if (id && action === 'imagens' && req.method === 'GET') return send(res, 200, await listFolderImages(id));
    if (id && action === 'imagens' && req.method === 'POST') {
      const b = await body<{ dataUrl: string; hint?: string }>();
      return send(res, 200, { url: await saveImage(id, b.dataUrl, b.hint ?? 'imagem') });
    }
    if (id && action === 'exportar' && req.method === 'POST') {
      const b = await body<{ png: string; description: string }>();
      return send(res, 200, await saveExport(id, b.png, b.description ?? ''));
    }
    if (id && action === 'revelar' && req.method === 'POST') {
      await revealProject(id);
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'Rota não encontrada.' });
  } catch (e) {
    send(res, e instanceof HttpError ? e.status : 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * API local do editor: ponte com a IA (Claude Code ou Gemini CLI) e pastas de projeto. Só existe no
 * `npm run dev`/`preview`; na versão hospedada o editor funciona igual, sem IA e guardando o rascunho só no navegador.
 *   GET  /api/ia/saude         responde na hora (o atalho usa para saber se o servidor subiu)
 *   GET  /api/ia[?refresh=1]   AiStatus: quais IAs estão instaladas e logadas
 *   POST /api/ia               AiRequest -> AiResult & RunInfo
 */
export function localApi(): Plugin {
  const aiHandler = async (req: IncomingMessage, res: ServerResponse) => {
    const [route, query = ''] = (req.url ?? '/').split('?');
    if (req.method === 'GET' && route.replace(/\/$/, '') === '/saude') return send(res, 200, { ok: true });
    if (req.method === 'GET') return send(res, 200, await aiStatus(new URLSearchParams(query).has('refresh')));
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não suportado.' });
    const abort = new AbortController();
    res.on('close', () => !res.writableEnded && abort.abort());
    try {
      const body = JSON.parse(await readBody(req)) as AiRequest;
      send(res, 200, await runAi(body, abort.signal));
    } catch (e) {
      if (!abort.signal.aborted) send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  };
  return {
    name: 'vitrine-local-api',
    configureServer(server) {
      server.middlewares.use('/api/ia', aiHandler);
      server.middlewares.use('/api/projetos', projectsHandler);
      server.middlewares.use(FILES_PREFIX, serveProjectFile);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/ia', aiHandler);
      server.middlewares.use('/api/projetos', projectsHandler);
      server.middlewares.use(FILES_PREFIX, serveProjectFile);
    },
  };
}
