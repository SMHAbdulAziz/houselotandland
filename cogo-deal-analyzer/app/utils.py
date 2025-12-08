"""
COGO Deal Analyzer - Utility Functions Module

This module provides utility functions for formatting, export, 
file handling, and other helper operations.
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import importlib.util


def format_currency(amount: float, include_symbol: bool = True) -> str:
    """
    Format a number as currency.
    
    Args:
        amount (float): The amount to format
        include_symbol (bool): Whether to include the $ symbol
        
    Returns:
        str: Formatted currency string
    """
    if include_symbol:
        return f"${amount:,.2f}"
    else:
        return f"{amount:,.2f}"


def format_percentage(value: float, decimal_places: int = 2) -> str:
    """
    Format a number as percentage.
    
    Args:
        value (float): The value to format (as decimal, e.g., 0.08 for 8%)
        decimal_places (int): Number of decimal places
        
    Returns:
        str: Formatted percentage string
    """
    return f"{value:.{decimal_places}f}%"


def setup_directories() -> bool:
    """
    Setup required application directories.
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Get the base directory (parent of app directory)
        app_dir = Path(__file__).parent
        base_dir = app_dir.parent
        
        # Create required directories
        directories = [
            base_dir / "data",
            base_dir / "reports",
            base_dir / "app" / "templates"
        ]
        
        for directory in directories:
            directory.mkdir(exist_ok=True)
            
        # Create .gitkeep files to ensure directories are tracked
        for directory in directories:
            gitkeep_file = directory / ".gitkeep"
            if not gitkeep_file.exists():
                gitkeep_file.touch()
        
        return True
        
    except Exception as e:
        print(f"Error setting up directories: {e}")
        return False


def check_dependencies() -> List[str]:
    """
    Check for required Python dependencies.
    
    Returns:
        List[str]: List of missing dependencies
    """
    required_packages = [
        "reportlab"  # For PDF generation
    ]
    
    optional_packages = [
        "PyQt5"  # For GUI mode
    ]
    
    missing = []
    
    # Check required packages
    for package in required_packages:
        try:
            importlib.import_module(package)
        except ImportError:
            missing.append(package)
    
    # Note: Optional packages (like PyQt5) don't count as missing for CLI mode
    return missing


def save_deal_report(results: Dict, format: str = "json", filepath: str = None) -> str:
    """
    Save deal report in specified format.
    
    Args:
        results (Dict): Deal analysis results
        format (str): Output format ('json', 'txt', 'csv')
        filepath (str): Optional custom filepath
        
    Returns:
        str: Path to saved file
    """
    if filepath is None:
        deal_id = results.get("deal_id", f"DEAL_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        app_dir = Path(__file__).parent
        reports_dir = app_dir / "reports"
        filepath = reports_dir / f"{deal_id}.{format}"
    
    filepath = Path(filepath)
    
    try:
        if format.lower() == "json":
            with open(filepath, 'w') as f:
                json.dump(results, f, indent=2, default=str)
                
        elif format.lower() == "txt":
            from .analyzer import DealAnalyzer
            analyzer = DealAnalyzer()
            summary = analyzer.get_deal_summary(results)
            
            with open(filepath, 'w') as f:
                f.write(summary)
                
        elif format.lower() == "csv":
            _save_csv_report(results, filepath)
            
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        return str(filepath)
        
    except Exception as e:
        raise IOError(f"Error saving report: {str(e)}")


def _save_csv_report(results: Dict, filepath: Path):
    """Save report in CSV format."""
    import csv
    
    with open(filepath, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        
        # Write header
        writer.writerow(["Metric", "Value"])
        
        # Write input data
        input_data = results["input"]
        writer.writerow(["ARV", format_currency(input_data["arv"])])
        writer.writerow(["Purchase Price", format_currency(input_data["purchase_price"])])
        writer.writerow(["Rehab Cost", format_currency(input_data["rehab"])])
        
        # Write calculations
        calculations = results["calculations"]
        writer.writerow(["Loan Amount", format_currency(calculations["loan_amount"])])
        
        # Write selling costs breakdown
        selling_costs = calculations["selling_costs"]
        writer.writerow(["Total Selling Costs", format_currency(selling_costs["total"])])
        writer.writerow(["  Agent Commissions", format_currency(selling_costs["agent_commission"])])
        writer.writerow(["  Title & Closing", format_currency(selling_costs["title_closing"])])
        writer.writerow(["  Misc/Concessions", format_currency(selling_costs["misc_costs"])])
        
        writer.writerow(["Net Profit", format_currency(calculations["net_profit"])])
        writer.writerow(["Profit Margin", f"{calculations['profit_margin']:.2f}%"])
        
        # Write eligibility
        eligibility = results["eligibility"]
        writer.writerow(["COGO Eligible", "Yes" if eligibility["is_cogo_eligible"] else "No"])


def export_to_pdf(results: Dict, filepath: str) -> str:
    """
    Export deal analysis to PDF format.
    
    Args:
        results (Dict): Deal analysis results
        filepath (str): Output file path
        
    Returns:
        str: Path to exported PDF file
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        
        # Create PDF document
        doc = SimpleDocTemplate(filepath, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            textColor=colors.darkblue,
            alignment=1  # Center alignment
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.darkblue
        )
        
        # Title
        title = Paragraph("COGO Capital Deal Analysis Report", title_style)
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Deal information
        deal_id = results.get("deal_id", "N/A")
        analysis_date = results.get("analysis_date", "N/A")
        
        info_data = [
            ["Deal ID:", deal_id],
            ["Analysis Date:", analysis_date[:19] if analysis_date != "N/A" else "N/A"]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        story.append(info_table)
        story.append(Spacer(1, 20))
        
        # Input values section
        story.append(Paragraph("Input Values", heading_style))
        
        input_data = results["input"]
        input_table_data = [
            ["Metric", "Value"],
            ["Property Address", Paragraph(input_data.get("property_address", "N/A"), styles['Normal'])],
            ["ARV (After Repair Value)", format_currency(input_data["arv"])],
            ["Purchase Price", format_currency(input_data["purchase_price"])],
            ["Estimated Rehab Cost", format_currency(input_data["rehab"])]
        ]
        
        input_table = Table(input_table_data, colWidths=[3*inch, 2*inch])
        input_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.beige, colors.white]),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('WORDWRAP', (0, 0), (-1, -1), True)
        ]))
        
        story.append(input_table)
        story.append(Spacer(1, 20))
        
        # Analysis results section
        story.append(Paragraph("Analysis Results", heading_style))
        
        calculations = results["calculations"]
        exit_strategy = results.get("exit_strategy", {})
        selling_costs = calculations.get("selling_costs", {})
        
        results_table_data = [
            ["Metric", "Value"],
            ["Exit Strategy", exit_strategy.get("name", "N/A")],
            ["Max Loan (65% ARV)", format_currency(calculations["max_loan_ltv"])],
            ["Max Loan (80% Purchase)", format_currency(calculations["max_loan_purchase"])],
            ["Actual Loan Amount", format_currency(calculations["loan_amount"])],
            ["Selling Costs", f"{format_currency(selling_costs.get('total', 0))} ({selling_costs.get('total_rate', 0):.1%})"],
            ["Broker Fee (3%)", format_currency(calculations["broker_fee"])],
            ["Finance Costs (5%)", format_currency(calculations["finance_costs"])],
            ["Total Costs", format_currency(calculations["total_costs"])],
            ["Net Profit", format_currency(calculations["net_profit"])],
            ["Profit Margin", f"{calculations['profit_margin']:.2f}%"]
        ]
        
        results_table = Table(results_table_data, colWidths=[3*inch, 2*inch])
        results_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.beige, colors.white]),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(results_table)
        story.append(Spacer(1, 20))
        
        # Eligibility section
        story.append(Paragraph("COGO Capital Eligibility", heading_style))
        
        eligibility = results["eligibility"]
        eligible_text = "✅ ELIGIBLE" if eligibility["is_cogo_eligible"] else "❌ NOT ELIGIBLE"
        profit_threshold = format_currency(eligibility["profit_threshold"])
        profit_surplus = format_currency(eligibility["profit_surplus"])
        
        eligibility_data = [
            ["Minimum Required Profit:", profit_threshold],
            ["Actual Net Profit:", format_currency(calculations["net_profit"])],
            ["Surplus/Deficit:", profit_surplus],
            ["Status:", eligible_text]
        ]
        
        eligibility_table = Table(eligibility_data, colWidths=[3*inch, 2*inch])
        eligibility_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(eligibility_table)
        
        # Additional Data Section (if available)
        additional_data = results.get("additional_data")
        if additional_data:
            story.append(Spacer(1, 20))
            story.append(Paragraph("Additional Data Collection", heading_style))
            
            # Property Information
            story.append(Paragraph("Property Information", styles['Heading3']))
            
            # Format data with proper text wrapping
            prop_data = [
                ["County & Parcel ID:", Paragraph(additional_data.get("county_parcel", "N/A"), styles['Normal'])],
                ["Property Type:", Paragraph(additional_data.get("property_type", "N/A"), styles['Normal'])],
                ["Year Built:", Paragraph(additional_data.get("year_built", "N/A"), styles['Normal'])],
                ["Square Footage:", Paragraph(additional_data.get("square_footage", "N/A"), styles['Normal'])],
                ["Lot Size:", Paragraph(additional_data.get("lot_size", "N/A"), styles['Normal'])],
                ["Bedrooms:", Paragraph(additional_data.get("bedrooms", "N/A"), styles['Normal'])],
                ["Bathrooms:", Paragraph(additional_data.get("bathrooms", "N/A"), styles['Normal'])],
                ["Garage Details:", Paragraph(additional_data.get("garage_details", "N/A"), styles['Normal'])],
                ["Rehab Scope:", Paragraph(additional_data.get("rehab_scope", "N/A"), styles['Normal'])]
            ]
            
            prop_table = Table(prop_data, colWidths=[2.2*inch, 2.8*inch], repeatRows=1)
            prop_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
                ('WORDWRAP', (0, 0), (-1, -1), True)
            ]))
            story.append(prop_table)
            story.append(Spacer(1, 12))
            
            # Purchase & Loan Details
            story.append(Paragraph("Purchase & Loan Details", styles['Heading3']))
            
            # Format monetary values and wrap text
            earnest_money = format_currency(float(additional_data.get("earnest_money", "0") or "0"))
            seller_concessions = format_currency(float(additional_data.get("seller_concessions", "0") or "0"))
            
            purchase_data = [
                ["Earnest Money:", Paragraph(earnest_money, styles['Normal'])],
                ["Seller Concessions:", Paragraph(seller_concessions, styles['Normal'])],
                ["Loan Term:", Paragraph(additional_data.get("loan_term", "N/A"), styles['Normal'])],
                ["Closing Date:", Paragraph(additional_data.get("closing_date", "N/A"), styles['Normal'])],
                ["Title Company:", Paragraph(additional_data.get("title_company", "N/A"), styles['Normal'])],
                ["ARV Comps:", Paragraph(additional_data.get("arv_comps", "N/A"), styles['Normal'])]
            ]
            
            purchase_table = Table(purchase_data, colWidths=[2.2*inch, 2.8*inch], repeatRows=1)
            purchase_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
                ('WORDWRAP', (0, 0), (-1, -1), True)
            ]))
            story.append(purchase_table)
            story.append(Spacer(1, 12))
            
            # Borrower Information
            story.append(Paragraph("Borrower Information", styles['Heading3']))
            
            # Format borrower data with text wrapping
            borrower_data = [
                ["Name:", Paragraph(additional_data.get("borrower_name", "N/A"), styles['Normal'])],
                ["Phone:", Paragraph(additional_data.get("borrower_phone", "N/A"), styles['Normal'])],
                ["Email:", Paragraph(additional_data.get("borrower_email", "N/A"), styles['Normal'])],
                ["Address:", Paragraph(additional_data.get("borrower_address", "N/A"), styles['Normal'])],
                ["Entity:", Paragraph(additional_data.get("entity_name", "N/A"), styles['Normal'])],
                ["Experience:", Paragraph(additional_data.get("experience", "N/A"), styles['Normal'])]
            ]
            
            borrower_table = Table(borrower_data, colWidths=[2.2*inch, 2.8*inch], repeatRows=1)
            borrower_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
                ('WORDWRAP', (0, 0), (-1, -1), True)
            ]))
            story.append(borrower_table)
            
            # Guarantor Information (if provided)
            guarantor_name = additional_data.get("guarantor_name", "")
            if guarantor_name and guarantor_name.strip():
                story.append(Spacer(1, 12))
                story.append(Paragraph("Guarantor Information", styles['Heading3']))
                
                guarantor_data = [
                    ["Name:", Paragraph(guarantor_name, styles['Normal'])],
                    ["Phone:", Paragraph(additional_data.get("guarantor_phone", "N/A"), styles['Normal'])],
                    ["Email:", Paragraph(additional_data.get("guarantor_email", "N/A"), styles['Normal'])],
                    ["Address:", Paragraph(additional_data.get("guarantor_address", "N/A"), styles['Normal'])],
                    ["Relationship:", Paragraph(additional_data.get("guarantor_relationship", "N/A"), styles['Normal'])]
                ]
                
                guarantor_table = Table(guarantor_data, colWidths=[2.2*inch, 2.8*inch], repeatRows=1)
                guarantor_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
                    ('WORDWRAP', (0, 0), (-1, -1), True)
                ]))
                story.append(guarantor_table)
        
        # Add footer
        story.append(Spacer(1, 40))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=1
        )
        footer = Paragraph(
            f"Generated by COGO Deal Analyzer v1.0 on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            footer_style
        )
        story.append(footer)
        
        # Build PDF
        doc.build(story)
        return filepath
        
    except ImportError:
        raise ImportError("reportlab package is required for PDF export. Install with: pip install reportlab")
    except Exception as e:
        raise IOError(f"Error exporting PDF: {str(e)}")


def load_template(template_name: str) -> str:
    """
    Load a template file.
    
    Args:
        template_name (str): Name of the template file
        
    Returns:
        str: Template content
    """
    try:
        app_dir = Path(__file__).parent
        template_path = app_dir / "templates" / template_name
        
        with open(template_path, 'r') as f:
            return f.read()
            
    except FileNotFoundError:
        raise FileNotFoundError(f"Template not found: {template_name}")
    except Exception as e:
        raise IOError(f"Error loading template: {str(e)}")


def validate_deal_data(deal_data: Dict) -> Dict:
    """
    Validate and clean deal data input.
    
    Args:
        deal_data (Dict): Raw deal data
        
    Returns:
        Dict: Validated and cleaned deal data
    """
    required_fields = ["arv", "purchase_price", "rehab"]
    
    # Check required fields
    for field in required_fields:
        if field not in deal_data:
            raise ValueError(f"Missing required field: {field}")
    
    # Convert to float and validate
    try:
        cleaned_data = {}
        for field in required_fields:
            value = deal_data[field]
            
            # Handle string inputs (remove commas, etc.)
            if isinstance(value, str):
                value = value.replace(",", "").replace("$", "").strip()
            
            # Convert to float
            cleaned_data[field] = float(value)
            
            # Validate positive values
            if cleaned_data[field] < 0:
                raise ValueError(f"{field} cannot be negative")
        
        # Business logic validations
        if cleaned_data["arv"] <= cleaned_data["purchase_price"]:
            raise ValueError("ARV should be greater than purchase price")
        
        return cleaned_data
        
    except ValueError as e:
        raise ValueError(f"Invalid data format: {str(e)}")


def get_app_info() -> Dict:
    """
    Get application information.
    
    Returns:
        Dict: Application information
    """
    return {
        "name": "COGO Deal Analyzer",
        "version": "1.0.0",
        "description": "Real estate deal analyzer for COGO Capital loan eligibility",
        "author": "House Lot & Land Sales Co. LLC",
        "python_version": sys.version,
        "platform": sys.platform
    }


def create_sample_deal() -> Dict:
    """
    Create a sample deal for testing purposes.
    
    Returns:
        Dict: Sample deal data
    """
    return {
        "arv": 250000.0,
        "purchase_price": 180000.0,
        "rehab": 30000.0,
        "notes": "Sample deal for testing purposes"
    }