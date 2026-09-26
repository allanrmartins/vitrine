# Vitrine - anúncios para WhatsApp

Editor de imagens de anúncio (16:9, 2400x1350) com legenda pronta para grupos de WhatsApp.
O editor roda no navegador e pode ser hospedado como site estático.
Rodando local, ele ganha o Assistente Claude, que chama o `claude -p` com um prompt padrão para montar ou ajustar o anúncio.

## Rodar

```powershell
npm install
npm run dev        # http://localhost:5180 - editor + ponte com o Claude Code
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

O Claude Code precisa estar instalado e logado nesta máquina.
Para fixar o modelo, defina `VITRINE_MODEL` (ex.: `$env:VITRINE_MODEL = 'sonnet'`) antes do `npm run dev`.
Se o executável estiver em outro lugar, aponte com `CLAUDE_BIN`.

## Fluxo

1. "Novo" pede o nome do projeto e cria a pasta `Anuncios/<nome>`.
2. Coloque as fotos do item: solte no Assistente Claude, ou copie direto para `Anuncios/<nome>/imagens` pelo Explorer (elas aparecem sozinhas ao voltar para o editor) e escreva o que souber (preço, estado, o que acompanha, entrega).
3. "Gerar anúncio com as fotos" preenche todas as seções e escolhe qual foto vai onde.
4. Refine à mão no painel ou peça ajustes em texto ("título mais curto", "destaca a garantia").
5. "1. Copiar imagem p/ WhatsApp" copia a imagem; cole no grupo com Ctrl+V.
   O botão vira "2. Copiar descrição": clique e cole no campo de legenda da prévia da imagem, para ir tudo numa mensagem só.
   (O WhatsApp ignora texto colado junto com imagem, por isso são dois cliques.)
   "Gerar imagem" só grava o `anuncio.png` na pasta; "Compartilhar" abre o compartilhamento do sistema.
6. Copie a descrição gerada; ela usa `*negrito*`, `_itálico_` e `~riscado~` do WhatsApp.

## Pasta de cada anúncio

Cada anúncio mora em `Anuncios/<nome>/`:

```
Anuncios/tanq/
  projeto.json    todos os campos; imagens como caminho relativo (imagens/x.png)
  imagens/        toda imagem usada: principal, secundárias, ícones, miniaturas, fotos enviadas ao Claude, recortes
  descricao.txt   legenda do WhatsApp
  anuncio.png     última imagem exportada (Baixar, Copiar, Compartilhar ou Salvar)
```

- A coluna "Projetos" à esquerda lista as pastas de `Anuncios/` (miniatura do último PNG, título, quando foi editado); clicar troca de anúncio.
- Ao trocar, o anúncio atual é gravado na hora, antes de abrir o outro; fechar ou recarregar a aba também grava.
- Abrir um anúncio sem mexer nele não regrava nada.
- O resto é salvo automaticamente enquanto você edita; o topo mostra a pasta aberta e o estado ("salvo", "salvando...").
- "Gerar imagem" grava `anuncio.png` e `descricao.txt` na pasta do projeto; "Abrir pasta" mostra o arquivo no Explorer.
- Copiar imagem p/ WhatsApp, Compartilhar e Baixar cópia também atualizam o `anuncio.png` da pasta.
- Se o anúncio ainda não tem pasta (ex.: o Exemplo), ela é criada na primeira imagem adicionada ou ao gerar a imagem, com o nome do título, e as imagens que já estavam no anúncio são copiadas para dentro dela.
- Como os caminhos são relativos, dá para copiar ou renomear a pasta; o nome da pasta vira o nome do projeto.
- Imagens trocadas continuam na pasta (nada é apagado automaticamente).
- A seção "Imagens da pasta" mostra tudo o que está em `imagens/` (inclusive fotos copiadas à mão, com qualquer nome), com o uso de cada uma no anúncio; clique numa foto para usá-la como principal, secundária, diferencial ou item do kit, ou use "Distribuir" para preencher principal e secundárias.
- Uma foto chamada `hero` (ex.: `hero.jpg`) em `imagens/` vira a foto principal sozinha (uma vez por arquivo; escolher outra depois não é desfeito).
- Uma foto cujo nome combina com um item do kit ou dos diferenciais ainda sem foto é ligada a ele sozinha: `helice_reserva.png` vai para "1x Jogo de hélices reserva" (ignora acento, plural e palavras como "kit", "jogo", "1x"; nomes genéricos como "WhatsApp Image..." não são ligados). Também uma vez por arquivo.
- As miniaturas do kit e dos diferenciais mostram a foto inteira, sem cortar; a sobra do quadrado é preenchida pela própria foto desfocada.
- Foto hero: no Assistente ela aparece com o selo "Hero" (a estrela em outra foto a troca). "Remover fundo" recorta o produto no navegador, corta as bordas vazias e deixa a foto bem maior no anúncio, passando por trás do preço e da faixa de miniaturas; "Restaurar original" desfaz. O recorte fica salvo em `imagens/principal-recorte-*.png`. Na primeira vez o modelo de recorte (~40 MB) é baixado.
- Posicionar a foto hero direto na prévia: arraste para mover, roda do mouse para zoom, duplo clique para centralizar (os mesmos ajustes dos controles de Zoom/Horizontal/Vertical em Imagens).
- Se o `projeto.json` for alterado fora do editor (outra aba, edição à mão, script), o editor recarrega o projeto sozinho; se houver edição sua pendente, mantém a sua e avisa.
- O recorte automático mantém áreas cercadas pelo produto (ex.: a mesa vista por dentro dos aros de um cinewhoop); foto em fundo liso e claro dá o melhor resultado.
- O Assistente usa as fotos da pasta; clique no ✓ de uma foto para deixá-la de fora da geração (máx. 12 por geração).
- Formatos que o navegador não abre (HEIC do iPhone, RAW) são listados com aviso; converta para JPG ou PNG.
- No rodapé do explorador: importar e exportar `.vitrine.json` (imagens embutidas); ao importar, o projeto ganha uma pasta nova.
- O explorador recolhe para uma faixa de miniaturas (botão « no topo dele).

Sem o servidor local (editor hospedado), o anúncio fica só no navegador (IndexedDB).

## Sem abrir o editor

```powershell
npm run gerar -- foto1.jpg foto2.jpg --notas "Drone FPV, R$ 3500, acompanha 1 bateria" --nome tanq2
```

Cria `Anuncios/<nome>` (ou o nome do título) com as fotos, o projeto e a legenda; depois é só abrir no editor e exportar.

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

- `prompts/anuncio.md` - prompt padrão do Claude; edite para mudar o tom e as regras.
- `server/claude.ts` - executa `claude -p` com `--json-schema` e só a ferramenta `Read` (as fotos vão para uma pasta temporária).
- `server/bridge.ts` - API local dentro do servidor do Vite (`/api/claude`, `/api/projetos`, arquivos em `/anuncios/`).
- `server/projects.ts` - leitura e gravação das pastas em `Anuncios/`.
- `src/ad/` - template da imagem (`AdCanvas.tsx`, `ad.css`).
- `src/engine/` - legenda, formatação, conversão para o Claude, exportação PNG, remoção de fundo.
- `src/editor/` - painel de edição.

## Testes

```powershell
npm test          # legenda, preço, conversão do rascunho da IA
npm run typecheck
```

## Licença

MIT. Veja [LICENSE.md](LICENSE.md).
