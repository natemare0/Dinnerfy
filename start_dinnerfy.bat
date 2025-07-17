@echo off
REM Dinnerfy Startup Script

REM Set the correct working directory
setlocal
set "DINNERFY_DIR=E:\CodeProjects\Dinnerfy"

REM Start backend
echo Starting Dinnerfy backend...
start cmd /k "cd /d "%DINNERFY_DIR%\backend" && venv\Scripts\activate && python app/main.py"

REM Start frontend
echo Starting Dinnerfy frontend...
start cmd /k "cd /d "%DINNERFY_DIR%\frontend" && npm start"

echo Both backend and frontend have been started in new windows.
pause
endlocal
