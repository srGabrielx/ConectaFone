@echo off
title ConectaFone - Transmissor de Audio PC para Celular
color 0b

echo ============================================================
echo   CONECTAFONE - TRANSMISSOR DE AUDIO SEM FIO PARA CELULAR
echo ============================================================
echo.

:: Verifica se o Python esta instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Python nao foi encontrado no sistema!
    echo Por favor instale o Python 3.10+ para executar o ConectaFone.
    pause
    exit /b
)

echo [1/2] Verificando dependencias necessarias...
python -m pip install -q -r requirements.txt

echo [2/2] Iniciando o servidor ConectaFone...
echo.
echo Abrindo o painel no seu navegador...
start http://localhost:8000

echo.
echo ============================================================
echo  Servidor ativo! Mantenha esta janela aberta.
echo  Pressione Ctrl+C para encerrar.
echo ============================================================
echo.

python server.py

pause
