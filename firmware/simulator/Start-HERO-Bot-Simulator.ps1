$ErrorActionPreference = 'Stop'

$simulatorDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherLogPath = Join-Path $simulatorDirectory 'startup-launcher.log'
$simulatorLogPath = Join-Path $simulatorDirectory 'startup.log'
$hostAddress = '127.0.0.1'
$port = 8765
$maxAttempts = 3
$startupTimeoutSeconds = 20

function Write-StartupLog {
    param([string]$Message)
    Add-Content -LiteralPath $launcherLogPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

function Test-HeroBotPort {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.ConnectAsync($hostAddress, $port)
        if (-not $connection.Wait(400)) {
            return $false
        }
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

if (Test-HeroBotPort) {
    Write-StartupLog 'Servidor ja ativo na porta 8765; nenhuma nova instancia foi aberta.'
    exit 0
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    $fallbackNpm = 'C:\Program Files\nodejs\npm.cmd'
    if (Test-Path -LiteralPath $fallbackNpm) {
        $npmPath = $fallbackNpm
    }
    else {
        Write-StartupLog 'ERRO: npm.cmd nao foi encontrado no PATH nem em C:\Program Files\nodejs.'
        exit 1
    }
}
else {
    $npmPath = $npmCommand.Source
}

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    Write-StartupLog "Iniciando HERO.Bot Simulator (tentativa $attempt/$maxAttempts)."
    $command = "call `"$npmPath`" start >> `"$simulatorLogPath`" 2>&1"
    $arguments = "/d /s /c `"$command`""
    $process = Start-Process -FilePath $env:ComSpec `
        -ArgumentList $arguments `
        -WorkingDirectory $simulatorDirectory `
        -WindowStyle Minimized `
        -PassThru

    for ($second = 1; $second -le $startupTimeoutSeconds; $second++) {
        Start-Sleep -Seconds 1
        if (Test-HeroBotPort) {
            Write-StartupLog "Servidor confirmado na porta 8765 apos $second segundo(s)."
            exit 0
        }
        if ($process.HasExited) {
            break
        }
    }

    if (-not $process.HasExited) {
        Write-StartupLog 'ERRO: processo permanece ativo, mas a porta 8765 nao abriu; nova instancia foi bloqueada.'
        exit 1
    }

    Write-StartupLog "Tentativa $attempt encerrou antes de abrir a porta 8765."
    if ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 5
    }
}

Write-StartupLog 'ERRO: simulador nao iniciou apos todas as tentativas.'
exit 1
