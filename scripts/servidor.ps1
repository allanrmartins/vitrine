# Janela do servidor da Vitrine (aberta minimizada pelo iniciar.ps1). Fechar a janela desliga o editor.
#
# Desliga o "Modo de Edição Rápida" (QuickEdit) do console: com ele ligado, um clique dentro da janela a coloca
# em modo de seleção e congela quem escreve nela. O Node escreve no console de forma síncrona, então o
# servidor inteiro para de responder até alguém apertar Esc na janela.

$ErrorActionPreference = 'Stop'
$host.UI.RawUI.WindowTitle = 'Vitrine - servidor (feche para desligar)'

Add-Type -Namespace Vitrine -Name Console -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool GetConsoleMode(IntPtr h, out uint mode);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleMode(IntPtr h, uint mode);
'@
$STD_INPUT = -10
$ENABLE_QUICK_EDIT = 0x0040
$ENABLE_EXTENDED_FLAGS = 0x0080
$stdin = [Vitrine.Console]::GetStdHandle($STD_INPUT)
$mode = 0
if ([Vitrine.Console]::GetConsoleMode($stdin, [ref]$mode)) {
    [Vitrine.Console]::SetConsoleMode($stdin, (($mode -band (-bnot $ENABLE_QUICK_EDIT)) -bor $ENABLE_EXTENDED_FLAGS)) | Out-Null
}

Set-Location (Split-Path -Parent $PSScriptRoot)
$port = if ($env:VITRINE_PORT) { $env:VITRINE_PORT } else { '5180' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js não encontrado. Instale o Node 22 ou mais novo (https://nodejs.org) e abra o atalho de novo.' -ForegroundColor Red
    Read-Host 'Enter para fechar'
    exit 1
}
if (-not (Test-Path 'node_modules')) {
    Write-Host 'Primeira execução: instalando dependências (npm install)...' -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { Read-Host 'npm install falhou (veja acima). Enter para fechar'; exit 1 }
}

Write-Host "Vitrine rodando em http://localhost:$port - feche esta janela para desligar." -ForegroundColor Yellow
npm run dev
