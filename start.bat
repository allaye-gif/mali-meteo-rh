@echo off
setlocal enabledelayedexpansion
title Mali-Meteo RH - Installation et demarrage
cd /d "%~dp0"

echo ================================================
echo    MALI-METEO RH - Installation automatique
echo ================================================
echo.

REM ---------------------------------------------------------
REM 0. Verifier les droits administrateur
REM ---------------------------------------------------------
net session >nul 2>nul
if errorlevel 1 (
    echo [ATTENTION] Ce script n'est pas lance en tant qu'Administrateur.
    echo   Si Node.js ou PostgreSQL doivent etre installes automatiquement,
    echo   l'installation risque d'echouer sans les droits administrateur.
    echo   Astuce : clic droit sur start.bat, puis
    echo   "Executer en tant qu'administrateur".
    echo.
    timeout /t 5 /nobreak >nul
)

REM ---------------------------------------------------------
REM 1. Verifier / installer Node.js
REM ---------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js n'est pas detecte. Tentative d'installation automatique...
    call :installer_nodejs
    call :rafraichir_path
    where node >nul 2>nul
    if errorlevel 1 (
        echo [ERREUR] L'installation automatique de Node.js a echoue.
        echo   Ouverture de la page de telechargement officielle...
        echo   Installez-le, PUIS relancez ce script.
        start "" https://nodejs.org
        pause
        exit /b 1
    )
    echo [OK] Node.js installe avec succes :
    node -v
) else (
    echo [OK] Node.js detecte :
    node -v
)
echo.

REM ---------------------------------------------------------
REM 2. Charger la config existante (.env) si presente
REM ---------------------------------------------------------
set "PGHOST_VAL=localhost"
set "PGPORT_VAL=5432"
set "PGUSER_VAL=postgres"
set "PGPASSWORD_VAL="
set "PGDATABASE_VAL=mali_meteo_rh"
set "JWT_SECRET_VAL="

if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="PGHOST"      set "PGHOST_VAL=%%B"
        if /i "%%A"=="PGPORT"      set "PGPORT_VAL=%%B"
        if /i "%%A"=="PGUSER"      set "PGUSER_VAL=%%B"
        if /i "%%A"=="PGPASSWORD"  set "PGPASSWORD_VAL=%%B"
        if /i "%%A"=="PGDATABASE"  set "PGDATABASE_VAL=%%B"
        if /i "%%A"=="JWT_SECRET"  set "JWT_SECRET_VAL=%%B"
    )
)
if "!JWT_SECRET_VAL!"=="" set "JWT_SECRET_VAL=mm!RANDOM!!RANDOM!!RANDOM!!RANDOM!!RANDOM!!RANDOM!"

REM ---------------------------------------------------------
REM 3. Tester silencieusement si la configuration actuelle marche deja
REM ---------------------------------------------------------
call :tester_connexion

if "!CONN_OK!"=="1" (
    echo [OK] PostgreSQL detecte, connexion reussie avec la configuration actuelle.
) else (
    if "!PSQL_OK!"=="0" (
        echo PostgreSQL n'est pas detecte sur cette machine.
        echo Tentative d'installation automatique ^(peut prendre plusieurs minutes^)...
        call :installer_postgresql
        call :rafraichir_path
        call :tester_connexion
    )

    if "!CONN_OK!"=="0" (
        echo.
        echo ================================================
        echo  Configuration de PostgreSQL - une seule fois
        echo ================================================
        echo Utilisateur : !PGUSER_VAL!
        echo Serveur     : !PGHOST_VAL!:!PGPORT_VAL!
        echo Base        : !PGDATABASE_VAL!
        echo.
        echo Si PostgreSQL est installe sur une AUTRE machine, ou si vous
        echo utilisez un utilisateur different de "!PGUSER_VAL!", annulez
        echo ^(Ctrl+C^) et modifiez d'abord PGHOST/PGUSER dans le fichier .env,
        echo puis relancez ce script.
        echo.
        set /p "PGPASSWORD_VAL=Mot de passe PostgreSQL pour l'utilisateur !PGUSER_VAL!: "

        call :tester_connexion
        if "!CONN_OK!"=="0" (
            echo.
            echo [ERREUR] Connexion PostgreSQL impossible avec ces identifiants.
            echo   Verifiez le mot de passe. Si votre serveur PostgreSQL utilise
            echo   un hote, un port ou un utilisateur different des valeurs
            echo   par defaut ^(localhost, 5432, postgres^), modifiez-les
            echo   directement dans le fichier .env puis relancez ce script.
            echo.
            pause
            exit /b 1
        )
    )
    echo [OK] Connexion PostgreSQL reussie.
)
echo.

echo Ecriture du fichier .env...
(
    echo PORT=3000
    echo JWT_SECRET=!JWT_SECRET_VAL!
    echo.
    echo PGHOST=!PGHOST_VAL!
    echo PGPORT=!PGPORT_VAL!
    echo PGUSER=!PGUSER_VAL!
    echo PGPASSWORD=!PGPASSWORD_VAL!
    echo PGDATABASE=!PGDATABASE_VAL!
    echo PGSSL=false
) > ".env"
echo [OK] Fichier .env enregistre.
echo.

REM ---------------------------------------------------------
REM 4. Creer la base de donnees applicative si elle n'existe pas
REM ---------------------------------------------------------
echo Verification de la base "!PGDATABASE_VAL!"...
set "PGPASSWORD=!PGPASSWORD_VAL!"
psql -h !PGHOST_VAL! -p !PGPORT_VAL! -U !PGUSER_VAL! -tc "SELECT 1 FROM pg_database WHERE datname='!PGDATABASE_VAL!'" postgres 2>nul | findstr "1" >nul
if errorlevel 1 (
    echo   La base n'existe pas encore, creation en cours...
    psql -h !PGHOST_VAL! -p !PGPORT_VAL! -U !PGUSER_VAL! -c "CREATE DATABASE !PGDATABASE_VAL!;" postgres
    if errorlevel 1 (
        echo [ERREUR] Impossible de creer la base automatiquement.
        echo   Verifiez l'hote/utilisateur/mot de passe, ou creez-la
        echo   manuellement avec : psql -U !PGUSER_VAL! -c "CREATE DATABASE !PGDATABASE_VAL!;"
        echo.
        pause
        exit /b 1
    ) else (
        echo [OK] Base "!PGDATABASE_VAL!" creee.
    )
) else (
    echo [OK] La base "!PGDATABASE_VAL!" existe deja.
)
set "PGPASSWORD="
echo.

REM ---------------------------------------------------------
REM 5. Installer les dependances npm
REM ---------------------------------------------------------
echo Installation des dependances (peut prendre une minute la premiere fois)...
call npm install
if errorlevel 1 (
    echo [ERREUR] L'installation des dependances a echoue.
    pause
    exit /b 1
)
echo [OK] Dependances installees.
echo.

REM ---------------------------------------------------------
REM 6. Initialiser les tables PostgreSQL (creation automatique si absentes)
REM ---------------------------------------------------------
echo Initialisation des tables PostgreSQL...
node -e "require('dotenv').config(); require('./src/db').init().then(() => { console.log('[OK] Tables PostgreSQL pretes.'); process.exit(0); }).catch((e) => { console.error('[ERREUR] Connexion impossible : ' + e.message); process.exit(1); });"
if errorlevel 1 (
    echo.
    echo [ERREUR] Impossible de se connecter a PostgreSQL avec les parametres fournis.
    echo   Verifiez le fichier .env, puis relancez ce script.
    echo.
    pause
    exit /b 1
)
echo.

REM ---------------------------------------------------------
REM 7. Demarrer le serveur (fenetre separee) et ouvrir le navigateur
REM ---------------------------------------------------------
echo Demarrage de l'application...
start "Mali-Meteo RH - Serveur (ne pas fermer)" cmd /k npm start
timeout /t 4 /nobreak >nul
start "" http://localhost:3000

echo.
echo ================================================
echo  L'application tourne dans une fenetre separee.
echo  Pour l'arreter : fermez cette fenetre "Serveur".
echo ================================================
echo.
pause
exit /b 0

REM ===========================================================
REM  Sous-routines
REM ===========================================================

:tester_connexion
    set "PSQL_OK=0"
    set "CONN_OK=0"
    for /d %%D in ("C:\Program Files\PostgreSQL\*") do (
        if exist "%%D\bin\psql.exe" set "PATH=%%D\bin;!PATH!"
    )
    where psql >nul 2>nul
    if errorlevel 1 goto :eof
    set "PSQL_OK=1"
    set "PGPASSWORD=!PGPASSWORD_VAL!"
    psql -h !PGHOST_VAL! -p !PGPORT_VAL! -U !PGUSER_VAL! -d postgres -tc "SELECT 1;" >nul 2>nul
    if not errorlevel 1 set "CONN_OK=1"
    set "PGPASSWORD="
    goto :eof

:installer_nodejs
    where winget >nul 2>nul
    if not errorlevel 1 (
        echo   Installation de Node.js via winget...
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
        if not errorlevel 1 goto :eof
        echo   Nouvelle tentative avec un autre identifiant de paquet...
        winget install -e --id OpenJS.NodeJS --accept-source-agreements --accept-package-agreements --silent
        goto :eof
    )
    echo   winget indisponible : telechargement direct du programme d'installation...
    set "NODE_MSI=%TEMP%\node_installer.msi"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { $rel = (Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts -ne $false } | Select-Object -First 1; $url = 'https://nodejs.org/dist/' + $rel.version + '/node-' + $rel.version + '-x64.msi'; Invoke-WebRequest -Uri $url -OutFile '%NODE_MSI%' } catch { exit 1 }"
    if exist "%NODE_MSI%" (
        echo   Installation silencieuse de Node.js en cours...
        msiexec /i "%NODE_MSI%" /quiet /norestart
        timeout /t 5 /nobreak >nul
    )
    goto :eof

:installer_postgresql
    where winget >nul 2>nul
    if not errorlevel 1 (
        echo   Installation de PostgreSQL via winget...
        echo   Si une fenetre d'installation s'ouvre, suivez les etapes et
        echo   utilisez le mot de passe que vous venez de saisir ci-dessus.
        winget install -e --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements
        if not errorlevel 1 goto :eof
        echo   Nouvelle tentative avec un autre identifiant de paquet...
        winget install -e --id PostgreSQL.PostgreSQL --accept-source-agreements --accept-package-agreements
        goto :eof
    )
    echo   winget indisponible : l'installation automatique n'est pas possible
    echo   sans intervention manuelle pour PostgreSQL.
    goto :eof

:rafraichir_path
    for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SYS_PATH=%%B"
    for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USR_PATH=%%B"
    set "PATH=!SYS_PATH!;!USR_PATH!;!PATH!"
    goto :eof
