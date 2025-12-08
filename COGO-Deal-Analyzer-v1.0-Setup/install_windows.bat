@echo off
REM COGO Deal Analyzer v1.0 - Windows Installation Script
REM House Lot & Land Sales Co. LLC

echo ==========================================
echo COGO Deal Analyzer v1.0 - Windows Setup
echo ==========================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    echo    Please install Python 3.8+ from https://python.org
    echo    Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

REM Check Python version
for /f "tokens=2" %%i in ('python --version') do set python_version=%%i
echo ✅ Python %python_version% detected

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo ⬆️  Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo 📥 Installing Python dependencies...
pip install -r requirements.txt

echo.
echo ✅ Installation Complete!
echo.
echo ==========================================
echo HOW TO RUN COGO DEAL ANALYZER
echo ==========================================
echo.
echo Method 1 - GUI Mode (Recommended):
echo    Double-click run.bat
echo.
echo Method 2 - Command Prompt:
echo    venv\Scripts\activate
echo    python app\main.py
echo.
echo Method 3 - CLI Mode:
echo    venv\Scripts\activate
echo    python app\main.py --cli
echo.
echo ==========================================
echo TROUBLESHOOTING
echo ==========================================
echo.
echo If you encounter issues:
echo 1. Make sure Python 3.8+ is installed
echo 2. Ensure Python is added to your PATH
echo 3. Try running as Administrator
echo 4. Restart command prompt after Python installation
echo.
echo For support, contact House Lot & Land Sales Co. LLC
echo ==========================================
echo.
echo 🎉 Ready to analyze COGO Capital deals!
echo.
pause