# Vitrine - anúncios de venda para grupos de WhatsApp

A Vitrine monta o material de divulgação de um item à venda para postar em grupos de WhatsApp.
Você entrega as fotos e o que sabe do item (preço, estado, o que acompanha, entrega), e ela devolve duas peças prontas para colar no grupo:

- Uma imagem 16:9 (2400x1350) no estilo de cartaz de loja.
- A legenda com a formatação do WhatsApp.

O texto é escrito por uma IA rodando na sua própria máquina, pela CLI que você já usa: o editor chama o `claude -p` (Claude Code) ou o `gemini -p` (Gemini CLI) em modo headless, com as fotos e o prompt de `prompts/anuncio.md`.
Ele descobre sozinho qual está instalado e logado.
Com os dois prontos, um seletor no painel escolhe.
Depois você ajusta à mão no painel ou pede mudanças por texto ("título mais curto", "destaca a garantia").

## O que sai no anúncio

### A imagem

O template usa uma cor de destaque (vermelho, laranja, verde, azul, roxo ou dourado) e organiza o item assim:

- No cabeçalho, um selo chamativo ("VENDE-SE", "BAIXOU!", "OPORTUNIDADE", "TROCO") com o título e o subtítulo.
- O preço em evidência, com o preço anterior riscado quando houver desconto, a forma de pagamento e a condição do item.
- A foto principal no centro, que pode ter o fundo removido para o produto aparecer maior.
- Na coluna da esquerda, os destaques com ícone e uma ênfase colorida (ex.: "Com conformal coating").
- Na coluna da direita, os diferenciais, cada um com a sua foto.
- Embaixo, uma faixa de miniaturas com o que acompanha.
- No rodapé, entrega, local e a chamada final ("Interessados chamar no DM!").

Seção vazia some e o layout se reorganiza, então um anúncio simples (foto, título e preço) também fica bem montado.

### A legenda

A legenda repete as informações da imagem em texto, porque muita gente lê o anúncio pela notificação ou pela busca do grupo sem abrir a foto.
Ela usa emoji como marcador e a formatação nativa do WhatsApp (`*negrito*`, `_itálico_`, `~riscado~`):

```
🔥 *VENDE-SE - Rotor Riot TANQ 2 + DJI O4 Pro*
_FPV 5" 6S - Pronto para voar_

💰 *R$ 3.000* ~R$ 3.200~
💳 Pix ou cartão (juros por conta do comprador)
🏷️ Condição: *Usado - excelente estado*

*Destaques do build*
▪️ FC GEP-F722-HD v2, ESC TAKER H60_BLS 60A - *Com conformal coating*
▪️ DJI O4 Air Unit Pro

*O que acompanha (kit completo)*
📦 1x Jogo de props Gemfan-Vanover 5136
📦 Filtro ND8 Speedybee

🚚 Frete por conta do comprador / Retirada em SP
👉 *Interessados chamar no DM!*
```

### Postando no grupo

O botão "1. Copiar imagem p/ WhatsApp" copia a imagem.
Cole no grupo com Ctrl+V.
O botão vira "2. Copiar descrição": copie e cole no campo de legenda da prévia, e imagem e texto vão juntos numa mensagem só.
São dois cliques porque o WhatsApp descarta o texto quando ele é colado junto com a imagem.

O editor roda no navegador e pode ser hospedado como site estático.
O assistente de IA só funciona rodando local, porque depende do `claude` ou do `gemini` instalado na máquina.
Quem vai só usar, sem mexer no código, deve começar pelo [COMECE-AQUI.md](COMECE-AQUI.md).

## Rodar

```powershell
npm install
npm run dev        # http://localhost:5180 - editor + ponte com a IA
```

### Atalho na área de trabalho

```powershell
powershell -ExecutionPolicy Bypass -File scripts\criar-atalho.ps1
```

Cria o atalho "Vitrine" (ícone em `scripts/vitrine.ico`).
Ao clicar, ele sobe o servidor numa janela minimizada "Vitrine - servidor" se ainda não estiver rodando, e abre o editor no navegador.
A janela tem o "Modo de Edição Rápida" do console desligado: com ele ligado, um clique dentro dela congelava o servidor.
Fechar essa janela desliga o editor.
Se mover a pasta do projeto, rode o script de novo.

### IA: Claude Code ou Gemini CLI

Pelo menos uma das duas precisa estar instalada e logada nesta máquina.
`http://localhost:5180/api/ia` mostra o diagnóstico de cada uma (instalada, login, por que não está pronta).

| Variável | Para que serve |
|---|---|
| `VITRINE_IA` | `claude` ou `gemini`: IA padrão quando as duas estão prontas (sem ela, vale o Claude) |
| `VITRINE_MODEL` | Modelo do Claude (ex.: `sonnet`) |
| `VITRINE_GEMINI_MODEL` | Modelo do Gemini (ex.: `gemini-2.5-pro`) |
| `CLAUDE_BIN` | Caminho do Claude Code, se não estiver no lugar padrão |
| `GEMINI_BIN` | Caminho do Gemini CLI (executável ou `bundle/gemini.js`), se não estiver no lugar padrão |
| `GEMINI_API_KEY` | Chave do Google AI Studio, lida pelo próprio Gemini CLI |

Gemini CLI com conta Google pessoal não funciona mais: desde 18/06/2026 o Google recusa esse login e pede chave de API.
O passo a passo está no [COMECE-AQUI.md](COMECE-AQUI.md).

O Gemini CLI não tem `--json-schema`: o schema vai no prompt, as fotos vão como `@foto-N.jpg` e o servidor valida a resposta com o mesmo schema do Claude, pedindo uma correção se ela vier fora do formato.

## Fluxo

1. "Novo" pede o nome do projeto e cria a pasta `Anuncios/<nome>`.
2. Coloque as fotos do item: solte no Assistente, ou copie direto para `Anuncios/<nome>/imagens` pelo Explorer (elas aparecem sozinhas ao voltar para o editor) e escreva o que souber (preço, estado, o que acompanha, entrega).
3. "Gerar anúncio com as fotos" preenche todas as seções e escolhe qual foto vai onde.
4. Refine à mão no painel ou peça ajustes em texto ("título mais curto", "destaca a garantia").
5. Poste no grupo com os dois botões de cópia (veja "Postando no grupo" acima).
   "Gerar imagem" só grava o `anuncio.png` na pasta.
   "Compartilhar" abre o compartilhamento do sistema.

## Pasta de cada anúncio

Cada anúncio mora em `Anuncios/<nome>/`:

```
Anuncios/tanq/
  projeto.json    todos os campos; imagens como caminho relativo (imagens/x.png)
  imagens/        toda imagem usada: principal, secundárias, ícones, miniaturas, fotos enviadas à IA, recortes
  descricao.txt   legenda do WhatsApp
  anuncio.png     última imagem exportada (Baixar, Copiar, Compartilhar ou Salvar)
```

- A coluna "Projetos" à esquerda lista as pastas de `Anuncios/` (miniatura do último PNG, título, quando foi editado).
  Clicar troca de anúncio.
- Ao trocar, o anúncio atual é gravado na hora, antes de abrir o outro.
  Fechar ou recarregar a aba também grava.
- Abrir um anúncio sem mexer nele não regrava nada.
- O resto é salvo automaticamente enquanto você edita.
  O topo mostra a pasta aberta e o estado ("salvo" ou "salvando").
- "Gerar imagem" grava `anuncio.png` e `descricao.txt` na pasta do projeto.
  "Abrir pasta" mostra o arquivo no Explorer.
- Copiar imagem p/ WhatsApp, Compartilhar e Baixar cópia também atualizam o `anuncio.png` da pasta.
- Se o anúncio ainda não tem pasta (ex.: o Exemplo), ela é criada na primeira imagem adicionada ou ao gerar a imagem, com o nome do título, e as imagens que já estavam no anúncio são copiadas para dentro dela.
- Como os caminhos são relativos, dá para copiar ou renomear a pasta.
  O nome da pasta vira o nome do projeto.
- Imagens trocadas continuam na pasta (nada é apagado automaticamente).
- A seção "Imagens da pasta" mostra tudo o que está em `imagens/` (inclusive fotos copiadas à mão, com qualquer nome), com o uso de cada uma no anúncio.
  Clique numa foto para usá-la como principal, secundária, diferencial ou item do kit, ou use "Distribuir" para preencher principal e secundárias.
- Uma foto chamada `hero` (ex.: `hero.jpg`) em `imagens/` vira a foto principal sozinha, uma vez por arquivo.
  Escolher outra depois não é desfeito.
- Uma foto cujo nome combina com um item do kit ou dos diferenciais ainda sem foto é ligada a ele sozinha: `helice_reserva.png` vai para "1x Jogo de hélices reserva", ignorando acento, plural e palavras como "kit", "jogo" e "1x".
  Nomes genéricos como "WhatsApp Image" não são ligados.
  Também acontece uma vez por arquivo.
- As miniaturas do kit e dos diferenciais mostram a foto inteira, sem cortar.
  A sobra do quadrado é preenchida pela própria foto desfocada.
- Foto hero: no Assistente ela aparece com o selo "Hero" (a estrela em outra foto a troca).
  "Remover fundo" recorta o produto no navegador, corta as bordas vazias e deixa a foto bem maior no anúncio, passando por trás do preço e da faixa de miniaturas.
  "Restaurar original" desfaz.
  O recorte fica salvo em `imagens/principal-recorte-*.png`.
  Na primeira vez o modelo de recorte (~40 MB) é baixado.
- Posicionar a foto hero direto na prévia: arraste para mover, roda do mouse para zoom, duplo clique para centralizar (os mesmos ajustes dos controles de Zoom/Horizontal/Vertical em Imagens).
- Se o `projeto.json` for alterado fora do editor (outra aba, edição à mão, script), o editor recarrega o projeto sozinho.
  Se houver edição sua pendente, mantém a sua e avisa.
- O recorte automático mantém áreas cercadas pelo produto (ex.: a mesa vista por dentro dos aros de um cinewhoop).
  Foto em fundo liso e claro dá o melhor resultado.
- O Assistente usa as fotos da pasta.
  Clique no ✓ de uma foto para deixá-la de fora da geração (máx. 12 por geração).
- Formatos que o navegador não abre (HEIC do iPhone, RAW) são listados com aviso.
  Converta para JPG ou PNG.
- No rodapé do explorador: importar e exportar `.vitrine.json` (imagens embutidas).
  Ao importar, o projeto ganha uma pasta nova.
- O explorador recolhe para uma faixa de miniaturas (botão « no topo dele).

Sem o servidor local (editor hospedado), o anúncio fica só no navegador (IndexedDB).

## Sem abrir o editor

```powershell
npm run gerar -- foto1.jpg foto2.jpg --notas "Drone FPV, R$ 3500, acompanha 1 bateria" --nome tanq2
npm run gerar -- foto1.jpg --notas "..." --ia gemini   # escolhe a IA
```

Cria `Anuncios/<nome>` (ou o nome do título) com as fotos, o projeto e a legenda.
Depois é só abrir no editor e exportar.

## Seções do anúncio

| Seção | Onde aparece |
|---|---|
| Selo, subtítulo, título | Cabeçalho |
| Preço, preço anterior, pagamento, condição | Abaixo do título |
| Imagem principal (esfumada, recortada ou cartão) | Centro |
| Até 2 imagens secundárias | Canto superior esquerdo |
| Destaques (ícone + texto + ênfase colorida) | Coluna esquerda |
| Diferenciais (com foto opcional) | Coluna direita e faixa de miniaturas |
| O que acompanha | Faixa de miniaturas |
| Entrega e local | Rodapé |
| Chamada final | Barra inferior |

Seções vazias somem e o layout se reorganiza.

## Estrutura

- `prompts/anuncio.md` - prompt padrão da IA.
  Edite para mudar o tom e as regras.
- `server/ia.ts` - descobre qual IA está pronta e despacha o pedido.
- `server/claude.ts` - executa `claude -p` com `--json-schema` e só a ferramenta `Read` (as fotos vão para uma pasta temporária).
- `server/gemini.ts` - executa `gemini -p` com as fotos em `@arquivo` e valida a resposta com `ajv`.
- `server/bridge.ts` - API local dentro do servidor do Vite (`/api/ia`, `/api/projetos`, arquivos em `/anuncios/`).
- `server/projects.ts` - leitura e gravação das pastas em `Anuncios/`.
- `src/ad/` - template da imagem (`AdCanvas.tsx`, `ad.css`).
- `src/engine/` - legenda, formatação, contrato com a IA, exportação PNG, remoção de fundo.
- `src/editor/` - painel de edição.

## Testes

```powershell
npm test          # legenda, preço, conversão do rascunho da IA
npm run typecheck
```

## Licença

MIT. Veja [LICENSE.md](LICENSE.md).
