# Instalador da Vitrine para Windows, para quem nunca usou terminal. Numa janela do PowerShell:
#
#   irm https://raw.githubusercontent.com/allanrmartins/vitrine/main/scripts/instalar.ps1 | iex
#
# Instala o Node.js se faltar, baixa a Vitrine, prepara a IA (Claude Code já logado, ou Gemini CLI com chave de
# API), cria o atalho na área de trabalho e abre o editor. Rodar de novo atualiza a Vitrine sem mexer nos anúncios.
#
# Este arquivo fica em UTF-8 SEM BOM (ao contrário dos outros .ps1): o `irm | iex` entrega o BOM como texto e
# quebra a primeira linha. Ele não é feito para rodar com -File.
#
# Variáveis opcionais: VITRINE_PASTA (onde instalar), VITRINE_ORIGEM (URL ou caminho de um .zip do código) e
# VITRINE_SIMULAR=1 (teste: baixa e instala as dependências, mas não instala programas, não grava a chave nem o
# login do Gemini fora da pasta e não cria o atalho).

& {
    $ErrorActionPreference = 'Stop'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue' # a barra de progresso deixa o Invoke-WebRequest muito lento no 5.1

    $pasta = if ($env:VITRINE_PASTA) { $env:VITRINE_PASTA } else { Join-Path $env:USERPROFILE 'Vitrine' }
    $origem = if ($env:VITRINE_ORIGEM) { $env:VITRINE_ORIGEM } else { 'https://github.com/allanrmartins/vitrine/archive/refs/heads/main.zip' }
    $simular = $env:VITRINE_SIMULAR -eq '1'
    $geminiDir = if ($simular) { Join-Path $pasta '.gemini-simulado' } else { Join-Path $env:USERPROFILE '.gemini' }

    function Titulo([string]$texto) { Write-Host ''; Write-Host "== $texto" -ForegroundColor Cyan }
    function Ok([string]$texto) { Write-Host "   OK  $texto" -ForegroundColor Green }
    function Aviso([string]$texto) { Write-Host "   $texto" -ForegroundColor Yellow }
    function Falha([string]$texto) {
        Write-Host ''
        Write-Host "   $texto" -ForegroundColor Red
        Write-Host '   Nada foi desfeito: corrija o problema e cole o mesmo comando de novo.' -ForegroundColor Red
        throw 'VITRINE_PARAR'
    }
    function Simulado([string]$texto) { Write-Host "   [simulação] pularia: $texto" -ForegroundColor DarkGray }
    function Pergunta([string]$texto, [bool]$padraoSim) {
        $sufixo = if ($padraoSim) { '(S/n)' } else { '(s/N)' }
        $r = (Read-Host "   $texto $sufixo").Trim().ToLower()
        if ($r -eq '') { return $padraoSim }
        return $r.StartsWith('s')
    }

    # PATH desta janela com o que os instaladores acabaram de gravar no registro.
    function Atualizar-Path {
        $maquina = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $usuario = [Environment]::GetEnvironmentVariable('Path', 'User')
        $env:Path = "$maquina;$usuario;$env:APPDATA\npm"
    }

    function Versao-Node {
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $node) { return 0 }
        $v = (& $node.Source -v) -replace '^v', ''
        return [int]($v.Split('.')[0])
    }

    # Programas do npm são chamados pelo .cmd: o .ps1 que o npm também cria é bloqueado pela política padrão.
    function Npm { & npm.cmd @args; if ($LASTEXITCODE -ne 0) { Falha "O comando 'npm $($args -join ' ')' falhou (veja as mensagens acima)." } }

    # $true = aceita, $false = recusada pelo Google; sem resposta do Google (internet, firewall), para com a mensagem.
    function Chave-Valida([string]$chave) {
        try {
            Invoke-RestMethod -Uri 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' -Headers @{ 'x-goog-api-key' = $chave } | Out-Null
            return $true
        } catch [System.Net.WebException] {
            $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            if ($status -in 400, 401, 403) { return $false }
            Falha "Não consegui falar com o Google para conferir a chave ($($_.Exception.Message)). Confira a internet e tente de novo."
        }
    }

    function Ler-Chave {
        Write-Host ''
        Write-Host '   A Vitrine usa o Gemini com uma chave de API do Google (grátis para criar).' -ForegroundColor White
        Write-Host '   Vou abrir a página do Google AI Studio no navegador. Lá:'
        Write-Host '     1. Entre com a sua conta Google, se ele pedir.'
        Write-Host '     2. Clique em "Create API key" (Criar chave de API) e aceite os termos, se aparecerem.'
        Write-Host '     3. Copie a chave (o botão de copiar fica ao lado dela).'
        Write-Host '   A chave é como uma senha: não mande para ninguém.' -ForegroundColor Yellow
        Read-Host '   Aperte Enter para abrir a página' | Out-Null
        Start-Process 'https://aistudio.google.com/apikey'
        while ($true) {
            Write-Host ''
            $seguro = Read-Host '   Cole a chave aqui (clique com o botão direito para colar; ela não aparece na tela) e aperte Enter' -AsSecureString
            $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
            try { $chave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
            if (-not $chave) { Aviso 'Nada foi colado. Tente de novo.'; continue }
            Write-Host '   Conferindo a chave com o Google...'
            if (Chave-Valida $chave) { Ok 'Chave aceita pelo Google.'; return $chave }
            Aviso 'O Google recusou essa chave. Confira se copiou ela inteira (começa com "AIza") e cole de novo.'
        }
    }

    # O Gemini CLI guarda no settings.json qual login usar; sem "gemini-api-key" ele continua tentando a conta Google.
    function Usar-Chave-No-Gemini {
        New-Item -ItemType Directory -Force $geminiDir | Out-Null
        $arquivo = Join-Path $geminiDir 'settings.json'
        $cfg = New-Object PSObject
        if (Test-Path $arquivo) {
            Copy-Item $arquivo "$arquivo.antes-da-vitrine" -Force
            $texto = [IO.File]::ReadAllText($arquivo)
            try {
                if ($texto.Trim()) { $cfg = $texto | ConvertFrom-Json }
            } catch {
                # JSON com comentários ou quebrado: recomeça do zero (a cópia .antes-da-vitrine guarda o original).
                Aviso "Não consegui ler $arquivo; ele foi guardado em settings.json.antes-da-vitrine e recriado."
                $cfg = New-Object PSObject
            }
        }
        if (-not $cfg.PSObject.Properties['security']) { $cfg | Add-Member security (New-Object PSObject) }
        if (-not $cfg.security.PSObject.Properties['auth']) { $cfg.security | Add-Member auth (New-Object PSObject) }
        if ($cfg.security.auth.PSObject.Properties['selectedType']) { $cfg.security.auth.selectedType = 'gemini-api-key' }
        else { $cfg.security.auth | Add-Member selectedType 'gemini-api-key' }
        [IO.File]::WriteAllText($arquivo, ($cfg | ConvertTo-Json -Depth 32), (New-Object Text.UTF8Encoding $false))
        Ok "Gemini CLI configurado para usar a chave ($arquivo)."
    }

    function Testar-Gemini {
        Write-Host '   Fazendo uma pergunta de teste ao Gemini (leva alguns segundos)...'
        $ErrorActionPreference = 'Continue' # stderr de programa externo com 2>&1 vira erro no PowerShell 5.1
        Push-Location $env:TEMP
        try { $saida = (& gemini.cmd -p 'Responda apenas: ok' --output-format json --skip-trust 2>&1) -join "`n" } finally { Pop-Location }
        if ($LASTEXITCODE -eq 0 -and $saida -match '"response"') { Ok 'O Gemini respondeu.'; return }
        Write-Host $saida
        Falha 'O Gemini CLI não respondeu direito ao teste (mensagem acima).'
    }

    function Claude-Pronto {
        $ErrorActionPreference = 'Continue'
        $exe = @(
            (Join-Path $env:USERPROFILE '.local\bin\claude.exe'),
            (Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe')
        ) | Where-Object { Test-Path $_ } | Select-Object -First 1
        if (-not $exe) { $exe = (Get-Command claude.exe -ErrorAction SilentlyContinue).Source }
        if (-not $exe) { return $false }
        try { return [bool]((& $exe auth status 2>$null | Out-String | ConvertFrom-Json).loggedIn) } catch { return $false }
    }

    try {
        Write-Host ''
        Write-Host '  Vitrine - instalador' -ForegroundColor White
        Write-Host "  Pasta: $pasta"
        if ($simular) { Write-Host '  MODO SIMULAÇÃO' -ForegroundColor Magenta }

        # 1. Node.js -------------------------------------------------------------------------------------------
        Titulo '1/5 Node.js'
        Atualizar-Path
        if ((Versao-Node) -ge 22) {
            Ok "Node.js $(& node.exe -v) já instalado."
        } elseif ($simular) {
            Simulado 'instalar o Node.js LTS com o winget'
        } else {
            if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
                Start-Process 'https://nodejs.org'
                Falha 'Instale o Node.js pelo site que abriu (botão da versão LTS, opções padrão) e depois cole o comando de novo.'
            }
            Aviso 'Instalando o Node.js. Se o Windows perguntar se permite alterações, clique em Sim.'
            & winget.exe install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
            Atualizar-Path
            if ((Versao-Node) -lt 22) { Falha 'O Node.js não ficou disponível. Feche esta janela, abra o PowerShell de novo e cole o comando outra vez.' }
            Ok "Node.js $(& node.exe -v) instalado."
        }

        # 2. Código da Vitrine ---------------------------------------------------------------------------------
        Titulo '2/5 Baixando a Vitrine'
        $tmp = Join-Path $env:TEMP ("vitrine-" + [guid]::NewGuid().ToString('n').Substring(0, 8))
        New-Item -ItemType Directory -Force $tmp | Out-Null
        try {
            $zip = Join-Path $tmp 'vitrine.zip'
            if ($origem -match '^https?://') { Invoke-WebRequest $origem -OutFile $zip -UseBasicParsing } else { Copy-Item $origem $zip }
            Expand-Archive $zip (Join-Path $tmp 'x') -Force
            $raiz = Get-ChildItem (Join-Path $tmp 'x') -Directory | Select-Object -First 1
            $novo = -not (Test-Path (Join-Path $pasta 'package.json'))
            New-Item -ItemType Directory -Force $pasta | Out-Null
            # Por cima da versão antiga: Anuncios/ não vem no zip, então os anúncios ficam intactos.
            Copy-Item (Join-Path $raiz.FullName '*') $pasta -Recurse -Force
        } finally {
            Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($novo) { Ok "Vitrine baixada em $pasta." } else { Ok "Vitrine atualizada em $pasta (seus anúncios continuam lá)." }

        Push-Location $pasta
        try {
            Write-Host '   Instalando as peças do editor (pode levar alguns minutos)...'
            Npm install --no-fund --no-audit --loglevel=error
        } finally { Pop-Location }
        Ok 'Editor pronto.'

        # 3. IA --------------------------------------------------------------------------------------------------
        Titulo '3/5 Inteligência artificial'
        $configurarGemini = $true
        if (Claude-Pronto) {
            Ok 'O Claude Code já está instalado e logado: a Vitrine vai usar ele.'
            $configurarGemini = Pergunta 'Quer configurar o Gemini também?' $false
        }
        if ($configurarGemini) {
            if (Get-Command gemini.cmd -ErrorAction SilentlyContinue) {
                Ok 'Gemini CLI já instalado.'
            } elseif ($simular) {
                Simulado 'npm install -g @google/gemini-cli'
            } else {
                Write-Host '   Instalando o Gemini CLI...'
                Npm install -g '@google/gemini-cli' --no-fund --no-audit --loglevel=error
                Atualizar-Path
                Ok 'Gemini CLI instalado.'
            }

            $salva = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
            if ($salva -and (Chave-Valida $salva)) {
                Ok 'Chave do Gemini já salva nesta máquina e aceita pelo Google.'
                $chave = $salva
            } else {
                if ($salva) { Aviso 'A chave do Gemini salva nesta máquina foi recusada pelo Google. Vamos trocar.' }
                $chave = Ler-Chave
            }
            if ($simular) {
                Simulado 'gravar GEMINI_API_KEY nas variáveis do usuário'
            } else {
                [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $chave, 'User')
            }
            $env:GEMINI_API_KEY = $chave
            Usar-Chave-No-Gemini
            if ($simular) { Simulado 'teste real do gemini -p' } else { Testar-Gemini }
        }

        # 4. Atalho --------------------------------------------------------------------------------------------
        Titulo '4/5 Atalho na área de trabalho'
        if ($simular) {
            Simulado 'criar o atalho Vitrine'
        } else {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $pasta 'scripts\criar-atalho.ps1') | Out-Null
            if ($LASTEXITCODE -ne 0) { Falha 'Não consegui criar o atalho.' }
            Ok 'Atalho "Vitrine" criado na área de trabalho.'
        }

        # 5. Abrir -----------------------------------------------------------------------------------------------
        Titulo '5/5 Pronto!'
        Write-Host '   Para usar: clique duas vezes no atalho "Vitrine" da área de trabalho.'
        Write-Host '   Ele abre o editor no navegador e deixa uma janela "Vitrine - servidor" minimizada; fechar essa janela desliga o editor.'
        Write-Host "   O guia de uso está em $pasta\COMECE-AQUI.md."
        if (-not $simular -and (Pergunta 'Abrir a Vitrine agora?' $true)) {
            Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', "`"$(Join-Path $pasta 'scripts\iniciar.ps1')`"" -WindowStyle Hidden
            Ok 'Abrindo (a primeira vez pode levar uns 20 segundos).'
        }
    } catch {
        if ($_.Exception.Message -ne 'VITRINE_PARAR') {
            Write-Host ''
            Write-Host "   Erro inesperado: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host '   Tire um print desta janela e mande para quem te passou a Vitrine.' -ForegroundColor Red
        }
    }
}
