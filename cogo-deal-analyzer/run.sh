#!/bin/bash

# COGO Deal Analyzer - Easy Run Script

echo "🏠 COGO Deal Analyzer - Docker Edition"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

# Parse command line arguments
MODE="cli"
BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --gui)
            MODE="gui"
            shift
            ;;
        --cli)
            MODE="cli"
            shift
            ;;
        --build)
            BUILD=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --cli      Run in CLI mode (default)"
            echo "  --gui      Run in GUI mode (requires X11 setup)"
            echo "  --build    Force rebuild the Docker image"
            echo "  --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                # Run CLI mode"
            echo "  $0 --cli --build  # Rebuild and run CLI mode"
            echo "  $0 --gui          # Run GUI mode (macOS/Linux only)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build if requested
if [ "$BUILD" = true ]; then
    echo "🔨 Building Docker image..."
    docker-compose build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    echo "✅ Build complete"
fi

# Run the application
echo "🚀 Starting COGO Deal Analyzer in $MODE mode..."

if [ "$MODE" = "gui" ]; then
    echo "Note: GUI mode requires X11 forwarding setup"
    echo "For macOS: Install XQuartz and run 'xhost +localhost'"
    echo "For Linux: Run 'xhost +local:docker'"
    echo ""
    
    # Check if X11 forwarding is likely to work
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v xquartz &> /dev/null; then
            echo "⚠️  XQuartz not found. Install with: brew install --cask xquartz"
        fi
    fi
    
    # Try to enable X11 forwarding
    if command -v xhost &> /dev/null; then
        xhost +localhost 2>/dev/null || echo "Note: Could not configure X11 forwarding"
    fi
    
    docker run -it --rm \
        -v "$(pwd)/data:/app/data" \
        -v "$(pwd)/reports:/app/reports" \
        -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
        -e DISPLAY="${DISPLAY:-:0.0}" \
        cogo-analyzer:cli python app/main.py
else
    # CLI mode - simple and reliable
    docker run -it --rm \
        -v "$(pwd)/data:/app/data" \
        -v "$(pwd)/reports:/app/reports" \
        cogo-analyzer:cli
fi

echo "👋 Thanks for using COGO Deal Analyzer!"