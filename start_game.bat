@echo off
chcp 65001 >nul
title Запуск игры (фикс-порт + автооткрытие)

REM === ПАПКА ИГРЫ ===
cd /d "C:\Games\magical-mirror"

REM === ПРОВЕРКА ===
if not exist package.json (
  echo package.json не найден. Проверь путь к игре.
  pause
  exit
)

REM === ПОРТ (можешь поменять на 5173 если хочешь) ===
set PORT=3000

echo Запускаю игру на порту %PORT% ...
echo Открою браузер: http://localhost:%PORT%/
echo Для остановки: Ctrl+C в окне сервера
echo.

REM --- откроем браузер через 2 сек (надёжно) ---
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" "http://localhost:%PORT%/"" "

REM --- запускаем Vite на фиксированном порту ---
npm run dev -- --host localhost --port %PORT% --strictPort
