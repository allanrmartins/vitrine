/**
 * Escolha da IA: o editor funciona com o Claude Code (`claude -p`) ou com o Gemini CLI (`gemini -p`), o que
 * estiver instalado e logado na máquina. Com os dois prontos, vale o Claude, a não ser que VITRINE_IA ou o
 * pedido escolham outro.
 */
import { PROVIDER_NAMES, type AiRequest, type AiResult, type AiStatus, type ProviderId, type ProviderStatus, type RunInfo } from '../src/engine/aiDraft.ts';
import { claudeStatus, runClaude } from './claude.ts';
import { geminiStatus, runGemini } from './gemini.ts';

export const PROVIDERS: ProviderId[] = ['claude', 'gemini'];

const checks: Record<ProviderId, () => Promise<ProviderStatus>> = { claude: claudeStatus, gemini: geminiStatus };
const runners: Record<ProviderId, (req: AiRequest, signal?: AbortSignal) => Promise<AiResult & RunInfo>> = {
  claude: runClaude,
  gemini: runGemini,
};

/** VITRINE_IA=claude|gemini fixa a IA padrão. */
export function forcedProvider(env: NodeJS.ProcessEnv = process.env): ProviderId | null {
  const v = env.VITRINE_IA?.trim().toLowerCase();
  return v === 'claude' || v === 'gemini' ? v : null;
}

/** IA a usar: a pedida (se pronta), senão a fixada em VITRINE_IA (se pronta), senão a primeira pronta. */
export function pickProvider(statuses: ProviderStatus[], forced: ProviderId | null, requested?: ProviderId): ProviderId | null {
  const ready = (id: ProviderId | null | undefined) => (id && statuses.some((s) => s.id === id && s.ready) ? id : null);
  return ready(requested) ?? ready(forced) ?? PROVIDERS.find((id) => ready(id)) ?? null;
}

// Cache por IA: login que funciona vale até o servidor reiniciar; falha é checada de novo depois de um tempo,
// para o usuário poder fazer login com o editor aberto.
const RETRY_MS = 20_000;
const cache = new Map<ProviderId, { at: number; value: Promise<ProviderStatus> }>();

function checkProvider(id: ProviderId, refresh: boolean): Promise<ProviderStatus> {
  const hit = cache.get(id);
  if (hit && !refresh) {
    const stale = hit.value.then((s) => !s.ready && Date.now() - hit.at > RETRY_MS);
    return stale.then((isStale) => (isStale ? checkProvider(id, true) : hit.value));
  }
  const value = checks[id]().catch((e): ProviderStatus => ({ id, installed: false, ready: false, detail: (e as Error).message }));
  cache.set(id, { at: Date.now(), value });
  return value;
}

export async function aiStatus(refresh = false): Promise<AiStatus> {
  const providers = await Promise.all(PROVIDERS.map((id) => checkProvider(id, refresh)));
  return { active: pickProvider(providers, forcedProvider()), providers };
}

/** Gera ou ajusta o anúncio com a IA escolhida. */
export async function runAi(req: AiRequest, signal?: AbortSignal): Promise<AiResult & RunInfo> {
  const status = await aiStatus();
  const id = pickProvider(status.providers, forcedProvider(), req.provider);
  if (!id) {
    const why = status.providers.map((p) => `${PROVIDER_NAMES[p.id]}: ${p.detail}`).join(' ');
    throw new Error(`Nenhuma IA pronta nesta máquina. ${why}`);
  }
  try {
    return await runners[id](req, signal);
  } catch (e) {
    // Login pode ter caído (chave revogada, sessão expirada): a próxima checagem pergunta de novo.
    if (!signal?.aborted) cache.delete(id);
    throw e;
  }
}
