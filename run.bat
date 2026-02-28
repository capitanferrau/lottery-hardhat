@echo off
chcp 65001 >nul
title Lottery Automation

:: ═══════════════════════════════════════════════════════════
::  LOTTERY AUTOMATION SCRIPT
::  Esegui questo file dalla root del progetto lottery-hardhat
:: ═══════════════════════════════════════════════════════════

echo.
echo  ==========================================
echo   LOTTERY - Automazione Completa
echo  ==========================================
echo.

:: ── 0. Controlla prerequisiti ────────────────────────────────
echo  [0/5] Controllo prerequisiti...

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERRORE] Node.js non e' installato!
    echo  Scaricalo da: https://nodejs.org
    echo  Installa la versione LTS, poi riprova.
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
echo  [OK] Node.js %NODE_VERSION% trovato.

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERRORE] npm non e' installato!
    echo  Viene installato automaticamente con Node.js.
    echo  Scarica Node.js da: https://nodejs.org
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VERSION=%%v
echo  [OK] npm %NPM_VERSION% trovato.
echo.

:: ── 1. Installa dipendenze ──────────────────────────────────
echo  [1/5] Installazione dipendenze npm...
call npm install
echo  [OK] Dipendenze installate.
echo.

:: ── 2. Compila il contratto ─────────────────────────────────
echo  [2/5] Compilazione contratto Solidity...
call npx hardhat compile > compile_output.tmp 2>&1
type compile_output.tmp

findstr /i "SyntaxError\|CompileError\|ParseError\|HardhatError" compile_output.tmp >nul 2>&1
if %errorlevel% equ 0 (
    del compile_output.tmp >nul 2>&1
    echo  [ERRORE] Compilazione fallita. Controlla il contratto Solidity.
    pause & exit /b 1
)
del compile_output.tmp >nul 2>&1
echo  [OK] Contratto compilato.
echo.

:: ── 3. Esegui test + coverage ───────────────────────────────
echo  [3/5] Esecuzione test e coverage...
set SOLIDITY_COVERAGE=true
call npx hardhat coverage > test_output.tmp 2>&1
type test_output.tmp

findstr /i "failing" test_output.tmp >nul 2>&1
if %errorlevel% equ 0 (
    del test_output.tmp >nul 2>&1
    echo  [ERRORE] Uno o piu' test sono falliti.
    pause & exit /b 1
)
del test_output.tmp >nul 2>&1
echo  [OK] Test e coverage completati.
echo.

:: ── 4. Avvia il nodo in background ─────────────────────────
echo  [4/5] Avvio nodo Hardhat locale...
start "Hardhat Node" cmd /k "npx hardhat node"

echo  Attendo che il nodo sia pronto...
set /a attempts=0
:WAIT_NODE
timeout /t 1 /nobreak >nul
curl -s -X POST http://127.0.0.1:8545 ^
  -H "Content-Type: application/json" ^
  --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}" ^
  >nul 2>&1
if %errorlevel% equ 0 goto NODE_READY
set /a attempts+=1
if %attempts% lss 15 goto WAIT_NODE
echo  [ERRORE] Il nodo non risponde dopo 15 secondi.
pause & exit /b 1

:NODE_READY
echo  [OK] Nodo attivo su http://127.0.0.1:8545
echo.

:: ── 5. Deploy ───────────────────────────────────────────────
echo  [5/5] Deploy del contratto...
call npx hardhat run scripts/deploy.js --network localhost > deploy_output.tmp 2>&1
type deploy_output.tmp
echo.

findstr /i "HardhatError\|Error:" deploy_output.tmp | findstr /v /i "UV_HANDLE_CLOSING\|Assertion failed" >nul 2>&1
if %errorlevel% equ 0 (
    del deploy_output.tmp >nul 2>&1
    echo  [ERRORE] Deploy fallito.
    pause & exit /b 1
)

for /f "tokens=*" %%a in ('findstr /i "deployato" deploy_output.tmp') do set DEPLOY_LINE=%%a
for /f "tokens=5" %%a in ("%DEPLOY_LINE%") do set CONTRACT_ADDRESS=%%a
del deploy_output.tmp >nul 2>&1

if "%CONTRACT_ADDRESS%"=="" (
    echo  [ERRORE] Non riesco a leggere l'indirizzo del contratto.
    pause & exit /b 1
)
echo  [OK] Contratto deployato: %CONTRACT_ADDRESS%
echo.

echo  Aggiornamento indirizzo in interact.js...
node -e "const fs=require('fs');const f='scripts/interact.js';let c=fs.readFileSync(f,'utf8');c=c.replace(/CONTRACT_ADDRESS\s*=\s*[\"'].*?[\"']/,'CONTRACT_ADDRESS = \"%CONTRACT_ADDRESS%\"');fs.writeFileSync(f,c);console.log('Indirizzo aggiornato: %CONTRACT_ADDRESS%');"
echo.

:: ── 6. Interazione ──────────────────────────────────────────
echo  Avvio script di interazione...
echo  ==========================================
echo.
call npx hardhat run scripts/interact.js --network localhost > interact_output.tmp 2>&1
type interact_output.tmp
echo.

findstr /i "HardhatError\|Error:" interact_output.tmp | findstr /v /i "UV_HANDLE_CLOSING\|Assertion failed" >nul 2>&1
if %errorlevel% equ 0 (
    del interact_output.tmp >nul 2>&1
    echo  [ERRORE] Script di interazione fallito.
    pause & exit /b 1
)
del interact_output.tmp >nul 2>&1

:: ── Fine ────────────────────────────────────────────────────
echo  ==========================================
echo.
echo  ==========================================
echo   Tutto completato con successo!
echo  ==========================================
echo.
echo  Il nodo Hardhat e' ancora attivo nella finestra separata.
echo  Chiudila manualmente quando hai finito.
echo.
pause