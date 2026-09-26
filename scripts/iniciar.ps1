# Abre o editor da Vitrine: sobe o `npm run dev` se ainda não estiver rodando e abre o navegador.
# Usado pelo atalho da área de trabalho (criado por scripts/criar-atalho.ps1).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = if ($env:VITRINE_PORT) { $env:VITRINE_PORT } else { '5180' }
$url = "http://localhost:$port"

function Test-Editor {
    try {
        $r = Invoke-WebRequest "$url/api/ia/saude" -UseBasicParsing -TimeoutSec 2
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-Editor)) {
    # Janela minimizada com o log do servidor (sem QuickEdit, ver servidor.ps1); fechar essa janela desliga o editor.
    Start-Process -FilePath 'powershell.exe' `
        -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$(Join-Path $PSScriptRoot 'servidor.ps1')`"" `
        -WorkingDirectory $root `
        -WindowStyle Minimized

    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-Editor)) {
        if ((Get-Date) -gt $deadline) {
            Add-Type -AssemblyName PresentationFramework
            [System.Windows.MessageBox]::Show(
                "O servidor não respondeu em 60 s.`nAbra a janela 'Vitrine - servidor' na barra de tarefas para ver o erro.",
                'Vitrine') | Out-Null
            exit 1
        }
        Start-Sleep -Milliseconds 500
    }
}

Start-Process $url
