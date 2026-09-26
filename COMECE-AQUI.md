# Vitrine - comece aqui

A Vitrine monta anúncios de venda prontos para grupos de WhatsApp: uma imagem 16:9 no estilo de cartaz de loja e a descrição já formatada.
Você coloca as fotos, conta sobre o item, e a IA preenche o anúncio.
Depois você ajusta o que quiser.
Tudo roda no seu computador e cada anúncio fica numa pasta própria.

A IA pode ser o **Claude Code** ou o **Gemini CLI**, o que você já usa.
A Vitrine descobre sozinha qual está instalado e logado.
Se tiver os dois, dá para escolher no editor.

Código: https://github.com/allanrmartins/vitrine

## 1. O que você precisa

- Windows 10 ou 11 para ter o atalho na área de trabalho (em Mac/Linux funciona pelo terminal, veja o fim do guia).
- Node.js 22 ou mais novo: baixe a versão LTS em https://nodejs.org e instale com as opções padrão.
- Uma das duas IAs no terminal, com login feito (próxima seção).

## 2. Deixar a IA pronta

Faça só a parte da IA que você usa.

### Se você usa o Claude Code

1. Confira no terminal: `claude --version`.
   Se não existir, instale seguindo https://claude.com/claude-code.
2. Confira o login: `claude auth status` tem que mostrar `"loggedIn": true`.
   Se não, rode `claude` uma vez e entre na sua conta.

### Se você usa o Gemini CLI

1. Confira no terminal: `gemini --version`.
   Se não existir, instale com `npm install -g @google/gemini-cli`.
2. Faça um teste de verdade: `gemini -p "responda ok"`.
   Se responder, pule para a seção 3.
3. Se aparecer um erro falando em **"no longer supported for Gemini Code Assist for individuals"**: desde 18/06/2026 o Google não aceita mais login com conta pessoal no Gemini CLI (vale para a conta gratuita, AI Pro e Ultra).
   A saída é usar uma chave de API:
   1. Entre em https://aistudio.google.com/apikey com a sua conta Google e clique em **Create API key**.
   2. Copie a chave e salve no Windows, no PowerShell (troque pela sua chave):

      ```powershell
      setx GEMINI_API_KEY "cole-a-chave-aqui"
      ```

   3. Feche e abra o terminal de novo (a variável só vale em janelas novas).
   4. Rode `gemini`, digite `/auth` e escolha **Use Gemini API Key**.
      Esse passo é obrigatório se você já entrava com a conta Google: o Gemini CLI guarda essa escolha e continua tentando a conta Google mesmo com a chave salva.
   5. Saia do `gemini` e repita o teste `gemini -p "responda ok"`.

   Guarde a chave só para você: não mande para ninguém e não cole em arquivos do projeto.

## 3. Baixar e instalar a Vitrine

O jeito mais fácil é deixar a sua IA fazer tudo.
Abra o terminal numa pasta fixa (por exemplo `C:\`, não em Downloads, porque o atalho aponta para lá), rode `claude` ou `gemini` e peça:

> Clone https://github.com/allanrmartins/vitrine em C:\Vitrine, instale seguindo o AGENTS.md do projeto e crie o atalho na área de trabalho.

A IA baixa o código, instala as dependências, roda os testes, confere se a IA está logada e cria o atalho **Vitrine** (ícone de etiqueta amarela).
Ela pede sua permissão antes de cada comando: pode aceitar.

Sem o Git instalado, baixe o zip: na página do repositório clique em **Code > Download ZIP** e descompacte em `C:\Vitrine`.
Depois abra o terminal dentro de `C:\Vitrine`, rode `claude` ou `gemini` e peça: **"instale a Vitrine e crie o atalho na área de trabalho"**.

Se preferir fazer à mão, no PowerShell dentro da pasta:

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\criar-atalho.ps1
```

## 4. Abrir e fechar

- Clique no atalho **Vitrine**: ele liga o servidor numa janela minimizada chamada "Vitrine - servidor" e abre o editor no navegador (http://localhost:5180).
- No painel da esquerda, o título mostra **Assistente Claude** ou **Assistente Gemini** com um ponto verde: é a IA que vai ser usada.
  Com as duas prontas, aparece um seletor ao lado para trocar.
- Fechar só o navegador não desliga nada.
  Clique no atalho de novo para voltar.
- Para desligar de vez, feche a janela "Vitrine - servidor".
- Com o servidor desligado o editor não salva (o topo mostra "erro ao salvar").

## 5. Seu primeiro anúncio (5 minutos)

1. Na coluna **Projetos** (esquerda), clique em **Novo anúncio** e dê um nome (ex.: "iphone 13").
   Isso cria a pasta `Anuncios\iphone-13\`.
2. Coloque as fotos do item de um destes jeitos:
   - arraste para a área "Fotos do item" no **Assistente**, ou
   - copie direto para `Anuncios\iphone-13\imagens\` pelo Explorer (aparecem sozinhas quando você volta ao navegador).
3. Na caixa de texto do Assistente, conte o que souber: preço, estado, tempo de uso, o que acompanha, cidade, forma de entrega.
4. Clique em **Gerar anúncio com N fotos**.
   Em menos de um minuto o anúncio aparece preenchido.
   A IA escolhe qual foto vai onde e avisa o que faltou.
5. Confira e ajuste (próxima seção).
6. Clique em **1. Copiar imagem p/ WhatsApp**, cole no grupo (Ctrl+V).
   O botão vira **2. Copiar descrição**: clique, cole no campo de legenda da imagem e envie.

## 6. Ajustar o anúncio

- **Pedir à IA**: no campo "Ajuste" escreva, por exemplo, "título mais curto" ou "destaca que tem garantia" e clique em Ajustar.
  Só aquilo muda, e "Desfazer" volta.
- **À mão**: todas as seções do painel são editáveis (cabeçalho, preço, condição, destaques, diferenciais, o que acompanha, entrega, cores).
- **Dois preços** (ex.: com e sem acessórios): em "Valor e condição" preencha "Rótulo do preço", "Segundo preço" e "Rótulo do 2º preço".
- **Cores**: em "Chamada e cores" há 6 combinações prontas ou cor livre.
- **Descrição**: é gerada dos campos.
  Se você editar o texto à mão, ela para de acompanhar os campos ("Regenerar" volta ao automático).

## 7. A foto principal (hero)

A foto grande no centro faz o anúncio, então capriche nela.

- A foto principal aparece com o selo **HERO** no Assistente.
  A estrela em outra foto troca qual é a principal.
- **Remover fundo**: recorta o produto, corta as bordas vazias e deixa a foto bem maior, passando por trás do preço. Na primeira vez baixa um modelo de uns 40 MB. "Restaurar original" desfaz.
- **Posicionar**: na prévia, arraste a foto para mover, use a roda do mouse para zoom e dê duplo clique para centralizar.
- Melhor resultado: produto inteiro, de frente, sobre fundo liso e claro. Áreas cercadas pelo produto (ex.: a mesa vista por dentro de um aro) podem ficar no recorte.

## 8. Truques de nome de arquivo

Copiando fotos para a pasta `imagens\` do projeto:

- Uma foto chamada **`hero.jpg`** vira a foto principal sozinha.
- Uma foto com o nome parecido com um item do kit ou dos diferenciais entra nele sozinha, se o item ainda não tem foto: `helice_reserva.png` vai para "1x Jogo de hélices reserva" (acento e plural não importam).
- Na seção **Imagens da pasta** do painel você vê todas as fotos, onde cada uma está sendo usada, e coloca qualquer uma como principal, secundária, diferencial ou item do kit com um clique.
- Formatos que o navegador não abre (HEIC do iPhone) aparecem com aviso: converta para JPG.

## 9. Onde fica cada coisa

```
Anuncios\iphone-13\
  projeto.json    o anúncio (textos, escolhas de foto, ajustes)
  imagens\        todas as fotos usadas, inclusive recortes
  descricao.txt   a legenda do WhatsApp
  anuncio.png     a imagem final (atualiza ao clicar em Gerar imagem ou Copiar)
```

- Tudo salva sozinho: meio segundo depois de cada alteração, e também ao trocar de projeto ou fechar a aba. O topo mostra "salvo".
- O `anuncio.png` só é regravado quando você gera ou copia a imagem.
- Dá para copiar ou renomear a pasta de um anúncio.
  O editor encontra de novo.

## 10. Quanto custa

O editor, o recorte de fundo e a exportação não custam nada.
Só a geração de texto usa a IA.

- **Claude Code**: usa a sua assinatura Claude ou a sua conta da API.
  Na API, um anúncio gerado do zero fica em torno de US$ 0,20 a US$ 0,35 e um ajuste uns US$ 0,10.
  O editor mostra o valor de cada geração.
- **Gemini CLI com chave de API**: a cobrança segue o plano da chave no Google AI Studio (https://aistudio.google.com).
  O editor não mostra o custo das gerações com o Gemini.
  Acompanhe o uso pelo AI Studio.

## 11. Se algo der errado

- **"Nenhuma IA pronta nesta máquina"**: o painel lista o que falta em cada IA (não instalada, sem login, chave recusada).
  Resolva no terminal seguindo a seção 2 e clique em **Verificar de novo**.
- **Gemini: "O Google não aceita mais login com conta pessoal"**: siga o passo 3 do Gemini na seção 2 (chave de API e troca do login com `/auth`).
- **Criei a chave, mas o editor ainda não vê**: a variável `GEMINI_API_KEY` só vale para programas abertos depois do `setx`.
  Feche a janela "Vitrine - servidor" e abra o atalho de novo.
- **Ponto do Assistente cinza / "Assistente de IA indisponível"**: o editor não foi aberto pelo atalho ou pelo `npm run dev`.
- **A IA está instalada, mas o editor não acha**: peça à sua IA para definir `CLAUDE_BIN` ou `GEMINI_BIN` com o caminho do executável.
- **Quero usar o Gemini mesmo tendo o Claude**: escolha no seletor do painel, ou defina `VITRINE_IA=gemini` para virar o padrão.
- **"erro ao salvar"**: a janela "Vitrine - servidor" foi fechada. Clique no atalho de novo.
- **O editor não abre (porta 5180 ocupada)**: outra coisa usa a porta. Peça à sua IA para configurar `VITRINE_PORT`.
- **Mudei a pasta de lugar e o atalho parou**: rode de novo `scripts\criar-atalho.ps1` (ou peça à sua IA).
- **Qualquer outra coisa**: abra a pasta no Claude Code ou no Gemini CLI e descreva o problema.
  O `AGENTS.md` explica o projeto para os dois.

## Mac ou Linux

Não há atalho: no terminal, dentro da pasta, rode `npm install` uma vez e depois `npm run dev`, e abra http://localhost:5180.
Para a chave do Gemini, use `export GEMINI_API_KEY="a-chave"` no seu `~/.zshrc` ou `~/.bashrc`, ou grave `GEMINI_API_KEY=a-chave` em `~/.gemini/.env`.
