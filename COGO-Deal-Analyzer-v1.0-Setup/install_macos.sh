#!/bin/bash
# COGO Deal Analyzer v1.0 - macOS Installation Script
# House Lot & Land Sales Co. LLC

echo "=========================================="
echo "COGO Deal Analyzer v1.0 - macOS Setup"
echo "=========================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher from https://python.org"
    echo "   Alternatively, install via Homebrew: brew install python"
    exit 1
fi

# Check Python version
python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
required_version="3.8"

if ! python3 -c "import sys; exit(0 if sys.version_info >= (3,8) else 1)" 2>/dev/null; then
    echo "❌ Python 3.8+ required. Current version: $(python3 --version)"
    exit 1
fi

echo "✅ Python $(python3 --version | cut -d' ' -f2) detected"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📥 Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Installation Complete!"
echo ""
echo "=========================================="
echo "HOW TO RUN COGO DEAL ANALYZER"
echo "=========================================="
echo ""
echo "Method 1 - GUI Mode (Recommended):"
echo "   ./run.sh"
echo ""
echo "Method 2 - Manual activation:"
echo "   source venv/bin/activate"
echo "   python app/main.py"
echo ""
echo "Method 3 - CLI Mode:"
echo "   source venv/bin/activate"  
echo "   python app/main.py --cli"
echo ""
echo "=========================================="
echo "TROUBLESHOOTING"
echo "=========================================="
echo ""
echo "If you encounter GUI issues on macOS:"
echo "1. Install XQuartz: brew install --cask xquartz"
echo "2. Restart your terminal"
echo "3. Try running the application again"
echo ""
echo "For support, contact House Lot & Land Sales Co. LLC"
echo "=========================================="

# Make run script executable
chmod +x run.sh 2>/dev/null || echo "Note: run.sh not found, use manual method"

echo ""
echo "🎉 Ready to analyze COGO Capital deals!"