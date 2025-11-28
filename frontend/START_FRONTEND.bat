@echo off
title Shoe Store Frontend Server
color 0B
echo ========================================
echo   SHOE STORE FRONTEND SERVER
echo ========================================
echo.
echo Starting frontend on http://localhost:3000
echo.
cd /d "%~dp0"
npm start

REM If server crashes, pause to see error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo   SERVER CRASHED! See error above.
    echo ========================================
    pause
)
