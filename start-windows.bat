@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  HumanPhys web page - local start script (Windows)
rem
rem  Just double-click this file.
rem  It picks a free port, prints the URLs, opens your browser.
rem  Stop the server with Ctrl+C.
rem ============================================================

if not exist "index.html" (
    echo.
    echo  ERROR: index.html not found in this folder.
    echo  Please keep this .bat file together with index.html
    echo  and the assets folder.
    echo.
    pause
    exit /b 1
)

rem ---------- pick a free port (8080 .. 8090) ----------
set PORT=8080
:checkport
netstat -ano | findstr /R /C:":%PORT% " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (
    set /a PORT=PORT+1
    if !PORT! GTR 8090 (
        echo.
        echo  ERROR: ports 8080-8090 are all in use.
        echo  Please close the program using them and try again.
        echo.
        pause
        exit /b 1
    )
    goto checkport
)

rem ---------- find Python ----------
set PY=
where py >nul 2>&1
if not errorlevel 1 set PY=py
if "%PY%"=="" (
    where python >nul 2>&1
    if not errorlevel 1 set PY=python
)
if "%PY%"=="" (
    where python3 >nul 2>&1
    if not errorlevel 1 set PY=python3
)

if "%PY%"=="" (
    echo.
    echo  ===========================================================
    echo   Python not found - that is OK.
    echo.
    echo   Just double-click  index.html  instead.
    echo   It opens in your browser with full styling and images.
    echo   No Python needed for that.
    echo  ===========================================================
    echo.
    pause
    exit /b 1
)

rem ---------- get local LAN IP ----------
set LANIP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    if "!LANIP!"=="" (
        set LANIP=%%a
        set LANIP=!LANIP: =!
    )
)

echo.
echo  ===========================================================
echo   HumanPhys web page is running
echo  -----------------------------------------------------------
echo   Local    : http://127.0.0.1:%PORT%
if defined LANIP (
echo   Same LAN : http://!LANIP!:%PORT%
) else (
echo   Same LAN : run "ipconfig" to see your IPv4 address
)
echo  -----------------------------------------------------------
echo   Stop     : press Ctrl+C
echo  ===========================================================
echo.

start "" "http://127.0.0.1:%PORT%"

%PY% -m http.server %PORT% --bind 0.0.0.0
if errorlevel 1 (
    echo.
    echo  Failed to start the server. Please check the message above.
    pause
)
