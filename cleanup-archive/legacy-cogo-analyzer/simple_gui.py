#!/usr/bin/env python3
"""
Simplified COGO Deal Analyzer GUI - Stable Version

This version removes potentially problematic widgets to isolate the crash.
"""

import sys
import os
sys.path.insert(0, 'app')

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QGridLayout, QLabel, QLineEdit, QPushButton, QTextEdit, 
    QGroupBox, QMessageBox, QComboBox
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

from analyzer import DealAnalyzer
from utils import format_currency


class SimpleDealInputWidget(QGroupBox):
    """Simplified deal input widget."""
    
    def __init__(self):
        super().__init__("Deal Input")
        self.init_ui()
    
    def init_ui(self):
        layout = QGridLayout()
        
        # ARV Input
        layout.addWidget(QLabel("ARV (After Repair Value):"), 0, 0)
        self.arv_input = QLineEdit()
        self.arv_input.setPlaceholderText("e.g., 250000")
        layout.addWidget(self.arv_input, 0, 1)
        layout.addWidget(QLabel("$"), 0, 2)
        
        # Purchase Price Input
        layout.addWidget(QLabel("Purchase Price:"), 1, 0)
        self.purchase_input = QLineEdit()
        self.purchase_input.setPlaceholderText("e.g., 180000")
        layout.addWidget(self.purchase_input, 1, 1)
        layout.addWidget(QLabel("$"), 1, 2)
        
        # Rehab Cost Input
        layout.addWidget(QLabel("Estimated Rehab Cost:"), 2, 0)
        self.rehab_input = QLineEdit()
        self.rehab_input.setPlaceholderText("e.g., 30000")
        layout.addWidget(self.rehab_input, 2, 1)
        layout.addWidget(QLabel("$"), 2, 2)
        
        # Exit Strategy Selection
        layout.addWidget(QLabel("Exit Strategy:"), 3, 0)
        self.strategy_combo = QComboBox()
        
        # Load exit strategies safely
        try:
            analyzer = DealAnalyzer()
            strategies = analyzer.EXIT_STRATEGIES
            for key, strategy in strategies.items():
                total_rate = (strategy.get('agent_commission', 0) + 
                             strategy.get('title_closing', 0) + 
                             strategy.get('misc_costs', 0)) * 100
                strategy_text = f"{strategy['name']} ({total_rate:.1f}%)"
                self.strategy_combo.addItem(strategy_text, key)
        except Exception as e:
            print(f"Error loading exit strategies: {e}")
            # Fallback strategies
            self.strategy_combo.addItem("MLS Listing (8.0%)", "mls_listing")
            self.strategy_combo.addItem("Wholesale (1.5%)", "wholesale")
        
        layout.addWidget(self.strategy_combo, 3, 1, 1, 2)
        
        self.setLayout(layout)
    
    def get_deal_data(self) -> dict:
        """Extract deal data from input fields."""
        try:
            deal_data = {
                "arv": float(self.arv_input.text().replace(",", "") or 0),
                "purchase_price": float(self.purchase_input.text().replace(",", "") or 0),
                "rehab": float(self.rehab_input.text().replace(",", "") or 0)
            }
            
            # Add exit strategy selection
            strategy_data = self.strategy_combo.currentData()
            if strategy_data:
                deal_data["exit_strategy"] = strategy_data
            
            return deal_data
        except ValueError:
            raise ValueError("Please enter valid numeric values for all fields")
    
    def clear_inputs(self):
        """Clear all input fields."""
        self.arv_input.clear()
        self.purchase_input.clear()
        self.rehab_input.clear()
        self.strategy_combo.setCurrentIndex(0)


class SimpleResultsWidget(QGroupBox):
    """Simplified results display widget."""
    
    def __init__(self):
        super().__init__("Analysis Results")
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Results display
        self.results_text = QTextEdit()
        self.results_text.setReadOnly(True)
        self.results_text.setFont(QFont("Consolas", 10))
        layout.addWidget(self.results_text)
        
        # Eligibility status
        self.eligibility_label = QLabel("COGO Eligibility: Not Analyzed")
        self.eligibility_label.setAlignment(Qt.AlignCenter)
        self.eligibility_label.setStyleSheet("""
            QLabel {
                font-size: 16px;
                font-weight: bold;
                padding: 10px;
                border: 2px solid #ccc;
                border-radius: 5px;
                background-color: #f0f0f0;
            }
        """)
        layout.addWidget(self.eligibility_label)
        
        self.setLayout(layout)
    
    def update_results(self, results: dict):
        """Update the results display with new analysis data."""
        input_data = results["input"]
        calculations = results["calculations"]
        eligibility = results["eligibility"]
        exit_strategy = results.get("exit_strategy", {})
        
        # Format results text
        results_text = f"""
DEAL ANALYSIS RESULTS
{'='*50}

INPUT VALUES:
  ARV:                {format_currency(input_data["arv"])}
  Purchase Price:     {format_currency(input_data["purchase_price"])}
  Rehab Cost:         {format_currency(input_data["rehab"])}
  Exit Strategy:      {exit_strategy.get("name", "N/A")}

LOAN CALCULATIONS:
  Max Loan (65% ARV):    {format_currency(calculations["max_loan_ltv"])}
  Max Loan (80% Purchase): {format_currency(calculations["max_loan_purchase"])}
  Actual Loan Amount:    {format_currency(calculations["loan_amount"])}

COST BREAKDOWN:
  Total Investment:      {format_currency(calculations["total_costs"])}
  Selling Costs:         {format_currency(calculations["selling_costs"]["total"])} ({calculations["selling_costs"]["total_rate"]:.1%})
  Net Profit:            {format_currency(calculations["net_profit"])}

ELIGIBILITY:
  COGO Eligible:         {"YES" if eligibility["is_cogo_eligible"] else "NO"}
  Min Profit Required:   {format_currency(eligibility["min_profit_required"])}
"""
        
        self.results_text.setPlainText(results_text)
        
        # Update eligibility label
        if eligibility["is_cogo_eligible"]:
            self.eligibility_label.setText("✅ COGO ELIGIBLE - Deal meets requirements!")
            self.eligibility_label.setStyleSheet("""
                QLabel {
                    font-size: 16px;
                    font-weight: bold;
                    padding: 10px;
                    border: 2px solid #4CAF50;
                    border-radius: 5px;
                    background-color: #E8F5E8;
                    color: #2E7D32;
                }
            """)
        else:
            self.eligibility_label.setText("❌ NOT ELIGIBLE - Deal does not meet COGO requirements")
            self.eligibility_label.setStyleSheet("""
                QLabel {
                    font-size: 16px;
                    font-weight: bold;
                    padding: 10px;
                    border: 2px solid #F44336;
                    border-radius: 5px;
                    background-color: #FFEBEE;
                    color: #C62828;
                }
            """)
    
    def clear_results(self):
        """Clear all results."""
        self.results_text.clear()
        self.eligibility_label.setText("COGO Eligibility: Not Analyzed")
        self.eligibility_label.setStyleSheet("""
            QLabel {
                font-size: 16px;
                font-weight: bold;
                padding: 10px;
                border: 2px solid #ccc;
                border-radius: 5px;
                background-color: #f0f0f0;
            }
        """)


class SimpleCOGOAnalyzerGUI(QMainWindow):
    """Simplified main application window."""
    
    def __init__(self):
        super().__init__()
        self.analyzer = DealAnalyzer()
        self.current_results = None
        self.init_ui()
    
    def init_ui(self):
        """Initialize the user interface."""
        self.setWindowTitle("COGO Capital Deal Analyzer - Simplified v1.0")
        self.setGeometry(100, 100, 900, 600)
        
        # Create central widget and main layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        
        # Left side - Input
        left_layout = QVBoxLayout()
        self.input_widget = SimpleDealInputWidget()
        left_layout.addWidget(self.input_widget)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.analyze_btn = QPushButton("Analyze Deal")
        self.analyze_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-size: 14px;
                font-weight: bold;
                padding: 10px;
                border: none;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        self.analyze_btn.clicked.connect(self.analyze_deal)
        
        self.clear_btn = QPushButton("Clear")
        self.clear_btn.clicked.connect(self.clear_all)
        
        button_layout.addWidget(self.analyze_btn)
        button_layout.addWidget(self.clear_btn)
        
        left_layout.addLayout(button_layout)
        left_layout.addStretch()
        
        # Right side - Results
        self.results_widget = SimpleResultsWidget()
        
        # Add to main layout
        main_layout.addLayout(left_layout, 1)
        main_layout.addWidget(self.results_widget, 2)
    
    def analyze_deal(self):
        """Perform deal analysis."""
        try:
            # Get deal data from input
            deal_data = self.input_widget.get_deal_data()
            
            # Validate inputs
            if not all([deal_data["arv"], deal_data["purchase_price"]]):
                QMessageBox.warning(self, "Input Error", 
                                  "Please enter valid ARV and Purchase Price values.")
                return
            
            # Perform analysis directly (no threading to avoid crashes)
            results = self.analyzer.calculate_deal_metrics(deal_data)
            self.current_results = results
            self.results_widget.update_results(results)
            
        except ValueError as e:
            QMessageBox.warning(self, "Input Error", str(e))
        except Exception as e:
            QMessageBox.critical(self, "Analysis Error", f"Failed to analyze deal:\n{str(e)}")
    
    def clear_all(self):
        """Clear all inputs and results."""
        self.input_widget.clear_inputs()
        self.results_widget.clear_results()
        self.current_results = None


def main():
    """Main application entry point."""
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("COGO Deal Analyzer - Simplified")
    app.setApplicationVersion("1.0.0")
    
    # Create and show main window
    window = SimpleCOGOAnalyzerGUI()
    window.show()
    
    return app.exec_()


if __name__ == "__main__":
    sys.exit(main())