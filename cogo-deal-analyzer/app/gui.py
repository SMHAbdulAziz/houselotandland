"""
COGO Deal Analyzer - GUI Module

This module provides the PyQt5 graphical user interface for the 
COGO Capital Deal Analyzer application.
"""

import sys
import os
from datetime import datetime
from typing import Optional
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QGridLayout, QLabel, QLineEdit, QPushButton, QTextEdit, 
    QGroupBox, QFrame, QMessageBox, QFileDialog, QTabWidget,
    QTableWidget, QTableWidgetItem, QHeaderView, QSplitter,
    QProgressBar, QStatusBar, QComboBox, QCheckBox, QDialog,
    QFormLayout, QDialogButtonBox, QScrollArea
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QFont, QPixmap, QIcon, QPalette, QColor

# Import our analyzer module
try:
    # Try relative import first (when run as package)
    from .analyzer import DealAnalyzer
    from .utils import format_currency, export_to_pdf, save_deal_report
except ImportError:
    # Fallback to absolute import (when run as script)
    from analyzer import DealAnalyzer
    from utils import format_currency, export_to_pdf, save_deal_report


class AnalysisWorker(QThread):
    """Worker thread for performing deal analysis without blocking UI."""
    
    analysis_complete = pyqtSignal(dict)
    analysis_error = pyqtSignal(str)
    
    def __init__(self, deal_data):
        super().__init__()
        self.deal_data = deal_data
        self.analyzer = DealAnalyzer()
    
    def run(self):
        try:
            results = self.analyzer.calculate_deal_metrics(self.deal_data)
            self.analysis_complete.emit(results)
        except Exception as e:
            import traceback
            error_msg = f"Analysis failed: {str(e)}\n\nDetails:\n{traceback.format_exc()}"
            print(f"Worker thread error: {error_msg}")
            self.analysis_error.emit(error_msg)


class DealInputWidget(QGroupBox):
    """Widget for deal input form."""
    
    def __init__(self):
        super().__init__("Deal Input")
        self.init_ui()
    
    def init_ui(self):
        layout = QGridLayout()
        
        # Property Address Input
        layout.addWidget(QLabel("Property Address:"), 0, 0)
        self.address_input = QLineEdit()
        self.address_input.setPlaceholderText("e.g., 123 Main St, City, State 12345")
        layout.addWidget(self.address_input, 0, 1, 1, 2)
        
        # ARV Input
        layout.addWidget(QLabel("ARV (After Repair Value):"), 1, 0)
        self.arv_input = QLineEdit()
        self.arv_input.setPlaceholderText("e.g., 250000")
        layout.addWidget(self.arv_input, 1, 1)
        layout.addWidget(QLabel("$"), 1, 2)
        
        # Purchase Price Input
        layout.addWidget(QLabel("Purchase Price:"), 2, 0)
        self.purchase_input = QLineEdit()
        self.purchase_input.setPlaceholderText("e.g., 180000")
        layout.addWidget(self.purchase_input, 2, 1)
        layout.addWidget(QLabel("$"), 2, 2)
        
        # Rehab Cost Input
        layout.addWidget(QLabel("Estimated Rehab Cost:"), 3, 0)
        self.rehab_input = QLineEdit()
        self.rehab_input.setPlaceholderText("e.g., 30000")
        layout.addWidget(self.rehab_input, 3, 1)
        layout.addWidget(QLabel("$"), 3, 2)
        
        # Broker Fee Input
        layout.addWidget(QLabel("Broker Fee:"), 4, 0)
        self.broker_fee_input = QLineEdit()
        self.broker_fee_input.setText("3.0")  # Default 3%
        self.broker_fee_input.setPlaceholderText("e.g., 3.0")
        layout.addWidget(self.broker_fee_input, 4, 1)
        layout.addWidget(QLabel("%"), 4, 2)
        
        # Exit Strategy Selection
        layout.addWidget(QLabel("Exit Strategy:"), 5, 0)
        self.strategy_combo = QComboBox()
        
        # Get exit strategies from analyzer
        try:
            analyzer = DealAnalyzer()
            strategies = analyzer.EXIT_STRATEGIES
            for key, strategy in strategies.items():
                # Calculate total rate from components
                total_rate = (strategy.get('agent_commission', 0) + 
                             strategy.get('title_closing', 0) + 
                             strategy.get('misc_costs', 0)) * 100
                strategy_text = f"{strategy['name']} ({total_rate:.1f}%)"
                self.strategy_combo.addItem(strategy_text, key)
        except Exception as e:
            print(f"Error loading exit strategies: {e}")
            # Fallback if analyzer not available
            self.strategy_combo.addItem("MLS Listing (8.0%)", "mls_listing")
            self.strategy_combo.addItem("Wholesale (1.5%)", "wholesale")
        
        layout.addWidget(self.strategy_combo, 5, 1, 1, 2)
        
        # Strategy cost preview
        self.strategy_preview = QLabel("Selling costs will be calculated based on selected strategy")
        self.strategy_preview.setStyleSheet("color: #666; font-size: 11px;")
        layout.addWidget(self.strategy_preview, 6, 0, 1, 3)
        
        self.setLayout(layout)
    
    def get_deal_data(self) -> dict:
        """Extract deal data from input fields."""
        try:
            deal_data = {
                "property_address": self.address_input.text().strip(),
                "arv": float(self.arv_input.text().replace(",", "") or 0),
                "purchase_price": float(self.purchase_input.text().replace(",", "") or 0),
                "rehab": float(self.rehab_input.text().replace(",", "") or 0),
                "broker_fee_percent": float(self.broker_fee_input.text() or 3.0)
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
        self.address_input.clear()
        self.arv_input.clear()
        self.purchase_input.clear()
        self.rehab_input.clear()
        self.broker_fee_input.setText("3.0")  # Reset to default 3%
        self.strategy_combo.setCurrentIndex(0)  # Reset to first strategy


class DealResultsWidget(QGroupBox):
    """Widget for displaying deal analysis results."""
    
    def __init__(self):
        super().__init__("Analysis Results")
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Results table
        self.results_table = QTableWidget(0, 2)
        self.results_table.setHorizontalHeaderLabels(["Metric", "Value"])
        self.results_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.results_table.setAlternatingRowColors(True)
        layout.addWidget(self.results_table)
        
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
        
        # Clear existing rows
        self.results_table.setRowCount(0)
        
        # Add input values
        self._add_section("INPUT VALUES")
        if input_data.get("property_address"):
            self._add_row("Property Address", input_data["property_address"])
        self._add_row("ARV", format_currency(input_data["arv"]))
        self._add_row("Purchase Price", format_currency(input_data["purchase_price"]))
        self._add_row("Rehab Cost", format_currency(input_data["rehab"]))
        
        # Add loan calculations
        self._add_section("LOAN CALCULATIONS")
        self._add_row("Max Loan (65% ARV)", format_currency(calculations["max_loan_ltv"]))
        self._add_row("Max Loan (80% Purchase)", format_currency(calculations["max_loan_purchase"]))
        self._add_row("Actual Loan Amount", format_currency(calculations["loan_amount"]))
        
        # Add cost breakdown with exit strategy details
        self._add_section("COST BREAKDOWN")
        
        # Show exit strategy info if available
        exit_strategy = results.get("exit_strategy")
        if exit_strategy:
            self._add_row("Exit Strategy", exit_strategy["name"])
            
            # Detailed selling cost breakdown
            selling_costs = calculations.get("selling_costs", {})
            total_rate = selling_costs.get("total_rate", 8.0) * 100  # Convert to percentage
            self._add_row(f"Selling Costs ({total_rate:.1f}%)", format_currency(selling_costs.get("total", 0)))
            
            # Show breakdown if available
            if selling_costs:
                agent_rate = selling_costs.get("agent_commission_rate", 0) * 100
                title_rate = selling_costs.get("title_closing_rate", 0) * 100  
                misc_rate = selling_costs.get("misc_costs_rate", 0) * 100
                
                if agent_rate > 0:
                    self._add_row(f"  • Agent Commissions ({agent_rate:.1f}%)", 
                                format_currency(selling_costs.get("agent_commission", 0)))
                if title_rate > 0:
                    self._add_row(f"  • Title & Closing ({title_rate:.1f}%)", 
                                format_currency(selling_costs.get("title_closing", 0)))
                if misc_rate > 0:
                    self._add_row(f"  • Misc/Concessions ({misc_rate:.1f}%)", 
                                format_currency(selling_costs.get("misc_costs", 0)))
        else:
            # Fallback if no selling_costs data
            self._add_row("Selling Costs (8%)", format_currency(0))
        
        # Get broker fee percentage from input data
        broker_fee_percent = results.get("input", {}).get("broker_fee_percent", 3.0)
        self._add_row(f"Broker Fee ({broker_fee_percent:.1f}%)", format_currency(calculations["broker_fee"]))
        self._add_row("Finance Costs (5%)", format_currency(calculations["finance_costs"]))
        self._add_row("Total Costs", format_currency(calculations["total_costs"]))
        
        # Add profitability
        self._add_section("PROFITABILITY")
        self._add_row("Net Profit", format_currency(calculations["net_profit"]))
        self._add_row("Profit Margin", f"{calculations['profit_margin']:.2f}%")
        
        # Update eligibility status
        if eligibility["is_cogo_eligible"]:
            self.eligibility_label.setText("✅ COGO ELIGIBLE")
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
            self.eligibility_label.setText("❌ NOT COGO ELIGIBLE")
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
    
    def _add_section(self, title: str):
        """Add a section header to the results table."""
        row = self.results_table.rowCount()
        self.results_table.insertRow(row)
        
        title_item = QTableWidgetItem(title)
        title_item.setFont(QFont("Arial", 10, QFont.Bold))
        title_item.setBackground(QColor("#E3F2FD"))
        title_item.setForeground(QColor("#000000"))  # Set text color to black
        self.results_table.setItem(row, 0, title_item)
        
        empty_item = QTableWidgetItem("")
        empty_item.setBackground(QColor("#E3F2FD"))
        empty_item.setForeground(QColor("#000000"))  # Set text color to black
        self.results_table.setItem(row, 1, empty_item)
    
    def _add_row(self, metric: str, value: str):
        """Add a metric row to the results table."""
        row = self.results_table.rowCount()
        self.results_table.insertRow(row)
        self.results_table.setItem(row, 0, QTableWidgetItem(f"  {metric}"))
        self.results_table.setItem(row, 1, QTableWidgetItem(value))
    
    def clear_results(self):
        """Clear all results."""
        self.results_table.setRowCount(0)
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


class DocumentChecklistWidget(QGroupBox):
    """Widget for managing COGO document checklist for eligible deals."""
    
    def __init__(self):
        super().__init__("COGO Document Checklist")
        self.analyzer = DealAnalyzer()
        self.deal_id = None
        self.current_deal_results = None
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Status header
        self.status_label = QLabel("No eligible deal loaded")
        self.status_label.setStyleSheet("font-weight: bold; font-size: 14px; color: #666;")
        layout.addWidget(self.status_label)
        

        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Checklist table
        self.checklist_table = QTableWidget(0, 3)
        self.checklist_table.setHorizontalHeaderLabels(["Status", "Document", "Notes"])
        header = self.checklist_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # Status column
        header.setSectionResizeMode(1, QHeaderView.Stretch)  # Document column
        header.setSectionResizeMode(2, QHeaderView.Stretch)  # Notes column
        
        self.checklist_table.setAlternatingRowColors(True)
        self.checklist_table.itemChanged.connect(self.on_item_changed, Qt.QueuedConnection)
        layout.addWidget(self.checklist_table)
        
        self.setLayout(layout)
    
    def show_data_collection_form(self, deal_results: dict):
        """Show additional data collection form for COGO-eligible deals."""
        # Create data collection dialog
        
        dialog = QDialog(self)
        dialog.setWindowTitle("COGO Capital - Additional Data Collection")
        dialog.setModal(True)
        dialog.resize(600, 500)
        
        layout = QVBoxLayout(dialog)
        
        # Header
        header_label = QLabel("📋 COGO Capital Deal Submission - Complete Data Collection")
        header_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #2E7D32; padding: 10px;")
        layout.addWidget(header_label)
        
        # Scroll area for form
        scroll = QScrollArea()
        scroll_widget = QWidget()
        form_layout = QFormLayout(scroll_widget)
        
        # Property Details Section
        property_header = QLabel("🏠 Property Information")
        property_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(property_header)
        
        self.county_input = QLineEdit()
        self.county_input.setPlaceholderText("e.g., Dallas County - Parcel #12345")
        form_layout.addRow("County & Parcel ID:", self.county_input)
        
        self.property_type_combo = QComboBox()
        self.property_type_combo.addItems(["SFR", "Duplex", "Triplex", "Other"])
        form_layout.addRow("Property Type:", self.property_type_combo)
        
        self.year_built_input = QLineEdit()
        self.year_built_input.setPlaceholderText("e.g., 1985")
        form_layout.addRow("Year Built:", self.year_built_input)
        
        self.sqft_input = QLineEdit()
        self.sqft_input.setPlaceholderText("e.g., 1,850")
        form_layout.addRow("Square Footage:", self.sqft_input)
        
        self.lot_size_input = QLineEdit()
        self.lot_size_input.setPlaceholderText("e.g., 0.25 acres or 7,500 sq ft")
        form_layout.addRow("Lot Size:", self.lot_size_input)
        
        self.bedrooms_input = QLineEdit()
        self.bedrooms_input.setPlaceholderText("e.g., 3")
        form_layout.addRow("Bedrooms:", self.bedrooms_input)
        
        self.bathrooms_input = QLineEdit()
        self.bathrooms_input.setPlaceholderText("e.g., 2")
        form_layout.addRow("Bathrooms:", self.bathrooms_input)
        
        self.garage_input = QLineEdit()
        self.garage_input.setPlaceholderText("e.g., Attached 2-car, 400 sq ft")
        form_layout.addRow("Garage Details:", self.garage_input)
        
        self.rehab_scope_input = QTextEdit()
        self.rehab_scope_input.setPlaceholderText("Brief description of renovation scope (1-3 sentences)")
        self.rehab_scope_input.setMaximumHeight(80)
        form_layout.addRow("Rehab Scope:", self.rehab_scope_input)
        
        # Purchase Details Section
        purchase_header = QLabel("💰 Purchase & Loan Details")
        purchase_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(purchase_header)
        
        self.earnest_money_input = QLineEdit()
        self.earnest_money_input.setPlaceholderText("e.g., 5000")
        form_layout.addRow("Earnest Money ($):", self.earnest_money_input)
        
        self.seller_concessions_input = QLineEdit()
        self.seller_concessions_input.setPlaceholderText("e.g., 3000 (if any)")
        form_layout.addRow("Seller Concessions ($):", self.seller_concessions_input)
        
        self.loan_term_combo = QComboBox()
        self.loan_term_combo.addItems(["6 months", "9 months", "12 months"])
        form_layout.addRow("Preferred Loan Term:", self.loan_term_combo)
        
        self.closing_date_input = QLineEdit()
        self.closing_date_input.setPlaceholderText("MM/DD/YYYY")
        form_layout.addRow("Requested Closing Date:", self.closing_date_input)
        
        self.title_company_input = QLineEdit()
        self.title_company_input.setPlaceholderText("Company name and contact info")
        form_layout.addRow("Title Company:", self.title_company_input)
        
        self.arv_comps_input = QLineEdit()
        self.arv_comps_input.setPlaceholderText("Link or file reference for ARV justification")
        form_layout.addRow("ARV Comps Link/File:", self.arv_comps_input)
        
        # Borrower Information Section
        borrower_header = QLabel("👤 Borrower Information")
        borrower_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(borrower_header)
        
        self.borrower_name_input = QLineEdit()
        self.borrower_name_input.setPlaceholderText("Full legal name")
        form_layout.addRow("Borrower Full Name:", self.borrower_name_input)
        
        self.borrower_phone_input = QLineEdit()
        self.borrower_phone_input.setPlaceholderText("(555) 123-4567")
        form_layout.addRow("Phone Number:", self.borrower_phone_input)
        
        self.borrower_email_input = QLineEdit()
        self.borrower_email_input.setPlaceholderText("borrower@email.com")
        form_layout.addRow("Email Address:", self.borrower_email_input)
        
        self.borrower_address_input = QTextEdit()
        self.borrower_address_input.setPlaceholderText("Full mailing address")
        self.borrower_address_input.setMaximumHeight(60)
        form_layout.addRow("Mailing Address:", self.borrower_address_input)
        
        self.entity_name_input = QLineEdit()
        self.entity_name_input.setPlaceholderText("LLC, Corporation, or Individual")
        form_layout.addRow("Borrowing Entity:", self.entity_name_input)
        
        self.experience_input = QLineEdit()
        self.experience_input.setPlaceholderText("e.g., 5 years, 12 flips completed")
        form_layout.addRow("Real Estate Experience:", self.experience_input)
        
        # Guarantor Information Section
        guarantor_header = QLabel("🤝 Guarantor Information (if applicable)")
        guarantor_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(guarantor_header)
        
        self.guarantor_name_input = QLineEdit()
        self.guarantor_name_input.setPlaceholderText("Full legal name (leave blank if no guarantor)")
        form_layout.addRow("Guarantor Full Name:", self.guarantor_name_input)
        
        self.guarantor_phone_input = QLineEdit()
        self.guarantor_phone_input.setPlaceholderText("(555) 123-4567")
        form_layout.addRow("Guarantor Phone:", self.guarantor_phone_input)
        
        self.guarantor_email_input = QLineEdit()
        self.guarantor_email_input.setPlaceholderText("guarantor@email.com")
        form_layout.addRow("Guarantor Email:", self.guarantor_email_input)
        
        self.guarantor_address_input = QTextEdit()
        self.guarantor_address_input.setPlaceholderText("Full mailing address")
        self.guarantor_address_input.setMaximumHeight(60)
        form_layout.addRow("Guarantor Address:", self.guarantor_address_input)
        
        self.guarantor_relationship_input = QLineEdit()
        self.guarantor_relationship_input.setPlaceholderText("e.g., Business Partner, Spouse, etc.")
        form_layout.addRow("Relationship to Borrower:", self.guarantor_relationship_input)
        
        scroll_widget.setLayout(form_layout)
        scroll.setWidget(scroll_widget)
        layout.addWidget(scroll)
        
        # Buttons
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(lambda: self.save_additional_data(dialog, deal_results))
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        
        dialog.setLayout(layout)
        dialog.exec_()
    
    def save_additional_data(self, dialog, deal_results: dict):
        """Save the additional data collection."""
        # Gather all the additional data
        additional_data = {
            # Property Information
            "county_parcel": self.county_input.text(),
            "property_type": self.property_type_combo.currentText(),
            "year_built": self.year_built_input.text(),
            "square_footage": self.sqft_input.text(),
            "lot_size": self.lot_size_input.text(),
            "bedrooms": self.bedrooms_input.text(),
            "bathrooms": self.bathrooms_input.text(),
            "garage_details": self.garage_input.text(),
            "rehab_scope": self.rehab_scope_input.toPlainText(),
            # Purchase & Loan Details
            "earnest_money": self.earnest_money_input.text(),
            "seller_concessions": self.seller_concessions_input.text(),
            "loan_term": self.loan_term_combo.currentText(),
            "closing_date": self.closing_date_input.text(),
            "title_company": self.title_company_input.text(),
            "arv_comps": self.arv_comps_input.text(),
            # Borrower Information
            "borrower_name": self.borrower_name_input.text(),
            "borrower_phone": self.borrower_phone_input.text(),
            "borrower_email": self.borrower_email_input.text(),
            "borrower_address": self.borrower_address_input.toPlainText(),
            "entity_name": self.entity_name_input.text(),
            "experience": self.experience_input.text(),
            # Guarantor Information
            "guarantor_name": self.guarantor_name_input.text(),
            "guarantor_phone": self.guarantor_phone_input.text(),
            "guarantor_email": self.guarantor_email_input.text(),
            "guarantor_address": self.guarantor_address_input.toPlainText(),
            "guarantor_relationship": self.guarantor_relationship_input.text(),
            "collection_date": datetime.now().isoformat()
        }
        
        # Add to deal results
        deal_results["additional_data"] = additional_data
        
        # Save updated deal
        try:
            import os
            from utils import save_deal_report
            
            # Ensure reports directory exists (in app folder)
            app_dir = os.path.dirname(os.path.abspath(__file__))
            reports_dir = os.path.join(app_dir, "reports")
            if not os.path.exists(reports_dir):
                os.makedirs(reports_dir)
            
            deal_id = deal_results.get("deal_id", f"DEAL_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            filepath = os.path.join(reports_dir, f"{deal_id}_complete.json")
            save_deal_report(deal_results, "json", filepath)
            
            # Update status
            self.status_label.setText(f"✅ Complete Deal Package Saved: {deal_id}")
            
        except Exception as e:
            QMessageBox.warning(self, "Save Error", f"Failed to save additional data: {str(e)}")
        
        dialog.accept()
    
    def reopen_data_collection_form(self):
        """Reopen the data collection form with existing data for editing."""
        if not self.current_deal_results:
            QMessageBox.warning(self, "No Deal Data", "No deal data available to edit.")
            return
            
        # Show the data collection form with existing data
        self.show_data_collection_form_with_data(self.current_deal_results)
    
    def show_data_collection_form_with_data(self, deal_results: dict):
        """Show data collection form populated with existing data."""
        # Create data collection dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("COGO Capital - Edit Additional Data Collection")
        dialog.setModal(True)
        dialog.resize(600, 500)
        
        layout = QVBoxLayout(dialog)
        
        # Header
        header_label = QLabel("📋 COGO Capital Deal Submission - Edit Data Collection")
        header_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #2E7D32; padding: 10px;")
        layout.addWidget(header_label)
        
        # Scroll area for form
        scroll = QScrollArea()
        scroll_widget = QWidget()
        form_layout = QFormLayout(scroll_widget)
        
        # Get existing additional data
        existing_data = deal_results.get("additional_data", {})
        
        # Property Details Section
        property_header = QLabel("🏠 Property Information")
        property_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(property_header)
        
        self.county_input = QLineEdit(existing_data.get("county_parcel", ""))
        self.county_input.setPlaceholderText("e.g., Dallas County - Parcel #12345")
        form_layout.addRow("County & Parcel ID:", self.county_input)
        
        self.property_type_combo = QComboBox()
        self.property_type_combo.addItems(["SFR", "Duplex", "Triplex", "Other"])
        existing_type = existing_data.get("property_type", "SFR")
        index = self.property_type_combo.findText(existing_type)
        if index >= 0:
            self.property_type_combo.setCurrentIndex(index)
        form_layout.addRow("Property Type:", self.property_type_combo)
        
        self.year_built_input = QLineEdit(existing_data.get("year_built", ""))
        self.year_built_input.setPlaceholderText("e.g., 1985")
        form_layout.addRow("Year Built:", self.year_built_input)
        
        self.sqft_input = QLineEdit(existing_data.get("square_footage", ""))
        self.sqft_input.setPlaceholderText("e.g., 1,850")
        form_layout.addRow("Square Footage:", self.sqft_input)
        
        self.lot_size_input = QLineEdit(existing_data.get("lot_size", ""))
        self.lot_size_input.setPlaceholderText("e.g., 0.25 acres or 7,500 sq ft")
        form_layout.addRow("Lot Size:", self.lot_size_input)
        
        self.bedrooms_input = QLineEdit(existing_data.get("bedrooms", ""))
        self.bedrooms_input.setPlaceholderText("e.g., 3")
        form_layout.addRow("Bedrooms:", self.bedrooms_input)
        
        self.bathrooms_input = QLineEdit(existing_data.get("bathrooms", ""))
        self.bathrooms_input.setPlaceholderText("e.g., 2")
        form_layout.addRow("Bathrooms:", self.bathrooms_input)
        
        self.garage_input = QLineEdit(existing_data.get("garage_details", ""))
        self.garage_input.setPlaceholderText("e.g., Attached 2-car, 400 sq ft")
        form_layout.addRow("Garage Details:", self.garage_input)
        
        self.rehab_scope_input = QTextEdit()
        self.rehab_scope_input.setPlainText(existing_data.get("rehab_scope", ""))
        self.rehab_scope_input.setPlaceholderText("Brief description of renovation scope (1-3 sentences)")
        self.rehab_scope_input.setMaximumHeight(80)
        form_layout.addRow("Rehab Scope:", self.rehab_scope_input)
        
        # Purchase Details Section
        purchase_header = QLabel("💰 Purchase & Loan Details")
        purchase_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(purchase_header)
        
        self.earnest_money_input = QLineEdit(existing_data.get("earnest_money", ""))
        self.earnest_money_input.setPlaceholderText("e.g., 5000")
        form_layout.addRow("Earnest Money ($):", self.earnest_money_input)
        
        self.seller_concessions_input = QLineEdit(existing_data.get("seller_concessions", ""))
        self.seller_concessions_input.setPlaceholderText("e.g., 3000 (if any)")
        form_layout.addRow("Seller Concessions ($):", self.seller_concessions_input)
        
        self.loan_term_combo = QComboBox()
        self.loan_term_combo.addItems(["6 months", "9 months", "12 months"])
        existing_term = existing_data.get("loan_term", "6 months")
        term_index = self.loan_term_combo.findText(existing_term)
        if term_index >= 0:
            self.loan_term_combo.setCurrentIndex(term_index)
        form_layout.addRow("Preferred Loan Term:", self.loan_term_combo)
        
        self.closing_date_input = QLineEdit(existing_data.get("closing_date", ""))
        self.closing_date_input.setPlaceholderText("MM/DD/YYYY")
        form_layout.addRow("Requested Closing Date:", self.closing_date_input)
        
        self.title_company_input = QLineEdit(existing_data.get("title_company", ""))
        self.title_company_input.setPlaceholderText("Company name and contact info")
        form_layout.addRow("Title Company:", self.title_company_input)
        
        self.arv_comps_input = QLineEdit(existing_data.get("arv_comps", ""))
        self.arv_comps_input.setPlaceholderText("Link or file reference for ARV justification")
        form_layout.addRow("ARV Comps Link/File:", self.arv_comps_input)
        
        # Borrower Information Section
        borrower_header = QLabel("👤 Borrower Information")
        borrower_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(borrower_header)
        
        self.borrower_name_input = QLineEdit(existing_data.get("borrower_name", ""))
        self.borrower_name_input.setPlaceholderText("Full legal name")
        form_layout.addRow("Borrower Full Name:", self.borrower_name_input)
        
        self.borrower_phone_input = QLineEdit(existing_data.get("borrower_phone", ""))
        self.borrower_phone_input.setPlaceholderText("(555) 123-4567")
        form_layout.addRow("Phone Number:", self.borrower_phone_input)
        
        self.borrower_email_input = QLineEdit(existing_data.get("borrower_email", ""))
        self.borrower_email_input.setPlaceholderText("borrower@email.com")
        form_layout.addRow("Email Address:", self.borrower_email_input)
        
        self.borrower_address_input = QTextEdit()
        self.borrower_address_input.setPlainText(existing_data.get("borrower_address", ""))
        self.borrower_address_input.setPlaceholderText("Full mailing address")
        self.borrower_address_input.setMaximumHeight(60)
        form_layout.addRow("Mailing Address:", self.borrower_address_input)
        
        self.entity_name_input = QLineEdit(existing_data.get("entity_name", ""))
        self.entity_name_input.setPlaceholderText("LLC, Corporation, or Individual")
        form_layout.addRow("Borrowing Entity:", self.entity_name_input)
        
        self.experience_input = QLineEdit(existing_data.get("experience", ""))
        self.experience_input.setPlaceholderText("e.g., 5 years, 12 flips completed")
        form_layout.addRow("Real Estate Experience:", self.experience_input)
        
        # Guarantor Information Section
        guarantor_header = QLabel("🤝 Guarantor Information (if applicable)")
        guarantor_header.setStyleSheet("font-size: 14px; font-weight: bold; color: #1976D2; margin-top: 15px;")
        form_layout.addRow(guarantor_header)
        
        self.guarantor_name_input = QLineEdit(existing_data.get("guarantor_name", ""))
        self.guarantor_name_input.setPlaceholderText("Full legal name (leave blank if no guarantor)")
        form_layout.addRow("Guarantor Full Name:", self.guarantor_name_input)
        
        self.guarantor_phone_input = QLineEdit(existing_data.get("guarantor_phone", ""))
        self.guarantor_phone_input.setPlaceholderText("(555) 123-4567")
        form_layout.addRow("Guarantor Phone:", self.guarantor_phone_input)
        
        self.guarantor_email_input = QLineEdit(existing_data.get("guarantor_email", ""))
        self.guarantor_email_input.setPlaceholderText("guarantor@email.com")
        form_layout.addRow("Guarantor Email:", self.guarantor_email_input)
        
        self.guarantor_address_input = QTextEdit()
        self.guarantor_address_input.setPlainText(existing_data.get("guarantor_address", ""))
        self.guarantor_address_input.setPlaceholderText("Full mailing address")
        self.guarantor_address_input.setMaximumHeight(60)
        form_layout.addRow("Guarantor Address:", self.guarantor_address_input)
        
        self.guarantor_relationship_input = QLineEdit(existing_data.get("guarantor_relationship", ""))
        self.guarantor_relationship_input.setPlaceholderText("e.g., Business Partner, Spouse, etc.")
        form_layout.addRow("Relationship to Borrower:", self.guarantor_relationship_input)
        
        scroll_widget.setLayout(form_layout)
        scroll.setWidget(scroll_widget)
        layout.addWidget(scroll)
        
        # Buttons
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(lambda: self.save_additional_data(dialog, deal_results))
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        
        dialog.setLayout(layout)
        dialog.exec_()
    
    def clear_checklist_table(self):
        """Safely clear the checklist table and disconnect signals."""
        # Disconnect all checkbox signals before clearing
        for row in range(self.checklist_table.rowCount()):
            widget = self.checklist_table.cellWidget(row, 0)
            if widget and isinstance(widget, QCheckBox):
                try:
                    widget.stateChanged.disconnect()
                except:
                    pass  # Ignore if already disconnected
        
        # Clear the table
        self.checklist_table.setRowCount(0)
    
    def load_checklist(self, deal_results: dict):
        """Load document checklist for an eligible deal."""
        try:
            # Store current deal results
            self.current_deal_results = deal_results
            
            profit = deal_results.get("calculations", {}).get("net_profit", 0)
            
            if profit < 20000:
                self.status_label.setText("Deal not eligible for COGO loan (profit < $20,000)")
                self.status_label.setStyleSheet("font-weight: bold; font-size: 14px; color: red;")
                self.progress_bar.setVisible(False)
                self.checklist_table.setRowCount(0)
                self.data_collection_btn.setVisible(False)
                return
            
            self.deal_id = deal_results.get("deal_id", "unknown")
            property_address = deal_results.get("input", {}).get("property_address", "N/A")
            self.status_label.setText(f"✅ COGO ELIGIBLE DEAL - Data Collection Required")
            self.status_label.setStyleSheet("font-weight: bold; font-size: 14px; color: green;")
            
            self.progress_bar.setVisible(True)
            
            # Generate checklist from deal results
            try:
                checklist = self.analyzer.generate_document_checklist(deal_results)
                self.current_checklist = checklist
                self.update_checklist_display(checklist)
            except Exception as e:
                print(f"Error generating checklist: {e}")
                self.status_label.setText("Error generating document checklist")
                self.status_label.setStyleSheet("font-weight: bold; font-size: 14px; color: red;")
                
        except Exception as e:
            print(f"Error in load_checklist: {e}")
            self.status_label.setText("Error loading checklist")
            self.status_label.setStyleSheet("font-weight: bold; font-size: 14px; color: red;")
    
    def update_checklist_display(self, checklist: dict):
        """Update the checklist table display."""
        if not checklist.get('eligible', False):
            return
        
        # Clear existing table and disconnect signals to prevent crashes
        self.clear_checklist_table()
        
        broker_docs = checklist.get('broker_required', [])
        lender_docs = checklist.get('lender_provided', [])
        all_docs = broker_docs + lender_docs
        
        self.checklist_table.setRowCount(len(all_docs))
        
        completed = 0
        for i, doc in enumerate(all_docs):
            # Status checkbox (only for broker docs)
            checkbox = QCheckBox()
            is_broker_doc = i < len(broker_docs)
            
            if is_broker_doc:
                checkbox.setChecked(doc.get('collected', False))
                # Store row index as property for safer access
                checkbox.row_index = i
                # Use Qt.QueuedConnection for safer signal handling
                checkbox.stateChanged.connect(self.on_checkbox_changed, Qt.QueuedConnection)
                if doc.get('collected', False):
                    completed += 1
            else:
                checkbox.setChecked(True)  # Lender docs are handled by lender
                checkbox.setEnabled(False)
                checkbox.setToolTip("This document will be obtained by the lender")
            
            self.checklist_table.setCellWidget(i, 0, checkbox)
            
            # Document name
            doc_item = QTableWidgetItem(doc['name'])
            doc_item.setFlags(doc_item.flags() & ~Qt.ItemIsEditable)  # Make read-only
            if not is_broker_doc:
                doc_item.setBackground(QColor(240, 248, 255))  # Light blue for lender docs
                doc_item.setToolTip("Lender responsibility")
            self.checklist_table.setItem(i, 1, doc_item)
            
            # Notes (only editable for broker docs)
            notes_text = doc.get('notes', '') if is_broker_doc else "Handled by lender"
            notes_item = QTableWidgetItem(notes_text)
            if not is_broker_doc:
                notes_item.setFlags(notes_item.flags() & ~Qt.ItemIsEditable)
                notes_item.setBackground(QColor(240, 248, 255))
            self.checklist_table.setItem(i, 2, notes_item)
        
        # Update progress (only count broker docs)
        broker_total = len(broker_docs)
        self.progress_bar.setMaximum(broker_total)
        self.progress_bar.setValue(completed)
        progress_text = f"Broker Documents: {completed}/{broker_total} ({(completed/broker_total*100):.1f}%)" if broker_total > 0 else "No documents"
        self.progress_bar.setFormat(progress_text)
    
    def on_checkbox_changed(self, state):
        """Handle checkbox state change."""
        # Get the checkbox that sent the signal
        sender = self.sender()
        if not hasattr(sender, 'row_index') or not hasattr(self, 'current_checklist'):
            return
            
        row = sender.row_index
        broker_docs = self.current_checklist.get('broker_required', [])
        
        if row < len(broker_docs):
            # Get document name from the table
            doc_item = self.checklist_table.item(row, 1)
            if doc_item:
                doc_name = doc_item.text()
                collected = state == Qt.Checked
                
                # Update in current checklist
                updated_checklist = self.analyzer.update_document_status(
                    self.current_checklist, doc_name, collected)
                self.current_checklist = updated_checklist
                
                # Update progress display
                completed = sum(1 for doc in broker_docs if doc.get('collected', False))
                self.progress_bar.setValue(completed)
                broker_total = len(broker_docs)
                progress_text = f"Broker Documents: {completed}/{broker_total} ({(completed/broker_total*100):.1f}%)" if broker_total > 0 else "No documents"
                self.progress_bar.setFormat(progress_text)
    
    def on_item_changed(self, item):
        """Handle notes changes."""
        if item.column() == 2 and hasattr(self, 'current_checklist'):  # Notes column
            broker_docs = self.current_checklist.get('broker_required', [])
            if item.row() < len(broker_docs):
                doc_item = self.checklist_table.item(item.row(), 1)
                if doc_item:
                    doc_name = doc_item.text()
                    notes = item.text()
                    
                    # Update notes in current checklist
                    updated_checklist = self.analyzer.update_document_status(
                        self.current_checklist, doc_name, 
                        broker_docs[item.row()].get('collected', False), notes)
                    self.current_checklist = updated_checklist


class DealHistoryWidget(QWidget):
    """Widget for viewing deal history."""
    
    def __init__(self, main_window=None):
        super().__init__()
        self.analyzer = DealAnalyzer()
        self.main_window = main_window
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Search section
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("Search:"))
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by borrower name or property address...")
        self.search_input.textChanged.connect(self.filter_table)
        search_layout.addWidget(self.search_input)
        
        # Clear search button
        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(self.clear_search)
        search_layout.addWidget(clear_btn)
        
        layout.addLayout(search_layout)
        
        # History table with enhanced columns
        self.history_table = QTableWidget(0, 7)
        self.history_table.setHorizontalHeaderLabels([
            "Deal ID", "Date", "Property Address", "Borrower Name", "Profit", "Eligible", "Actions"
        ])
        
        # Set column widths
        header = self.history_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # Deal ID
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)  # Date
        header.setSectionResizeMode(2, QHeaderView.Stretch)  # Property Address
        header.setSectionResizeMode(3, QHeaderView.Stretch)  # Borrower Name
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # Profit
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # Eligible
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)  # Actions
        
        layout.addWidget(self.history_table)
        
        # Store all deals data for filtering
        self.all_deals = []
        
        # Refresh button
        refresh_btn = QPushButton("Refresh History")
        refresh_btn.clicked.connect(self.refresh_history, Qt.QueuedConnection)
        layout.addWidget(refresh_btn)
        
        self.setLayout(layout)
    
    def refresh_history(self):
        """Refresh the deal history display."""
        try:
            # Load from both session history and saved deals
            history = []
            
            # Add session history
            session_history = getattr(self.analyzer, 'deal_history', [])
            history.extend(session_history)
            
            # Load saved deal files from reports directory
            try:
                import os
                import json
                # Use app/reports directory
                app_dir = os.path.dirname(os.path.abspath(__file__))
                reports_dir = os.path.join(app_dir, "reports")
                if os.path.exists(reports_dir):
                    for filename in os.listdir(reports_dir):
                        if filename.endswith('.json'):
                            filepath = os.path.join(reports_dir, filename)
                            try:
                                with open(filepath, 'r') as f:
                                    deal_data = json.load(f)
                                    # Add to history if not already present
                                    deal_id = deal_data.get('deal_id', filename.replace('.json', ''))
                                    if not any(h.get('deal_id') == deal_id for h in history):
                                        # Extract date from deal_id or analysis_date
                                        date_str = self.extract_formatted_date(deal_data, deal_id)
                                        
                                        # Extract property address
                                        property_address = deal_data.get('input', {}).get('property_address', 'N/A')
                                        
                                        # Extract borrower name from additional data
                                        borrower_name = deal_data.get('additional_data', {}).get('borrower_name', 'N/A')
                                        
                                        history.append({
                                            'deal_id': deal_id,
                                            'timestamp': date_str,
                                            'property_address': property_address,
                                            'borrower_name': borrower_name,
                                            'profit': deal_data.get('calculations', {}).get('net_profit', 0),
                                            'eligible': deal_data.get('eligibility', {}).get('is_cogo_eligible', False),
                                            'filepath': filepath
                                        })
                            except (json.JSONDecodeError, KeyError):
                                continue  # Skip invalid files
            except Exception as e:
                print(f"Error loading saved deals: {e}")
            
            # Store all deals for filtering
            self.all_deals = history
            
            # Apply current filter (if any)
            self.update_table_display()
                
        except Exception as e:
            QMessageBox.warning(self, "History Error", f"Failed to refresh history: {str(e)}")
    
    def extract_formatted_date(self, deal_data, deal_id):
        """Extract and format date from deal data."""
        # First try to extract from deal_id (format: DEAL_YYYYMMDD_HHMMSS)
        if deal_id.startswith('DEAL_') and len(deal_id) >= 13:
            try:
                date_part = deal_id.split('_')[1]  # YYYYMMDD
                if len(date_part) == 8:
                    year = date_part[:4]
                    month = date_part[4:6]
                    day = date_part[6:8]
                    return f"{month}/{day}/{year}"
            except:
                pass
        
        # Fallback to analysis_date
        analysis_date = deal_data.get('analysis_date')
        if analysis_date:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(analysis_date.replace('Z', '+00:00'))
                return dt.strftime("%m/%d/%Y")
            except:
                pass
        
        return "Unknown"
    
    def filter_table(self):
        """Filter the table based on search input."""
        search_text = self.search_input.text().lower().strip()
        if not search_text:
            self.update_table_display()
            return
        
        # Filter deals based on borrower name or property address
        filtered_deals = []
        for deal in self.all_deals:
            borrower_name = deal.get('borrower_name', '').lower()
            property_address = deal.get('property_address', '').lower()
            
            if search_text in borrower_name or search_text in property_address:
                filtered_deals.append(deal)
        
        self.update_table_display(filtered_deals)
    
    def clear_search(self):
        """Clear the search input and show all deals."""
        self.search_input.clear()
        self.update_table_display()
    
    def update_table_display(self, deals_to_show=None):
        """Update the table display with the given deals."""
        if deals_to_show is None:
            deals_to_show = self.all_deals
        
        # Clear existing table safely
        for row in range(self.history_table.rowCount()):
            widget = self.history_table.cellWidget(row, 6)  # Load button column (now column 6)
            if widget:
                try:
                    widget.clicked.disconnect()
                except:
                    pass  # Ignore if already disconnected
        
        # Update table
        self.history_table.setRowCount(len(deals_to_show))
        
        for i, deal in enumerate(deals_to_show):
            self.history_table.setItem(i, 0, QTableWidgetItem(deal.get("deal_id", "N/A")))
            self.history_table.setItem(i, 1, QTableWidgetItem(deal.get("timestamp", "N/A")))
            self.history_table.setItem(i, 2, QTableWidgetItem(deal.get("property_address", "N/A")))
            self.history_table.setItem(i, 3, QTableWidgetItem(deal.get("borrower_name", "N/A")))
            self.history_table.setItem(i, 4, QTableWidgetItem(format_currency(deal.get("profit", 0))))
            self.history_table.setItem(i, 5, QTableWidgetItem("✅" if deal.get("eligible") else "❌"))
            
            # Add load button
            load_btn = QPushButton("Load")
            load_btn.filepath = deal.get("filepath")  # Store filepath as property
            
            # Use lambda to avoid signal connection issues
            load_btn.clicked.connect(
                lambda checked, fp=deal.get("filepath"): self.load_deal_safe(fp), 
                Qt.QueuedConnection
            )
            self.history_table.setCellWidget(i, 6, load_btn)
    
    def load_deal_safe(self, filepath: str):
        """Safe wrapper for loading deals."""
        try:
            self.load_deal(filepath)
        except Exception as e:
            QMessageBox.critical(self, "Load Error", f"Failed to load deal: {str(e)}")
    
    def load_deal(self, filepath: str):
        """Load a deal from file and populate the GUI."""
        try:
            if not filepath or not os.path.exists(filepath):
                QMessageBox.warning(self, "File Not Found", f"Deal file not found: {filepath}")
                return
                
            # Load the deal data
            import json
            with open(filepath, 'r') as f:
                deal_data = json.load(f)
            
            # Get the main window reference
            if not self.main_window:
                QMessageBox.warning(self, "Error", "Main window reference not available")
                return
                
            # Populate input fields from the loaded deal
            input_data = deal_data.get('input', deal_data.get('input_data', {}))
            if input_data:
                # Property Address
                if hasattr(self.main_window.input_widget, 'address_input'):
                    self.main_window.input_widget.address_input.setText(
                        input_data.get('property_address', ''))
                
                # Basic inputs - handle both 'rehab' and 'estimated_rehab_cost' keys
                self.main_window.input_widget.arv_input.setText(str(input_data.get('arv', '')))
                self.main_window.input_widget.purchase_input.setText(str(input_data.get('purchase_price', '')))
                
                rehab_cost = input_data.get('rehab', input_data.get('estimated_rehab_cost', ''))
                self.main_window.input_widget.rehab_input.setText(str(rehab_cost))
                
                # Broker fee
                broker_fee = input_data.get('broker_fee_percent', 3.0)
                self.main_window.input_widget.broker_fee_input.setText(str(broker_fee))
                
                # Exit strategy
                exit_strategy = input_data.get('exit_strategy', '')
                if hasattr(self.main_window.input_widget, 'strategy_combo'):
                    index = self.main_window.input_widget.strategy_combo.findText(exit_strategy)
                    if index >= 0:
                        self.main_window.input_widget.strategy_combo.setCurrentIndex(index)
            
            # Set current results and display
            self.main_window.current_results = deal_data
            
            # Switch to Deal Analysis tab
            if hasattr(self.main_window, 'tab_widget'):
                self.main_window.tab_widget.setCurrentIndex(0)
                
            # Update results display
            if hasattr(self.main_window, 'results_widget'):
                self.main_window.results_widget.update_results(deal_data)
            
            # Load document checklist for the deal
            if hasattr(self.main_window, 'checklist_widget'):
                self.main_window.checklist_widget.load_checklist(deal_data)
            
            # Enable buttons based on deal eligibility
            if hasattr(self.main_window, 'save_btn'):
                self.main_window.save_btn.setEnabled(True)
            if hasattr(self.main_window, 'export_btn'):
                self.main_window.export_btn.setEnabled(True)
            if hasattr(self.main_window, 'data_collection_btn'):
                eligible = deal_data.get("eligibility", {}).get("is_cogo_eligible", False)
                self.main_window.data_collection_btn.setEnabled(eligible)
            
            QMessageBox.information(self, "Deal Loaded", 
                f"Successfully loaded deal: {deal_data.get('deal_id', 'Unknown')}")
                
        except Exception as e:
            QMessageBox.critical(self, "Load Error", f"Failed to load deal: {str(e)}")


class COGODealAnalyzerGUI(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.analyzer = DealAnalyzer()
        self.current_results = None
        self.worker = None
        self.init_ui()
    
    def init_ui(self):
        """Initialize the user interface."""
        self.setWindowTitle("COGO Capital Deal Analyzer v1.0")
        self.setGeometry(100, 100, 1000, 700)
        
        # Create central widget and main layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        # Create tab widget
        tab_widget = QTabWidget()
        
        # Analysis tab
        analysis_tab = QWidget()
        analysis_layout = QHBoxLayout(analysis_tab)
        
        # Left side - Input
        left_panel = QVBoxLayout()
        self.input_widget = DealInputWidget()
        left_panel.addWidget(self.input_widget)
        
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
        
        self.save_btn = QPushButton("Save Report")
        self.save_btn.clicked.connect(self.save_report)
        self.save_btn.setEnabled(False)
        
        self.export_btn = QPushButton("Export PDF")
        self.export_btn.clicked.connect(self.export_pdf)
        self.export_btn.setEnabled(False)
        
        # Data collection button for COGO eligible deals
        self.data_collection_btn = QPushButton("📝 Edit Additional Data")
        self.data_collection_btn.setStyleSheet("""
            QPushButton {
                background-color: #2E7D32;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #388E3C;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.data_collection_btn.setEnabled(False)
        self.data_collection_btn.clicked.connect(self.open_data_collection_form)
        
        button_layout.addWidget(self.analyze_btn)
        button_layout.addWidget(self.clear_btn)
        button_layout.addWidget(self.save_btn)
        button_layout.addWidget(self.export_btn)
        button_layout.addWidget(self.data_collection_btn)
        
        left_panel.addLayout(button_layout)
        left_panel.addStretch()
        
        # Right side - Results
        self.results_widget = DealResultsWidget()
        
        # Add to analysis layout
        analysis_layout.addLayout(left_panel, 1)
        analysis_layout.addWidget(self.results_widget, 2)
        
        tab_widget.addTab(analysis_tab, "Deal Analysis")
        
        # Document Checklist tab
        self.checklist_widget = DocumentChecklistWidget()
        tab_widget.addTab(self.checklist_widget, "Document Checklist")
        
        # History tab
        self.history_widget = DealHistoryWidget(self)
        tab_widget.addTab(self.history_widget, "Deal History")
        
        main_layout.addWidget(tab_widget)
        
        # Status bar
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("Ready to analyze deals")
        
        # Progress bar (hidden by default)
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.statusbar.addPermanentWidget(self.progress_bar)
    
    def analyze_deal(self):
        """Perform deal analysis."""
        try:
            # Check if analysis is already running
            if hasattr(self, 'worker') and self.worker is not None and self.worker.isRunning():
                QMessageBox.information(self, "Analysis Running", "Analysis is already in progress. Please wait.")
                return
                
            # Get deal data from input
            deal_data = self.input_widget.get_deal_data()
            
            # Validate inputs
            if not all([deal_data["arv"], deal_data["purchase_price"]]):
                QMessageBox.warning(self, "Input Error", 
                                  "Please enter valid ARV and Purchase Price values.")
                return
            
            # Show progress
            self.progress_bar.setVisible(True)
            self.progress_bar.setRange(0, 0)  # Indeterminate progress
            self.statusbar.showMessage("Analyzing deal...")
            
            # Clean up any existing worker
            self.cleanup_worker()
            
            # Create worker thread
            self.worker = AnalysisWorker(deal_data)
            self.worker.analysis_complete.connect(self.on_analysis_complete, Qt.QueuedConnection)
            self.worker.analysis_error.connect(self.on_analysis_error, Qt.QueuedConnection)
            self.worker.start()
            
        except ValueError as e:
            QMessageBox.warning(self, "Input Error", str(e))
    
    def on_analysis_complete(self, results: dict):
        """Handle completed analysis."""
        try:
            self.current_results = results
            
            # Update results display with error handling
            try:
                self.results_widget.update_results(results)
            except Exception as e:
                print(f"Error updating results widget: {e}")
                QMessageBox.warning(self, "Display Error", f"Error updating results display: {e}")
            
            # Load document checklist for eligible deals with error handling
            try:
                self.checklist_widget.load_checklist(results)
            except Exception as e:
                print(f"Error loading checklist: {e}")
                QMessageBox.warning(self, "Checklist Error", f"Error loading document checklist: {e}")
            
            # Enable save/export buttons
            try:
                self.save_btn.setEnabled(True)
                self.export_btn.setEnabled(True)
            except Exception as e:
                print(f"Error enabling buttons: {e}")
            
            # Enable data collection button for eligible deals
            try:
                eligible = results.get("eligibility", {}).get("is_cogo_eligible", False)
                self.data_collection_btn.setEnabled(eligible)
            except Exception as e:
                print(f"Error setting data collection button state: {e}")
            
            # Hide progress
            try:
                self.progress_bar.setVisible(False)
            except Exception as e:
                print(f"Error hiding progress bar: {e}")
            
            # Update status
            try:
                profit = results.get("calculations", {}).get("net_profit", 0)
                eligible = results.get("eligibility", {}).get("is_cogo_eligible", False)
                status = f"Analysis complete - Profit: {format_currency(profit)} - {'Eligible' if eligible else 'Not Eligible'}"
                self.statusbar.showMessage(status)
            except Exception as e:
                print(f"Error updating status: {e}")
                self.statusbar.showMessage("Analysis complete")
            
        except Exception as e:
            print(f"Unexpected error in on_analysis_complete: {e}")
            QMessageBox.critical(self, "Analysis Error", f"Unexpected error processing results: {e}")
        finally:
            # Always clean up worker thread
            try:
                self.cleanup_worker()
            except Exception as e:
                print(f"Error cleaning up worker: {e}")
    
    def on_analysis_error(self, error_msg: str):
        """Handle analysis error."""
        self.progress_bar.setVisible(False)
        self.statusbar.showMessage("Analysis failed")
        QMessageBox.critical(self, "Analysis Error", f"Failed to analyze deal:\n{error_msg}")
        
        # Clean up worker thread
        self.cleanup_worker()
    
    def cleanup_worker(self):
        """Clean up worker thread to prevent crashes."""
        if hasattr(self, 'worker') and self.worker is not None:
            # Disconnect all signals to prevent crashes
            try:
                self.worker.analysis_complete.disconnect()
                self.worker.analysis_error.disconnect()
            except (RuntimeError, TypeError):
                # Signals may already be disconnected
                pass
            
            # Clean up the worker thread
            if self.worker.isRunning():
                self.worker.quit()
                self.worker.wait(3000)  # Wait up to 3 seconds
            
            self.worker.deleteLater()
            self.worker = None
    
    def open_data_collection_form(self):
        """Open the data collection form for COGO-eligible deals."""
        if not self.current_results:
            QMessageBox.warning(self, "No Deal Data", "No deal analysis available.")
            return
            
        eligible = self.current_results.get("eligibility", {}).get("is_cogo_eligible", False)
        if not eligible:
            QMessageBox.warning(self, "Deal Not Eligible", "This deal is not eligible for COGO Capital loans.")
            return
            
        # Delegate to the checklist widget's method
        self.checklist_widget.reopen_data_collection_form()
    
    def clear_all(self):
        """Clear all inputs and results."""
        self.input_widget.clear_inputs()
        self.results_widget.clear_results()
        
        # Clear checklist
        self.checklist_widget.status_label.setText("No eligible deal loaded")
        self.checklist_widget.status_label.setStyleSheet("font-weight: bold; font-size: 14px; color: #666;")
        self.checklist_widget.progress_bar.setVisible(False)
        self.checklist_widget.checklist_table.setRowCount(0)
        
        # Disable buttons
        self.data_collection_btn.setEnabled(False)
        
        self.current_results = None
        self.save_btn.setEnabled(False)
        self.export_btn.setEnabled(False)
        self.statusbar.showMessage("Ready to analyze deals")
    
    def save_report(self):
        """Save deal report to file."""
        if not self.current_results:
            return
        
        try:
            # Let user choose save location
            filename, _ = QFileDialog.getSaveFileName(
                self, "Save Deal Report", 
                f"deal_report_{self.current_results.get('deal_id', 'unknown')}.json",
                "JSON Files (*.json);;All Files (*)"
            )
            
            if filename:
                self.analyzer.save_deal(self.current_results, filename)
                QMessageBox.information(self, "Success", f"Report saved to {filename}")
                
                # Refresh deal history to show the new saved deal
                self.history_widget.refresh_history()
                
        except Exception as e:
            QMessageBox.critical(self, "Save Error", f"Failed to save report:\n{str(e)}")
    
    def export_pdf(self):
        """Export deal report to PDF."""
        if not self.current_results:
            return
        
        try:
            # Let user choose save location
            filename, _ = QFileDialog.getSaveFileName(
                self, "Export PDF Report",
                f"deal_report_{self.current_results.get('deal_id', 'unknown')}.pdf",
                "PDF Files (*.pdf);;All Files (*)"
            )
            
            if filename:
                export_to_pdf(self.current_results, filename)
                QMessageBox.information(self, "Success", f"PDF exported to {filename}")
                
        except Exception as e:
            QMessageBox.critical(self, "Export Error", f"Failed to export PDF:\n{str(e)}")


    def closeEvent(self, event):
        """Handle application close event."""
        # Clean up worker thread before closing
        self.cleanup_worker()
        event.accept()


def main():
    """Main application entry point."""
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("COGO Deal Analyzer")
    app.setApplicationVersion("1.0.0")
    
    # Create and show main window
    window = COGODealAnalyzerGUI()
    window.show()
    
    return app.exec_()


if __name__ == "__main__":
    sys.exit(main())