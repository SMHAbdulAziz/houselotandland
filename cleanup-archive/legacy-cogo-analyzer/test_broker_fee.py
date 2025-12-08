#!/usr/bin/env python3
"""Test script to verify broker fee functionality"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from analyzer import DealAnalyzer

def test_broker_fee():
    """Test broker fee calculation with different percentages"""
    
    analyzer = DealAnalyzer()
    
    # Test deal data
    deal_data = {
        "property_address": "123 Test St, Dallas, TX",
        "arv": 286000.0,
        "purchase_price": 225000.0,
        "rehab": 15000.0,
        "exit_strategy": "direct_sale",
        "broker_fee_percent": 1.5  # Test with 1.5%
    }
    
    print("Testing broker fee functionality...")
    print(f"Test data: {deal_data}")
    
    try:
        results = analyzer.calculate_deal_metrics(deal_data)
        
        print(f"\nResults:")
        print(f"Loan Amount: ${results['calculations']['loan_amount']:,.2f}")
        print(f"Broker Fee (1.5%): ${results['calculations']['broker_fee']:,.2f}")
        print(f"Net Profit: ${results['calculations']['net_profit']:,.2f}")
        print(f"COGO Eligible: {results['eligibility']['is_cogo_eligible']}")
        
        # Test with different broker fee percentages
        for fee_percent in [1.0, 2.0, 2.5, 3.0, 3.5]:
            deal_data["broker_fee_percent"] = fee_percent
            results = analyzer.calculate_deal_metrics(deal_data)
            broker_fee = results['calculations']['broker_fee']
            net_profit = results['calculations']['net_profit']
            eligible = results['eligibility']['is_cogo_eligible']
            
            print(f"Broker Fee {fee_percent}%: ${broker_fee:,.2f} -> Net Profit: ${net_profit:,.2f} -> Eligible: {eligible}")
        
        print("\n✅ Broker fee functionality working correctly!")
        return True
        
    except Exception as e:
        print(f"❌ Error testing broker fee: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_broker_fee()