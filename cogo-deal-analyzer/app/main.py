#!/usr/bin/env python3
"""
COGO Deal Analyzer - Main Application Entry Point

This is the main entry point for the COGO Capital Deal Analyzer application.
It initializes the GUI application and handles command-line arguments.
"""

import sys
import os
import argparse
from pathlib import Path

# Add the app directory to the Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

try:
    from analyzer import DealAnalyzer
    from utils import setup_directories, check_dependencies
    
    # Try to import GUI, but make it optional
    GUI_AVAILABLE = True
    try:
        from gui import main as gui_main
    except ImportError:
        GUI_AVAILABLE = False
        gui_main = None
        
except ImportError as e:
    print(f"Error importing core modules: {e}")
    print("Make sure all required dependencies are installed.")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)


def setup_application():
    """Setup application directories and check dependencies."""
    try:
        # Setup required directories
        setup_directories()
        
        # Check dependencies (only fail on critical missing deps)
        missing_deps = check_dependencies()
        if missing_deps:
            print("Note: Some optional features may be disabled:")
            for dep in missing_deps:
                if dep == "reportlab":
                    print(f"  - {dep} (PDF export will be disabled)")
                else:
                    print(f"  - {dep}")
            print("\\nFor full functionality, run: pip install -r requirements.txt")
            # Don't fail for missing optional dependencies
        
        return True
    except Exception as e:
        print(f"Setup failed: {e}")
        return False


def run_cli_mode():
    """Run in command-line mode for basic deal analysis."""
    print("COGO Deal Analyzer - CLI Mode")
    print("=" * 40)
    
    try:
        # Get basic input from user
        arv = float(input("Enter ARV (After Repair Value): $").replace(",", ""))
        purchase_price = float(input("Enter Purchase Price: $").replace(",", ""))
        rehab = float(input("Enter Rehab Cost: $").replace(",", ""))
        
        # Create analyzer and get exit strategies
        analyzer = DealAnalyzer()
        exit_strategies = analyzer.get_exit_strategies()
        
        # Ask about exit strategy selection
        print("\\n" + "=" * 60)
        print("COGO-APPROVED EXIT STRATEGY SELECTION")
        print("=" * 60)
        print("Choose your planned exit strategy (affects selling costs):")
        print()
        
        strategy_options = []
        for i, (key, strategy) in enumerate(exit_strategies.items(), 1):
            if key != "custom":  # Don't show custom in main list
                strategy_options.append(key)
                total_rate = (strategy["agent_commission"] + 
                            strategy["title_closing"] + 
                            strategy["misc_costs"]) * 100
                print(f"{i}. {strategy['name']} ({total_rate:.1f}% total)")
                print(f"   {strategy['description']}")
                print()
        
        strategy_options.append("custom")
        print(f"{len(strategy_options)}. Custom/Manual Configuration")
        
        # Get strategy selection
        while True:
            try:
                choice = input(f"\\nSelect exit strategy (1-{len(strategy_options)}): ").strip()
                choice_num = int(choice)
                if 1 <= choice_num <= len(strategy_options):
                    selected_strategy = strategy_options[choice_num - 1]
                    break
                else:
                    print("Invalid selection. Please try again.")
            except ValueError:
                print("Please enter a number.")
        
        # Create deal data
        deal_data = {
            "arv": arv,
            "purchase_price": purchase_price,
            "rehab": rehab,
            "exit_strategy": selected_strategy
        }
        
        # If custom selected, get manual input
        if selected_strategy == "custom":
            print("\\nCustom Exit Strategy - Enter rates as percentages (e.g., 5.5 for 5.5%):")
            
            selling_costs = {}
            
            agent_rate = input("Agent Commissions % (default 5.5%): ").strip()
            if agent_rate:
                try:
                    selling_costs["agent_commission"] = float(agent_rate) / 100
                except ValueError:
                    print("Invalid input, using default")
            
            title_rate = input("Title & Closing % (default 1.5%): ").strip()
            if title_rate:
                try:
                    selling_costs["title_closing"] = float(title_rate) / 100
                except ValueError:
                    print("Invalid input, using default")
            
            misc_rate = input("Misc/Concessions % (default 1.0%): ").strip()
            if misc_rate:
                try:
                    selling_costs["misc_costs"] = float(misc_rate) / 100
                except ValueError:
                    print("Invalid input, using default")
            
            if selling_costs:
                deal_data["selling_costs"] = selling_costs
        
        # Create analyzer and calculate
        analyzer = DealAnalyzer()
        
        results = analyzer.calculate_deal_metrics(deal_data)
        
        # Display results
        print("\\n" + analyzer.get_deal_summary(results))
        
        # Generate document checklist for eligible deals
        if results["eligibility"]["is_cogo_eligible"]:
            print("\\n" + "=" * 60)
            print("📋 COGO LOAN APPLICATION DOCUMENT CHECKLIST")
            print("=" * 60)
            
            checklist = analyzer.generate_document_checklist(results)
            print(analyzer.get_checklist_summary(checklist))
            
            # Ask if user wants to manage checklist
            manage_checklist = input("\\nManage document checklist? (y/n): ").lower().strip()
            if manage_checklist == 'y':
                _manage_document_checklist(analyzer, checklist)
        else:
            print("\\n" + "=" * 50)
            print("ℹ️  Deal does not meet COGO eligibility requirements.")
            print("Document checklist not applicable.")
            print("=" * 50)
        
        # Ask if user wants to save
        save_choice = input("\\nSave this analysis? (y/n): ").lower().strip()
        if save_choice == 'y':
            filename = analyzer.save_deal(results)
            print(f"Analysis saved to: {filename}")
            
            # Save checklist if eligible
            if results["eligibility"]["is_cogo_eligible"]:
                checklist_file = filename.replace('.json', '_checklist.json')
                try:
                    import json
                    with open(checklist_file, 'w') as f:
                        json.dump(checklist, f, indent=2, default=str)
                    print(f"Document checklist saved to: {checklist_file}")
                except Exception as e:
                    print(f"Warning: Could not save checklist: {e}")
    
    except KeyboardInterrupt:
        print("\\nAnalysis cancelled by user.")
    except ValueError as e:
        print(f"Input error: {e}")
    except Exception as e:
        print(f"Analysis error: {e}")


def _manage_document_checklist(analyzer: DealAnalyzer, checklist: dict):
    """Interactive document checklist management."""
    while True:
        print("\\n" + "=" * 50)
        print("DOCUMENT CHECKLIST MANAGEMENT")
        print("=" * 50)
        print("1. Mark document as collected")
        print("2. Add notes to document")
        print("3. View current status")
        print("4. Return to main menu")
        
        choice = input("\\nSelect option (1-4): ").strip()
        
        if choice == "1":
            _mark_document_collected(analyzer, checklist)
        elif choice == "2":
            _add_document_notes(analyzer, checklist)
        elif choice == "3":
            print("\\n" + analyzer.get_checklist_summary(checklist))
        elif choice == "4":
            break
        else:
            print("Invalid choice. Please try again.")


def _mark_document_collected(analyzer: DealAnalyzer, checklist: dict):
    """Mark a document as collected."""
    print("\\nBROKER-REQUIRED DOCUMENTS:")
    for i, doc in enumerate(checklist["broker_required"], 1):
        status = "✅" if doc["collected"] else "❌"
        print(f"{i}. {status} {doc['name']}")
    
    try:
        choice = int(input("\\nSelect document number to mark as collected: "))
        if 1 <= choice <= len(checklist["broker_required"]):
            doc_name = checklist["broker_required"][choice-1]["name"]
            analyzer.update_document_status(checklist, doc_name, True)
            print(f"✅ Marked '{doc_name}' as collected")
        else:
            print("Invalid document number")
    except ValueError:
        print("Please enter a valid number")


def _add_document_notes(analyzer: DealAnalyzer, checklist: dict):
    """Add notes to a document."""
    print("\\nBROKER-REQUIRED DOCUMENTS:")
    for i, doc in enumerate(checklist["broker_required"], 1):
        print(f"{i}. {doc['name']}")
    
    try:
        choice = int(input("\\nSelect document number to add notes: "))
        if 1 <= choice <= len(checklist["broker_required"]):
            doc_name = checklist["broker_required"][choice-1]["name"]
            notes = input(f"Enter notes for '{doc_name}': ")
            
            # Update notes without changing collected status
            current_status = checklist["broker_required"][choice-1]["collected"]
            analyzer.update_document_status(checklist, doc_name, current_status, notes)
            print(f"📝 Added notes to '{doc_name}'")
        else:
            print("Invalid document number")
    except ValueError:
        print("Please enter a valid number")


def main():
    """Main application entry point."""
    parser = argparse.ArgumentParser(
        description="COGO Capital Deal Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py              # Launch GUI mode
  python main.py --cli        # Run in command-line mode
  python main.py --version    # Show version info
        """
    )
    
    parser.add_argument(
        "--cli", 
        action="store_true", 
        help="Run in command-line mode instead of GUI"
    )
    
    parser.add_argument(
        "--version", 
        action="store_true", 
        help="Show version information"
    )
    
    parser.add_argument(
        "--debug", 
        action="store_true", 
        help="Enable debug mode"
    )
    
    args = parser.parse_args()
    
    if args.version:
        print("COGO Deal Analyzer v1.0.0")
        print("Built for COGO Capital loan eligibility analysis")
        return 0
    
    # Setup application
    if not setup_application():
        return 1
    
    if args.debug:
        print("Debug mode enabled")
        os.environ['DEBUG'] = '1'
    
    try:
        if args.cli:
            # Run in CLI mode
            run_cli_mode()
            return 0
        else:
            # Run GUI mode
            if not GUI_AVAILABLE:
                print("GUI mode is not available. PyQt5 is not installed.")
                print("Running in CLI mode instead...")
                print("To install GUI support: pip install PyQt5")
                print("-" * 40)
                run_cli_mode()
                return 0
            else:
                print("Starting COGO Deal Analyzer GUI...")
                return gui_main()
    
    except KeyboardInterrupt:
        print("\\nApplication terminated by user.")
        return 0
    except Exception as e:
        print(f"Application error: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())