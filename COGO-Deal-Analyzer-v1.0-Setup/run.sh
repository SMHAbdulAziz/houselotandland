#!/bin/bash
# COGO Deal Analyzer v1.0 - macOS Launch Script
# House Lot & Land Sales Co. LLC

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "   Please run the installation script first: ./install_macos.sh"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if main application exists
if [ ! -f "app/main.py" ]; then
    echo "❌ Application files not found!"
    echo "   Please ensure all files are properly installed."
    exit 1
fi

echo "🚀 Launching COGO Deal Analyzer v1.0..."
echo "   Close this terminal window to exit the application"
echo ""

# Launch the application
python app/main.py

echo ""
echo "👋 Thanks for using COGO Deal Analyzer!"