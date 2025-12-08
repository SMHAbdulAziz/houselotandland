# COGO Deal Analyzer v1.0 - Installation Guide
**House Lot & Land Sales Co. LLC**

## What's Included

This self-contained package includes:
- ✅ Complete COGO Deal Analyzer v1.0 application
- ✅ All Python source code and dependencies
- ✅ Historical deal reports and data
- ✅ Cross-platform installation scripts
- ✅ Launch scripts for easy startup
- ✅ Complete documentation

---

## System Requirements

### macOS
- macOS 10.12+ (Sierra or newer)
- Python 3.8 or higher
- 50MB free disk space

### Windows  
- Windows 10 or Windows 11
- Python 3.8 or higher
- 50MB free disk space

---

## Installation Instructions

### For macOS Users

1. **Open Terminal** (Applications → Utilities → Terminal)

2. **Navigate to the installation folder:**
   ```bash
   cd /path/to/COGO-Deal-Analyzer-v1.0-Setup
   ```

3. **Make installation script executable:**
   ```bash
   chmod +x install_macos.sh
   chmod +x run.sh
   ```

4. **Run the installer:**
   ```bash
   ./install_macos.sh
   ```

5. **Launch the application:**
   ```bash
   ./run.sh
   ```

### For Windows Users

1. **Open Command Prompt or PowerShell**
   - Press `Win + R`, type `cmd`, press Enter

2. **Navigate to the installation folder:**
   ```cmd
   cd C:\path\to\COGO-Deal-Analyzer-v1.0-Setup
   ```

3. **Run the installer:**
   ```cmd
   install_windows.bat
   ```

4. **Launch the application:**
   ```cmd
   run.bat
   ```
   
   Or simply **double-click** `run.bat` from File Explorer

---

## Quick Start Guide

### First Time Setup
1. Run the appropriate installation script for your operating system
2. Wait for dependencies to install (requires internet connection)
3. Launch the application using the run script

### Daily Usage
- **macOS:** Double-click `run.sh` or use Terminal: `./run.sh`
- **Windows:** Double-click `run.bat`

### Application Features
- **Deal Analysis:** Enter property and loan details for COGO Capital requirements
- **Broker Fee Customization:** Adjust from 1.0% to 3.5% 
- **Deal History:** Search and manage previous analyses
- **PDF Export:** Professional loan submission documents
- **Data Collection:** Comprehensive borrower and guarantor information

---

## Troubleshooting

### Common Issues

**"Python not found" Error:**
- **macOS:** Install Python from https://python.org or use Homebrew: `brew install python`
- **Windows:** Download from https://python.org and check "Add to PATH" during installation

**GUI Won't Start (macOS):**
- Install XQuartz: `brew install --cask xquartz`
- Restart Terminal and try again

**Permission Denied (macOS):**
- Make scripts executable: `chmod +x install_macos.sh run.sh`

**Antivirus Issues (Windows):**
- Add installation folder to antivirus exceptions
- Run installer as Administrator

### Getting Help

For technical support or feature requests:
- **Contact:** House Lot & Land Sales Co. LLC
- **Version:** v1.0 (December 2024)

---

## File Structure

```
COGO-Deal-Analyzer-v1.0-Setup/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── install_macos.sh            # macOS installer
├── install_windows.bat         # Windows installer  
├── run.sh                      # macOS launcher
├── run.bat                     # Windows launcher
├── app/                        # Application files
│   ├── main.py                 # Application entry point
│   ├── gui.py                  # User interface
│   ├── analyzer.py             # Deal analysis engine
│   ├── utils.py                # Utilities and PDF export
│   ├── __init__.py            # Python package file
│   ├── reports/                # Deal history and exports
│   └── templates/              # PDF templates
└── venv/                       # Virtual environment (created during install)
```

---

## Version Information

**COGO Deal Analyzer v1.0**
- Release Date: December 2024
- Developed for: House Lot & Land Sales Co. LLC
- Compatible with: COGO Capital lending requirements
- Platforms: macOS, Windows
- License: Proprietary

---

## What's New in v1.0

✅ **Customizable Broker Fees** - Adjust from 1.0% to 3.5%  
✅ **Enhanced Deal History** - Search by borrower name or property address  
✅ **Professional PDF Export** - Properly formatted loan submission documents  
✅ **Comprehensive Data Collection** - Borrower and guarantor information  
✅ **Improved Stability** - Fixed crashes and enhanced error handling  
✅ **Cross-Platform Support** - Works on both macOS and Windows  

Ready to streamline your COGO Capital deal analysis! 🎉