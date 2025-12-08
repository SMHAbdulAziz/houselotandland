@echo off
REM COGO Deal Analyzer v1.0 - Windows Launch Script
REM House Lot & Land Sales Co. LLC

REM Check if virtual environment exists
if not exist "venv" (
    echo ❌ Virtual environment not found!
    echo    Please run the installation script first: install_windows.bat
    pause
    exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if main application exists
if not exist "app\main.py" (
    echo ❌ Application files not found!
    echo    Please ensure all files are properly installed.
    pause
    exit /b 1
)

echo 🚀 Launching COGO Deal Analyzer v1.0...
echo    Close this window to exit the application
echo.

REM Launch the application
python app\main.py

echo.
echo 👋 Thanks for using COGO Deal Analyzer!
pause