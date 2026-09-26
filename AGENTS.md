# Vitrine - gerador de anúncios para WhatsApp

Editor local (Vite + React + TypeScript) que monta a imagem de um anúncio de venda (16:9, 2400x1350) e a legenda para grupos de WhatsApp.
A IA roda na própria máquina, pela CLI que o usuário já tiver: o editor chama `claude -p` (Claude Code) ou `gemini -p` (Gemini CLI) em modo headless, com o prompt de `prompts/anuncio.md`.
Com as duas instaladas e logadas, o padrão é o Claude; o usuário troca no painel ou com `VITRINE_IA=gemini`.
Responda em português do Brasil.

Este arquivo vale para qualquer agente: o `CLAUDE.md` (Claude Code) e o `GEMINI.md` (Gemini CLI) só importam este aqui.

## Instalação (quando o usuário pedir para instalar, configurar ou "criar o atalho")

Siga na ordem e confira cada passo antes do próximo; se algo falhar, explique e resolva antes de seguir.

1. Node.js 22 ou mais novo: `node -v`. Se faltar ou for antigo, peça para instalar a versão LTS de https://nodejs.org (não instale sozinho).
2. Dependências: `npm install` na raiz do projeto.
3. Verificação: `npm run typecheck` e `npm test` precisam passar.
4. IA: pelo menos uma das duas precisa estar instalada e logada.
   - Claude Code: `claude --version` e `claude auth status` (tem que mostrar `"loggedIn": true`). O editor procura o executável em `%USERPROFILE%\.local\bin\claude.exe` (instalador nativo), em `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` (npm) e no PATH. Se estiver em outro lugar, defina `CLAUDE_BIN` com o caminho completo.
   - Gemini CLI: `gemini --version` e um teste real, `gemini -p "responda ok"`. O editor procura o pacote `@google/gemini-cli` do npm global e o `gemini` no PATH; se estiver em outro lugar, defina `GEMINI_BIN` (caminho do executável ou do `bundle/gemini.js`).
   - Desde 18/06/2026 o Google não aceita mais login com conta pessoal (gratuita, AI Pro ou Ultra) no Gemini CLI: o erro fala em "no longer supported for Gemini Code Assist for individuals". Nesse caso o usuário precisa de uma chave de API criada em https://aistudio.google.com/apikey, salva na variável de ambiente `GEMINI_API_KEY` (no Windows: `setx GEMINI_API_KEY "a-chave"` e abrir um terminal novo) ou em `%USERPROFILE%\.gemini\.env`. Não peça a chave no chat nem a grave em arquivos do projeto: o usuário cola ele mesmo.
5. Atalho (Windows): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\criar-atalho.ps1`. Ele cria "Vitrine" na área de trabalho com o ícone de `scripts/vitrine.ico`. Rodar de novo recria (útil se a pasta mudar de lugar).
6. Teste: abra o atalho (ou `npm run dev`) e confira http://localhost:5180. O título do painel mostra "Assistente Claude" ou "Assistente Gemini" com um ponto verde quando a ponte com a IA está ok; `curl http://localhost:5180/api/ia` mostra o diagnóstico de cada IA.
7. Mostre o guia `COMECE-AQUI.md` para o usuário.

Porta 5180 ocupada: defina `VITRINE_PORT` (vale para `npm run dev` e para o atalho).
Em macOS/Linux não há atalho: use `npm run dev` e abra o endereço no navegador.

## Mapa do código

- `src/ad/` - template da imagem (`AdCanvas.tsx`, `ad.css`). Tamanho lógico 1600x900; a exportação multiplica por 1,5.
- `src/editor/` - painel, explorador de projetos, assistente (`AiPanel.tsx`), convenções de pasta (`useFolderConventions.ts`), recorte e arraste da foto hero.
- `src/engine/` - legenda do WhatsApp (`description.ts`), formatação, contrato com a IA (`aiDraft.ts`, com o JSON Schema e os tipos de status), exportação PNG (`render.ts`), recorte de fundo (`image.ts`), cliente da API local.
- `server/` - API local dentro do servidor do Vite (`bridge.ts`), pastas de projeto (`projects.ts`), CLI `npm run gerar` (`cli.ts`).
- `server/ia.ts` - detecta qual IA está pronta e despacha o pedido; `claude.ts` e `gemini.ts` rodam cada CLI; `aiShared.ts` tem o prompt, as fotos e a execução.
- O Claude recebe o schema por `--json-schema`; o Gemini CLI não tem essa opção, então o schema vai no prompt, as fotos vão como `@foto-N.jpg` e a resposta é validada com o `ajv` (uma nova tentativa se vier fora do formato).
- `prompts/anuncio.md` - regras e tom da IA; mudanças de estilo do texto vão aqui, não no código.
- `scripts/` - atalho do Windows (`criar-atalho.ps1`, `iniciar.ps1`, `servidor.ps1`).
- `Anuncios/<projeto>/` - dados do usuário: `projeto.json`, `imagens/`, `descricao.txt`, `anuncio.png`. Não apague nem sobrescreva sem pedir. A pasta fica fora do git.

## Regras do projeto

- Scripts `.ps1` ficam em UTF-8 com BOM (o PowerShell 5.1 lê sem BOM como ANSI e quebra os acentos).
- `projeto.json` guarda imagens como caminho relativo (`imagens/x.jpg`); o editor converte para URL.
- O editor recarrega o projeto quando o `projeto.json` muda no disco; mesmo assim, ao editar esse arquivo à mão com o editor aberto, avise o usuário.
- Antes de encerrar uma mudança: `npm run typecheck`, `npm test` e `npm run build`.
