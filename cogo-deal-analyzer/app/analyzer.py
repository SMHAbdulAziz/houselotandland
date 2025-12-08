"""
COGO Deal Analyzer - Core Logic Module

This module contains the main deal calculation and eligibility logic
for the COGO Capital Deal Analyzer application.
"""

from typing import Dict, Tuple
import json
from datetime import datetime


class DealAnalyzer:
    """Main class for analyzing real estate deals for COGO Capital eligibility."""
    
    # COGO Capital Constants
    MIN_PROFIT_THRESHOLD = 20000  # $20K minimum profit requirement
    MAX_LTV_RATIO = 0.65         # 65% of ARV maximum
    MAX_PURCHASE_RATIO = 0.80    # 80% of purchase price maximum
    BROKER_FEE_RATE = 0.03       # 3% broker fee
    FINANCE_COST_RATE = 0.05     # 5% estimated finance costs
    
    # Default Selling Cost Components (can be overridden)
    DEFAULT_AGENT_COMMISSION = 0.055  # 5.5% (3% buyer + 2.5% seller agent)
    DEFAULT_TITLE_CLOSING = 0.015     # 1.5% (title insurance, escrow, attorney fees)
    DEFAULT_MISC_COSTS = 0.01         # 1% (concessions, holding costs, repairs)
    
    # COGO-Approved Exit Strategies with preset selling costs
    EXIT_STRATEGIES = {
        "mls_listing": {
            "name": "MLS Listing (Traditional Sale)",
            "description": "List with realtor on MLS, full market exposure",
            "agent_commission": 0.055,  # 5.5% (3% buyer + 2.5% seller)
            "title_closing": 0.015,     # 1.5%
            "misc_costs": 0.01,         # 1.0%
            "cogo_approved": True
        },
        "direct_sale": {
            "name": "Direct Sale (FSBO/Off-Market)",
            "description": "Direct sale to end buyer, no realtor",
            "agent_commission": 0.0,    # 0% (no agents)
            "title_closing": 0.015,     # 1.5%
            "misc_costs": 0.015,        # 1.5% (higher marketing/holding)
            "cogo_approved": True
        },
        "wholesale": {
            "name": "Wholesale to Investor", 
            "description": "Quick sale to investor/flipper at discount",
            "agent_commission": 0.0,    # 0% (no agents)
            "title_closing": 0.01,      # 1.0% (simpler transaction)
            "misc_costs": 0.005,        # 0.5% (minimal costs)
            "cogo_approved": True
        },
        "auction": {
            "name": "Auction Sale",
            "description": "Public or online auction sale",
            "agent_commission": 0.0,    # 0% (no traditional agents)
            "title_closing": 0.015,     # 1.5%
            "misc_costs": 0.025,        # 2.5% (auction fees, marketing)
            "cogo_approved": True
        },
        "lease_option": {
            "name": "Lease Option/Rent-to-Own",
            "description": "Lease with option to purchase",
            "agent_commission": 0.02,   # 2% (reduced agent involvement)
            "title_closing": 0.01,      # 1.0%
            "misc_costs": 0.015,        # 1.5% (tenant screening, legal)
            "cogo_approved": True
        },
        "custom": {
            "name": "Custom Exit Strategy",
            "description": "Manual cost configuration",
            "agent_commission": 0.055,  # Default values
            "title_closing": 0.015,
            "misc_costs": 0.01,
            "cogo_approved": True
        }
    }
    
    # COGO Capital Required Documents Checklist
    COGO_DOCUMENT_CHECKLIST = {
        "broker_required": {
            "title": "Broker Must Collect (Essential)",
            "documents": [
                {"name": "Broker Fee Agreement", "description": "Signed agreement outlining broker compensation"},
                {"name": "COGO Capital Loan Application", "description": "Completed loan application form"},
                {"name": "Schedule of Real Estate Owned", "description": "Complete list of borrower's real estate assets"},
                {"name": "Zero Fraud Policy", "description": "Signed fraud prevention acknowledgment"},
                {"name": "Secretary of State Verification", "description": "Corporate entity verification (if applicable)"},
                {"name": "Entity Operating Agreement", "description": "LLC/Corp operating docs (if applicable)"},
                {"name": "Federal EIN Verification", "description": "IRS EIN confirmation letter"},
                {"name": "Guarantor ID", "description": "Government-issued photo ID for all guarantors"},
                {"name": "Social Security Card", "description": "SS card for all guarantors"},
                {"name": "Bank Statements", "description": "Last 3 months business and personal statements"},
                {"name": "Federal Tax Returns", "description": "Last 2 years personal and business returns"},
                {"name": "State Tax Returns", "description": "Last 2 years state returns (if applicable)"},
                {"name": "Purchase & Sales Agreement", "description": "Executed purchase contract"},
                {"name": "P&S Agreement Addendums", "description": "All addendums to purchase agreement"},
                {"name": "Mortgage Payoff Letter", "description": "Current mortgage payoff statement (if applicable)"},
                {"name": "Contractor's Liability Insurance", "description": "Current GL insurance certificate"},
                {"name": "Contractor's License Verification", "description": "Valid contractor license verification"},
                {"name": "Draw Schedule", "description": "Detailed construction draw schedule"},
                {"name": "Contractor Scope of Work", "description": "Complete scope of work document"},
                {"name": "CDNA Report", "description": "Comprehensive property and area analysis"},
                {"name": "Schedule of Real Estate Sold", "description": "Recent sales history of borrower"}
            ]
        },
        "lender_provided": {
            "title": "Lender Will Obtain",
            "documents": [
                {"name": "Preliminary Title Report", "description": "Title commitment/preliminary report"},
                {"name": "Hazard Insurance Binder", "description": "Property insurance coverage binder"},
                {"name": "Appraisal Report", "description": "Professional property appraisal"},
                {"name": "HUD Settlement Statement", "description": "Closing settlement statement"},
                {"name": "Cost Worksheet", "description": "Underwriter's cost analysis"},
                {"name": "Credit Report", "description": "Comprehensive credit analysis"}
            ]
        },
        "submission_notes": [
            "All documents must be current (within 90 days unless specified)",
            "Corporate borrowers require additional entity documentation",
            "Construction projects require detailed contractor documentation",
            "Incomplete files will delay processing and funding",
            "Broker must verify accuracy of all collected documents"
        ]
    }

    def __init__(self):
        self.deal_history = []

    def calculate_deal_metrics(self, deal_data: Dict) -> Dict:
        """
        Calculate all deal metrics including loan amount, costs, and profit.
        
        Args:
            deal_data (Dict): Dictionary containing ARV, purchase_price, and rehab
            
        Returns:
            Dict: Complete deal analysis with all calculated fields
        """
        try:
            # Extract input values
            arv = float(deal_data.get("arv", 0))
            purchase_price = float(deal_data.get("purchase_price", 0))
            rehab = float(deal_data.get("rehab", 0))
            
            # Validate inputs
            if arv <= 0 or purchase_price <= 0:
                raise ValueError("ARV and Purchase Price must be positive values")
            
            # Calculate maximum loan amount (lower of 65% ARV or 80% purchase price)
            max_loan_ltv = arv * self.MAX_LTV_RATIO
            max_loan_purchase = purchase_price * self.MAX_PURCHASE_RATIO
            loan_amount = min(max_loan_ltv, max_loan_purchase)
            
            # Calculate selling costs breakdown
            selling_costs = self._calculate_selling_costs(arv, deal_data)
            
            # Calculate other costs
            broker_fee_rate = deal_data.get("broker_fee_percent", 3.0) / 100  # Convert percentage to decimal
            broker_fee = loan_amount * broker_fee_rate
            finance_costs = loan_amount * self.FINANCE_COST_RATE
            
            # Calculate total costs and net profit
            total_selling_cost = selling_costs["total"]
            total_costs = purchase_price + rehab + total_selling_cost + broker_fee + finance_costs
            net_profit = arv - total_costs
            
            # Check COGO eligibility
            is_eligible = self.is_cogo_eligible(net_profit)
            
            # Calculate profit margin
            profit_margin = (net_profit / arv * 100) if arv > 0 else 0
            
            # Prepare results
            results = {
                "input": {
                    "property_address": deal_data.get("property_address", ""),
                    "arv": arv,
                    "purchase_price": purchase_price,
                    "rehab": rehab,
                    "broker_fee_percent": deal_data.get("broker_fee_percent", 3.0)
                },
                "calculations": {
                    "max_loan_ltv": max_loan_ltv,
                    "max_loan_purchase": max_loan_purchase,
                    "loan_amount": loan_amount,
                    "selling_costs": selling_costs,
                    "broker_fee": broker_fee,
                    "finance_costs": finance_costs,
                    "total_costs": total_costs,
                    "net_profit": net_profit,
                    "profit_margin": profit_margin
                },
                "eligibility": {
                    "is_cogo_eligible": is_eligible,
                    "profit_threshold": self.MIN_PROFIT_THRESHOLD,
                    "profit_surplus": net_profit - self.MIN_PROFIT_THRESHOLD
                },
                "analysis_date": datetime.now().isoformat(),
                "deal_id": f"DEAL_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            }
            
            # Add exit strategy info if present in selling_costs
            if "exit_strategy" in selling_costs:
                results["exit_strategy"] = selling_costs["exit_strategy"]
            
            return results
            
        except Exception as e:
            raise ValueError(f"Error calculating deal metrics: {str(e)}")

    def _calculate_selling_costs(self, arv: float, deal_data: Dict) -> Dict:
        """
        Calculate selling costs breakdown with optional components or exit strategy.
        
        Args:
            arv (float): After Repair Value
            deal_data (Dict): Deal data containing selling costs, exit strategy, or overrides
            
        Returns:
            Dict: Selling costs breakdown with exit strategy info
        """
        # Check for exit strategy selection
        exit_strategy_key = deal_data.get("exit_strategy", "custom")
        exit_strategy = None
        
        if exit_strategy_key in self.EXIT_STRATEGIES:
            exit_strategy = self.EXIT_STRATEGIES[exit_strategy_key]
            # Use exit strategy defaults
            agent_commission_rate = exit_strategy["agent_commission"]
            title_closing_rate = exit_strategy["title_closing"]
            misc_rate = exit_strategy["misc_costs"]
        else:
            # Check for custom selling cost components in deal_data
            selling_options = deal_data.get("selling_costs", {})
            agent_commission_rate = selling_options.get("agent_commission", self.DEFAULT_AGENT_COMMISSION)
            title_closing_rate = selling_options.get("title_closing", self.DEFAULT_TITLE_CLOSING)
            misc_rate = selling_options.get("misc_costs", self.DEFAULT_MISC_COSTS)
        
        # Calculate costs
        agent_commission = arv * agent_commission_rate if agent_commission_rate > 0 else 0
        title_closing = arv * title_closing_rate if title_closing_rate > 0 else 0
        misc_costs = arv * misc_rate if misc_rate > 0 else 0
        total = agent_commission + title_closing + misc_costs
        
        result = {
            "agent_commission": agent_commission,
            "agent_commission_rate": agent_commission_rate,
            "title_closing": title_closing,
            "title_closing_rate": title_closing_rate,
            "misc_costs": misc_costs,
            "misc_costs_rate": misc_rate,
            "total": total,
            "total_rate": total / arv if arv > 0 else 0
        }
        
        # Add exit strategy information if used
        if exit_strategy:
            result["exit_strategy"] = {
                "key": exit_strategy_key,
                "name": exit_strategy["name"],
                "description": exit_strategy["description"],
                "cogo_approved": exit_strategy["cogo_approved"]
            }
        
        return result

    def calculate_profit(self, deal: Dict) -> float:
        """
        Calculate net profit for a deal (legacy method for compatibility).
        
        Args:
            deal (Dict): Dictionary containing deal data
            
        Returns:
            float: Calculated net profit
        """
        results = self.calculate_deal_metrics(deal)
        return results["calculations"]["net_profit"]

    def is_cogo_eligible(self, profit: float) -> bool:
        """
        Check if a deal meets COGO Capital eligibility requirements.
        
        Args:
            profit (float): Calculated net profit
            
        Returns:
            bool: True if eligible, False otherwise
        """
        return profit >= self.MIN_PROFIT_THRESHOLD

    def analyze_deal_sensitivity(self, deal_data: Dict, scenarios: Dict = None) -> Dict:
        """
        Perform sensitivity analysis on deal parameters.
        
        Args:
            deal_data (Dict): Base deal data
            scenarios (Dict): Optional custom scenarios to analyze
            
        Returns:
            Dict: Sensitivity analysis results
        """
        if scenarios is None:
            scenarios = {
                "optimistic": {"arv_multiplier": 1.1, "rehab_multiplier": 0.9},
                "pessimistic": {"arv_multiplier": 0.9, "rehab_multiplier": 1.2},
                "conservative": {"arv_multiplier": 0.95, "rehab_multiplier": 1.1}
            }
        
        base_results = self.calculate_deal_metrics(deal_data)
        sensitivity_results = {"base": base_results}
        
        for scenario_name, multipliers in scenarios.items():
            scenario_data = deal_data.copy()
            scenario_data["arv"] = deal_data["arv"] * multipliers.get("arv_multiplier", 1.0)
            scenario_data["rehab"] = deal_data["rehab"] * multipliers.get("rehab_multiplier", 1.0)
            
            sensitivity_results[scenario_name] = self.calculate_deal_metrics(scenario_data)
        
        return sensitivity_results

    def save_deal(self, deal_results: Dict, filepath: str = None) -> str:
        """
        Save deal analysis results to JSON file.
        
        Args:
            deal_results (Dict): Complete deal analysis results
            filepath (str): Optional custom filepath
            
        Returns:
            str: Path to saved file
        """
        if filepath is None:
            deal_id = deal_results.get("deal_id", f"DEAL_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            filepath = f"data/{deal_id}.json"
        
        try:
            with open(filepath, 'w') as f:
                json.dump(deal_results, f, indent=2, default=str)
            
            # Add to history
            self.deal_history.append({
                "deal_id": deal_results.get("deal_id"),
                "timestamp": datetime.now().isoformat(),
                "filepath": filepath,
                "eligible": deal_results["eligibility"]["is_cogo_eligible"],
                "profit": deal_results["calculations"]["net_profit"]
            })
            
            return filepath
            
        except Exception as e:
            raise IOError(f"Error saving deal: {str(e)}")

    def load_deal(self, filepath: str) -> Dict:
        """
        Load deal analysis results from JSON file.
        
        Args:
            filepath (str): Path to deal file
            
        Returns:
            Dict: Deal analysis results
        """
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception as e:
            raise IOError(f"Error loading deal: {str(e)}")

    def get_exit_strategies(self) -> Dict:
        """
        Get available exit strategies with descriptions.
        
        Returns:
            Dict: Available exit strategies
        """
        return self.EXIT_STRATEGIES
    
    def generate_document_checklist(self, deal_results: Dict) -> Dict:
        """
        Generate COGO document checklist for eligible deals only.
        
        Args:
            deal_results (Dict): Deal analysis results
            
        Returns:
            Dict: Document checklist with completion tracking
        """
        # Only generate checklist for COGO-eligible deals
        if not deal_results["eligibility"]["is_cogo_eligible"]:
            return {
                "eligible": False,
                "message": "Deal does not meet COGO eligibility requirements. Document checklist not applicable."
            }
        
        # Create checklist with completion tracking
        checklist = {
            "eligible": True,
            "deal_id": deal_results.get("deal_id"),
            "profit": deal_results["calculations"]["net_profit"],
            "broker_required": [],
            "lender_provided": [],
            "submission_notes": self.COGO_DOCUMENT_CHECKLIST["submission_notes"],
            "completion_stats": {
                "broker_collected": 0,
                "broker_total": len(self.COGO_DOCUMENT_CHECKLIST["broker_required"]["documents"]),
                "completion_percentage": 0
            }
        }
        
        # Add broker-required documents with completion tracking
        for doc in self.COGO_DOCUMENT_CHECKLIST["broker_required"]["documents"]:
            checklist["broker_required"].append({
                "name": doc["name"],
                "description": doc["description"],
                "collected": False,
                "date_collected": None,
                "notes": ""
            })
        
        # Add lender-provided documents (for reference)
        for doc in self.COGO_DOCUMENT_CHECKLIST["lender_provided"]["documents"]:
            checklist["lender_provided"].append({
                "name": doc["name"],
                "description": doc["description"],
                "lender_responsibility": True
            })
        
        return checklist
    
    def update_document_status(self, checklist: Dict, document_name: str, 
                             collected: bool = True, notes: str = "") -> Dict:
        """
        Update document collection status in checklist.
        
        Args:
            checklist (Dict): Document checklist
            document_name (str): Name of document to update
            collected (bool): Whether document is collected
            notes (str): Optional notes about document
            
        Returns:
            Dict: Updated checklist
        """
        from datetime import datetime
        
        for doc in checklist["broker_required"]:
            if doc["name"].lower() == document_name.lower():
                doc["collected"] = collected
                doc["date_collected"] = datetime.now().isoformat() if collected else None
                doc["notes"] = notes
                break
        
        # Update completion statistics
        collected_count = sum(1 for doc in checklist["broker_required"] if doc["collected"])
        checklist["completion_stats"]["broker_collected"] = collected_count
        checklist["completion_stats"]["completion_percentage"] = (
            (collected_count / checklist["completion_stats"]["broker_total"]) * 100
        )
        
        return checklist
    
    def get_checklist_summary(self, checklist: Dict) -> str:
        """
        Generate formatted summary of document checklist.
        
        Args:
            checklist (Dict): Document checklist
            
        Returns:
            str: Formatted checklist summary
        """
        if not checklist["eligible"]:
            return checklist["message"]
        
        stats = checklist["completion_stats"]
        summary = f"""
COGO CAPITAL DOCUMENT CHECKLIST
===============================
Deal ID: {checklist['deal_id']}
Profit: ${checklist['profit']:,.2f} (✅ ELIGIBLE)

COMPLETION STATUS: {stats['broker_collected']}/{stats['broker_total']} ({stats['completion_percentage']:.0f}%)
{'🟢 READY TO SUBMIT' if stats['completion_percentage'] == 100 else '🟡 INCOMPLETE'}

BROKER MUST COLLECT:
"""
        
        for doc in checklist["broker_required"]:
            status = "✅" if doc["collected"] else "❌"
            summary += f"{status} {doc['name']}\n"
            if doc["notes"]:
                summary += f"    Notes: {doc['notes']}\n"
        
        summary += f"\nLENDER WILL OBTAIN ({len(checklist['lender_provided'])} items):\n"
        for doc in checklist["lender_provided"]:
            summary += f"📋 {doc['name']}\n"
        
        summary += "\nSUBMISSION NOTES:\n"
        for note in checklist["submission_notes"]:
            summary += f"• {note}\n"
        
        return summary.strip()

    def get_deal_summary(self, deal_results: Dict) -> str:
        """
        Generate a formatted summary of deal analysis.
        
        Args:
            deal_results (Dict): Complete deal analysis results
            
        Returns:
            str: Formatted summary text
        """
        input_data = deal_results["input"]
        calculations = deal_results["calculations"]
        eligibility = deal_results["eligibility"]
        
        summary = f"""
COGO DEAL ANALYSIS SUMMARY
=========================
Deal ID: {deal_results.get('deal_id', 'N/A')}
Analysis Date: {deal_results.get('analysis_date', 'N/A')}

INPUT VALUES:
- ARV (After Repair Value): ${input_data['arv']:,.2f}
- Purchase Price: ${input_data['purchase_price']:,.2f}
- Estimated Rehab: ${input_data['rehab']:,.2f}

LOAN CALCULATIONS:
- Max Loan (65% ARV): ${calculations['max_loan_ltv']:,.2f}
- Max Loan (80% Purchase): ${calculations['max_loan_purchase']:,.2f}
- Actual Loan Amount: ${calculations['loan_amount']:,.2f}

COST BREAKDOWN:
- Purchase Price: ${input_data['purchase_price']:,.2f}
- Rehab Costs: ${input_data['rehab']:,.2f}
- Selling Costs: ${calculations['selling_costs']['total']:,.2f} ({calculations['selling_costs']['total_rate']:.1%})
  • Agent Commissions: ${calculations['selling_costs']['agent_commission']:,.2f} ({calculations['selling_costs']['agent_commission_rate']:.1%})
  • Title & Closing: ${calculations['selling_costs']['title_closing']:,.2f} ({calculations['selling_costs']['title_closing_rate']:.1%})
  • Misc/Concessions: ${calculations['selling_costs']['misc_costs']:,.2f} ({calculations['selling_costs']['misc_costs_rate']:.1%})
- Broker Fee ({input_data['broker_fee_percent']:.1f}%): ${calculations['broker_fee']:,.2f}
- Finance Costs (5%): ${calculations['finance_costs']:,.2f}
- Total Costs: ${calculations['total_costs']:,.2f}

PROFITABILITY:
- Gross Revenue (ARV): ${input_data['arv']:,.2f}
- Net Profit: ${calculations['net_profit']:,.2f}
- Profit Margin: {calculations['profit_margin']:.2f}%

COGO ELIGIBILITY:
- Minimum Required Profit: ${eligibility['profit_threshold']:,.2f}
- Profit Surplus/Deficit: ${eligibility['profit_surplus']:,.2f}
- ELIGIBLE: {'✅ YES' if eligibility['is_cogo_eligible'] else '❌ NO'}
        """
        
        return summary.strip()


# Convenience functions for backward compatibility
def calculate_profit(deal: Dict) -> float:
    """Calculate net profit for a deal."""
    analyzer = DealAnalyzer()
    return analyzer.calculate_profit(deal)


def is_cogo_eligible(profit: float) -> bool:
    """Check if profit meets COGO eligibility requirements."""
    analyzer = DealAnalyzer()
    return analyzer.is_cogo_eligible(profit)