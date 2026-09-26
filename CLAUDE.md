# Vitrine - gerador de anúncios para WhatsApp

Editor local (Vite + React + TypeScript) que monta a imagem de um anúncio de venda (16:9, 2400x1350) e a legenda para grupos de WhatsApp.
A IA roda na própria máquina: o editor chama `claude -p` (Claude Code em modo headless) com o prompt de `prompts/anuncio.md`.
Responda em português do Brasil.

## Instalação (quando o usuário pedir para instalar, configurar ou "criar o atalho")

Siga na ordem e confira cada passo antes do próximo; se algo falhar, explique e resolva antes de seguir.

1. Node.js 22 ou mais novo: `node -v`. Se faltar ou for antigo, peça para instalar a versão LTS de https://nodejs.org (não instale sozinho).
2. Dependências: `npm install` na raiz do projeto.
3. Verificação: `npm run typecheck` e `npm test` precisam passar.
4. Claude Code no terminal: `claude --version`. O editor procura o executável em `%USERPROFILE%\.local\bin\claude.exe` (instalador nativo), em `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` (npm) e no PATH. Se estiver em outro lugar, defina a variável `CLAUDE_BIN` com o caminho completo.
5. Atalho (Windows): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\criar-atalho.ps1`. Ele cria "Vitrine" na área de trabalho com o ícone de `scripts/vitrine.ico`. Rodar de novo recria (útil se a pasta mudar de lugar).
6. Teste: abra o atalho (ou `npm run dev`) e confira http://localhost:5180. O ponto verde em "Assistente Claude" indica que a ponte com o Claude Code está ok.
7. Mostre o guia `COMECE-AQUI.md` para o usuário.

Porta 5180 ocupada: defina `VITRINE_PORT` (vale para `npm run dev` e para o atalho).
Em macOS/Linux não há atalho: use `npm run dev` e abra o endereço no navegador.

## Mapa do código

- `src/ad/` - template da imagem (`AdCanvas.tsx`, `ad.css`). Tamanho lógico 1600x900; a exportação multiplica por 1,5.
- `src/editor/` - painel, explorador de projetos, assistente, convenções de pasta (`useFolderConventions.ts`), recorte e arraste da foto hero.
- `src/engine/` - legenda do WhatsApp (`description.ts`), formatação, conversão para o Claude (`aiDraft.ts`, com o JSON Schema), exportação PNG (`render.ts`), recorte de fundo (`image.ts`), cliente da API local.
- `server/` - API local dentro do servidor do Vite (`bridge.ts`), pastas de projeto (`projects.ts`), execução do `claude -p` (`claude.ts`), CLI `npm run gerar`.
- `prompts/anuncio.md` - regras e tom do Claude; mudanças de estilo do texto vão aqui, não no código.
- `scripts/` - atalho do Windows (`criar-atalho.ps1`, `iniciar.ps1`, `servidor.ps1`).
- `Anuncios/<projeto>/` - dados do usuário: `projeto.json`, `imagens/`, `descricao.txt`, `anuncio.png`. Não apague nem sobrescreva sem pedir.

## Regras do projeto

- Scripts `.ps1` ficam em UTF-8 com BOM (o PowerShell 5.1 lê sem BOM como ANSI e quebra os acentos).
- `projeto.json` guarda imagens como caminho relativo (`imagens/x.jpg`); o editor converte para URL.
- O editor recarrega o projeto quando o `projeto.json` muda no disco; mesmo assim, ao editar esse arquivo à mão com o editor aberto, avise o usuário.
- Antes de encerrar uma mudança: `npm run typecheck`, `npm test` e `npm run build`.
