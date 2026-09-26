# Vitrine - comece aqui

A Vitrine monta anúncios de venda prontos para grupos de WhatsApp: uma imagem caprichada (16:9) e a descrição formatada.
Você coloca as fotos, conta sobre o item, e o Claude preenche o anúncio; depois você ajusta o que quiser.
Tudo roda no seu computador e cada anúncio fica numa pasta própria.

## 1. Instalar (uma vez)

Você precisa de três coisas:

- Windows 10 ou 11 (para o atalho; em Mac/Linux funciona pelo terminal, veja o fim do guia).
- Node.js 22 ou mais novo: baixe a versão LTS em https://nodejs.org e instale com as opções padrão.
- Claude Code instalado e logado (o comando `claude` funcionando no terminal).

Com isso pronto:

1. Descompacte o zip numa pasta fixa, por exemplo `C:\Vitrine` (não deixe em Downloads, porque o atalho aponta para essa pasta).
2. Abra essa pasta no Claude Code e peça: **"instale a Vitrine e crie o atalho na área de trabalho"**.
3. O Claude instala as dependências, testa e cria o atalho **Vitrine** (ícone de etiqueta amarela).

Se preferir fazer à mão, no PowerShell dentro da pasta:

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\criar-atalho.ps1
```

## 2. Abrir e fechar

- Clique no atalho **Vitrine**: ele liga o servidor numa janela minimizada chamada "Vitrine - servidor" e abre o editor no navegador (http://localhost:5180).
- Fechar só o navegador não desliga nada; clique no atalho de novo para voltar.
- Para desligar de vez, feche a janela "Vitrine - servidor".
- Com o servidor desligado o editor não salva (o topo mostra "erro ao salvar").

## 3. Seu primeiro anúncio (5 minutos)

1. Na coluna **Projetos** (esquerda), clique em **Novo anúncio** e dê um nome (ex.: "iphone 13").
   Isso cria a pasta `Anuncios\iphone-13\`.
2. Coloque as fotos do item de um destes jeitos:
   - arraste para a área "Fotos do item" no **Assistente Claude**; ou
   - copie direto para `Anuncios\iphone-13\imagens\` pelo Explorer (aparecem sozinhas quando você volta ao navegador).
3. Na caixa de texto do Assistente, conte o que souber: preço, estado, tempo de uso, o que acompanha, cidade, forma de entrega.
4. Clique em **Gerar anúncio com N fotos**.
   Em uns 30 segundos o anúncio aparece preenchido; o Claude escolhe qual foto vai onde e avisa o que faltou.
5. Confira e ajuste (próxima seção).
6. Clique em **1. Copiar imagem p/ WhatsApp**, cole no grupo (Ctrl+V).
   O botão vira **2. Copiar descrição**: clique, cole no campo de legenda da imagem e envie.

## 4. Ajustar o anúncio

- **Pedir ao Claude**: no campo "Ajuste" escreva, por exemplo, "título mais curto" ou "destaca que tem garantia" e clique em Ajustar. Só aquilo muda; "Desfazer" volta.
- **À mão**: todas as seções do painel são editáveis (cabeçalho, preço, condição, destaques, diferenciais, o que acompanha, entrega, cores).
- **Dois preços** (ex.: com e sem acessórios): em "Valor e condição" preencha "Rótulo do preço", "Segundo preço" e "Rótulo do 2º preço".
- **Cores**: em "Chamada e cores" há 6 combinações prontas ou cor livre.
- **Descrição**: é gerada dos campos; se você editar o texto à mão, ela para de acompanhar os campos ("Regenerar" volta ao automático).

## 5. A foto principal (hero)

A foto grande no centro faz o anúncio; vale caprichar.

- A foto principal aparece com o selo **HERO** no Assistente; a estrela em outra foto troca qual é a principal.
- **Remover fundo**: recorta o produto, corta as bordas vazias e deixa a foto bem maior, passando por trás do preço. Na primeira vez baixa um modelo de uns 40 MB. "Restaurar original" desfaz.
- **Posicionar**: na prévia, arraste a foto para mover, use a roda do mouse para zoom e dê duplo clique para centralizar.
- Melhor resultado: produto inteiro, de frente, sobre fundo liso e claro. Áreas cercadas pelo produto (ex.: a mesa vista por dentro de um aro) podem ficar no recorte.

## 6. Truques de nome de arquivo

Copiando fotos para a pasta `imagens\` do projeto:

- Uma foto chamada **`hero.jpg`** vira a foto principal sozinha.
- Uma foto com o nome parecido com um item do kit ou dos diferenciais entra nele sozinha, se o item ainda não tem foto: `helice_reserva.png` vai para "1x Jogo de hélices reserva" (acento e plural não importam).
- Na seção **Imagens da pasta** do painel você vê todas as fotos, onde cada uma está sendo usada, e coloca qualquer uma como principal, secundária, diferencial ou item do kit com um clique.
- Formatos que o navegador não abre (HEIC do iPhone) aparecem com aviso: converta para JPG.

## 7. Onde fica cada coisa

```
Anuncios\iphone-13\
  projeto.json    o anúncio (textos, escolhas de foto, ajustes)
  imagens\        todas as fotos usadas, inclusive recortes
  descricao.txt   a legenda do WhatsApp
  anuncio.png     a imagem final (atualiza ao clicar em Gerar imagem ou Copiar)
```

- Tudo salva sozinho: meio segundo depois de cada alteração, e também ao trocar de projeto ou fechar a aba. O topo mostra "salvo".
- O `anuncio.png` só é regravado quando você gera ou copia a imagem.
- Dá para copiar ou renomear a pasta de um anúncio; o editor encontra de novo.

## 8. Quanto custa

A geração usa o seu Claude Code (a sua assinatura ou conta da API).
Um anúncio gerado do zero fica em torno de US$ 0,20 a US$ 0,35 em uso de API; um ajuste, uns US$ 0,10.
O editor, o recorte de fundo e a exportação não custam nada.

## 9. Se algo der errado

- **Ponto do Assistente cinza / "Assistente Claude indisponível"**: o editor não foi aberto pelo atalho ou `npm run dev`, ou o Claude Code não foi encontrado. Rode `claude --version` no terminal; se funcionar e o editor não achar, peça ao Claude Code para definir `CLAUDE_BIN`.
- **"erro ao salvar"**: a janela "Vitrine - servidor" foi fechada. Clique no atalho de novo.
- **O editor não abre (porta 5180 ocupada)**: outra coisa usa a porta. Peça ao Claude Code para configurar `VITRINE_PORT`.
- **Mudei a pasta de lugar e o atalho parou**: rode de novo `scripts\criar-atalho.ps1` (ou peça ao Claude Code).
- **Qualquer outra coisa**: abra a pasta no Claude Code e descreva o problema; o `CLAUDE.md` explica o projeto para ele.

## Mac ou Linux

Não há atalho: no terminal, dentro da pasta, rode `npm install` uma vez e depois `npm run dev`, e abra http://localhost:5180.
