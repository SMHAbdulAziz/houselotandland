# COGO Deal Analyzer v1.0.1

A comprehensive desktop GUI application for evaluating real estate deals against COGO Capital loan eligibility standards. Built with Python and PyQt5, featuring advanced data collection, document management, and professional reporting capabilities with enhanced stability and crash resistance.

## 🏠 Overview

The COGO Deal Analyzer is a complete loan submission preparation system that helps real estate investors:
- Analyze deal profitability with customizable parameters
- Determine COGO Capital loan eligibility ($20K+ profit requirement)
- Collect comprehensive borrower and guarantor information
- Track all required loan application documents (28 total)
- Generate professional PDF reports with proper formatting
- Manage deal history with advanced search capabilities
- **NEW**: Enhanced crash resistance and error handling for maximum stability

## ✨ Key Features

### 🎯 **Deal Analysis Engine**
- **Real-time Calculations**: Instant deal analysis with live updates
- **Customizable Broker Fee**: Adjustable from 1.0% to 3.5% to optimize profitability
- **6 COGO-Approved Exit Strategies**: Pre-configured cost structures (1.5% - 8.0%)
- **Property Address Integration**: Full address capture and display
- **Profit Optimization**: Test different scenarios to achieve COGO eligibility

### 📋 **Comprehensive Data Collection**
- **Property Information**: County/parcel, type, year built, square footage, lot size
- **Purchase & Loan Details**: Earnest money, concessions, loan terms, closing dates
- **Borrower Information**: Complete contact details, entity type, experience
- **Guarantor Information**: Full guarantor details and relationship documentation
- **Data Persistence**: All information saved and recalled automatically

### 📊 **Advanced Deal History Management**
- **Enhanced Table View**: Deal ID, Date, Property Address, Borrower Name, Profit, Eligibility
- **Smart Date Formatting**: Extracts dates from filenames (MM/DD/YYYY format)
- **Real-time Search**: Filter by borrower name or property address
- **Scalable Design**: Built to handle extensive deal databases
- **One-click Loading**: Restore any previous deal with all data intact

### 📄 **Professional Reporting & Export**
- **Enhanced PDF Export**: Property details, borrower/guarantor info, proper text wrapping
- **Margin-Optimized Layout**: All content fits within professional margins
- **JSON Data Persistence**: Complete deal data with timestamps
- **Document Checklist Integration**: 22 broker + 6 lender document tracking

### 🖥️ **User Interface Enhancements**
- **Signal Connection Safety**: Crash-resistant PyQt implementation
- **Thread-Safe Operations**: Stable multi-analysis workflows
- **Intuitive Layout**: Property address at top, customizable broker fee
- **Data Collection Button**: Easily accessible from Deal Analysis tab
- **Clear Visual Feedback**: Status indicators and progress tracking

## Complete Workflow Example

The COGO Deal Analyzer now provides end-to-end loan application preparation. Here's how the complete process works:

1. **Deal Analysis**: Input property details and select appropriate exit strategy
2. **Eligibility Check**: System verifies COGO Capital loan requirements
3. **Document Management**: For eligible deals, track all required loan documents
4. **Export Options**: Generate professional reports and CSV data

This streamlined workflow ensures all necessary documentation is collected before loan submission, significantly improving approval rates and processing time.

## Docker Commands

### Quick Start

### Docker Method (Recommended)

1. **Easy Way - Use the run script:**
   ```bash
   # Navigate to the project directory
   cd cogo-deal-analyzer
   
   # Run CLI mode (default)
   ./run.sh
   
   # Or specify CLI explicitly  
   ./run.sh --cli
   
   # Force rebuild if needed
   ./run.sh --build
   ```

2. **Manual Docker Commands:**
   ```bash
   # Build the image
   docker build -t cogo-analyzer:cli .
   
   # Run CLI mode
   docker run -it --rm \
     -v "$(pwd)/data:/app/data" \
     -v "$(pwd)/reports:/app/reports" \
     cogo-analyzer:cli
   ```

3. **Using Docker Compose:**
   ```bash
   # Build and run CLI mode
   docker-compose up --build cogo-analyzer
   ```

### Local Installation

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the application:**
   ```bash
   # GUI mode
   python app/main.py
   
   # CLI mode
   python app/main.py --cli
   
   # Show version
   python app/main.py --version
   ```

## 📊 How It Works

### Enhanced Input Requirements
- **Property Address**: Full property address for identification and reporting
- **ARV (After Repair Value)**: Expected property value after renovations
- **Purchase Price**: Contract purchase amount
- **Rehab Cost**: Estimated renovation expenses
- **Broker Fee**: Customizable percentage (default 3.0%, range 1.0% - 3.5%)
- **Exit Strategy**: COGO-approved exit strategy selection (auto-sets costs)

### Advanced Calculations
The analyzer calculates:
- **Loan Amount**: Lower of 65% ARV or 80% purchase price
- **Selling Costs**: Strategy-specific breakdown:
  - **Agent Commissions**: Variable by strategy (0% - 5.5%)
  - **Title & Closing**: 1.0% - 1.5% depending on complexity
  - **Misc/Concessions**: 0.5% - 2.5% for holding costs and repairs
- **Broker Fee**: **Customizable percentage** of loan amount (major enhancement!)
- **Finance Costs**: 5% of loan amount (interest, fees, insurance)
- **Net Profit**: ARV - All Costs

### Profitability Optimization
**New Feature**: Adjust broker fee to achieve COGO eligibility
- Lower broker fees can push marginal deals over the $20,000 profit threshold
- Real-time recalculation shows impact of fee adjustments
- Historical deals can be reanalyzed with different broker fee scenarios

### COGO-Approved Exit Strategies
Choose from pre-configured exit strategies with optimized selling costs:

1. **MLS Listing (Traditional Sale)** - 8.0% total
   - Agent: 5.5%, Title: 1.5%, Misc: 1.0%
   - Full market exposure with realtor

2. **Direct Sale (FSBO/Off-Market)** - 3.0% total  
   - Agent: 0%, Title: 1.5%, Misc: 1.5%
   - Direct to end buyer, no realtor

3. **Wholesale to Investor** - 1.5% total
   - Agent: 0%, Title: 1.0%, Misc: 0.5%  
   - Quick sale to investor/flipper

4. **Auction Sale** - 4.0% total
   - Agent: 0%, Title: 1.5%, Misc: 2.5%
   - Public or online auction

5. **Lease Option/Rent-to-Own** - 4.5% total
   - Agent: 2.0%, Title: 1.0%, Misc: 1.5%
   - Tenant-buyer arrangement

6. **Custom Exit Strategy** - Manual configuration
   - Enter your own cost percentages

### COGO Eligibility & Complete Document Management System
A deal is eligible if:
- Net profit ≥ $20,000
- All calculations are based on conservative estimates
- Complete borrower and guarantor information collected

**For eligible deals, the system provides comprehensive loan submission preparation:**

#### Enhanced Data Collection Form
**Automatically triggered for COGO-eligible deals:**
- **Property Information**: County/parcel ID, type, year built, square footage, lot size, bedrooms, bathrooms, garage details, rehab scope
- **Purchase & Loan Details**: Earnest money, seller concessions, loan term preferences, closing dates, title company, ARV comps
- **Borrower Information**: Full name, contact details, mailing address, entity type, real estate experience
- **Guarantor Information**: Complete guarantor details, relationship to borrower (if applicable)

#### Document Checklist Management (28 Total Documents)

**Broker Must Collect (22 documents):**
- Broker Fee Agreement
- COGO Capital Loan Application  
- Schedule of Real Estate Owned
- Zero Fraud Policy
- Secretary of State Verification (if corp/LLC)
- Entity Operating Agreement (if applicable)
- Federal EIN Verification
- Guarantor ID & Social Security Card
- Bank Statements (3 months)
- Federal & State Tax Returns (2 years)
- Purchase & Sales Agreement + Addendums
- Mortgage Payoff Letter (if applicable)
- Contractor Documentation (license, insurance, scope)
- Draw Schedule & CDNA Report
- Schedule of Real Estate Sold
- Plus 7 additional verification documents

**Lender Will Obtain (6 documents):**
- Preliminary Title Report
- Hazard Insurance Binder
- Appraisal Report
- HUD Settlement Statement
- Cost Worksheet
- Credit Report

#### Advanced Document Tracking Features
- **Interactive Checklist**: Check off documents as collected
- **Progress Tracking**: Visual completion percentage
- **Data Persistence**: All information saved with deal
- **Recall Functionality**: "📝 Edit Additional Data" button for easy access
- **Professional PDF Export**: Complete submission package formatting

## 📋 Enhanced Usage Examples

### GUI Mode - Complete Workflow
1. **Deal Input**: Enter property address, ARV, purchase price, and rehab costs
2. **Broker Fee Optimization**: Adjust broker fee percentage (1.0% - 3.5%) to optimize profitability
3. **Exit Strategy Selection**: Choose from 6 COGO-approved strategies
4. **Analysis**: Click "Analyze Deal" for instant calculations
5. **Data Collection**: For eligible deals, complete comprehensive borrower information
6. **Document Management**: Track all 28 required loan documents
7. **Professional Export**: Generate formatted PDF reports
8. **History Management**: Search and reload any previous deal

### Advanced Deal History Features
- **Enhanced Search**: Type borrower name or property address to filter results
- **Complete Deal Information**: View Deal ID, Date, Property Address, Borrower Name, Profit, and Eligibility at a glance
- **Smart Date Display**: Automatically formatted from deal timestamps (MM/DD/YYYY)
- **One-Click Loading**: Restore complete deals with all data collection information
- **Scalable Design**: Handles extensive deal databases efficiently

### CLI Mode Example

**Standard Analysis:**
```bash
$ python app/main.py --cli

COGO Deal Analyzer - CLI Mode
========================================
Enter ARV (After Repair Value): $250,000
Enter Purchase Price: $180,000
Enter Rehab Cost: $30,000

============================================================
COGO-APPROVED EXIT STRATEGY SELECTION
============================================================
Choose your planned exit strategy (affects selling costs):

1. MLS Listing (Traditional Sale) (8.0% total)
   List with realtor on MLS, full market exposure

2. Direct Sale (FSBO/Off-Market) (3.0% total)
   Direct sale to end buyer, no realtor

3. Wholesale to Investor (1.5% total)
   Quick sale to investor/flipper at discount

4. Auction Sale (4.0% total)
   Public or online auction sale

5. Lease Option/Rent-to-Own (4.5% total)
   Lease with option to purchase

6. Custom/Manual Configuration

Select exit strategy (1-6): 3

COGO DEAL ANALYSIS SUMMARY
=========================
Deal ID: DEAL_20241014_143052
Analysis Date: 2024-10-14T14:30:52

INPUT VALUES:
- ARV (After Repair Value): $250,000.00
- Purchase Price: $180,000.00
- Estimated Rehab: $30,000.00

LOAN CALCULATIONS:
- Max Loan (65% ARV): $162,500.00
- Max Loan (80% Purchase): $144,000.00
- Actual Loan Amount: $144,000.00

COST BREAKDOWN:
- Purchase Price: $180,000.00
- Rehab Costs: $30,000.00
- Selling Costs: $3,750.00 (1.5%) - Wholesale to Investor
  • Agent Commissions: $0.00 (0.0%)
  • Title & Closing: $2,500.00 (1.0%)
  • Misc/Concessions: $1,250.00 (0.5%)
- Broker Fee (3%): $4,320.00
- Finance Costs (5%): $7,200.00
- Total Costs: $225,270.00

PROFITABILITY:
- Gross Revenue (ARV): $250,000.00
- Net Profit: $24,730.00
- Profit Margin: 9.89%

COGO ELIGIBILITY:
- Minimum Required Profit: $20,000.00
- Profit Surplus/Deficit: $4,730.00
- ELIGIBLE: ✅ YES (Wholesale strategy makes it profitable!)

============================================================
📋 COGO LOAN APPLICATION DOCUMENT CHECKLIST
============================================================
Deal ID: DEAL_20241015_143052
Profit: $24,730.00 (✅ ELIGIBLE)

COMPLETION STATUS: 0/22 (0%)
🟡 INCOMPLETE

BROKER MUST COLLECT:
❌ Broker Fee Agreement
❌ COGO Capital Loan Application
❌ Schedule of Real Estate Owned
❌ Zero Fraud Policy
... (19 more documents)

LENDER WILL OBTAIN (6 items):
📋 Preliminary Title Report
📋 Hazard Insurance Binder
📋 Appraisal Report
... (3 more documents)

Manage document checklist? (y/n): n
```

**Wholesale Analysis (Custom Selling Costs):**
```bash
Customize selling costs? (y/n): y

Enter rates as percentages (e.g., 5.5 for 5.5%) or 0 to exclude:
Agent Commissions % (default 5.5%): 0
Title & Closing % (default 1.5%): 1
Misc/Concessions % (default 1.0%): 0.5

COST BREAKDOWN:
- Purchase Price: $180,000.00
- Rehab Costs: $30,000.00
- Selling Costs: $2,700.00 (1.5%)
  • Agent Commissions: $0.00 (0.0%)
  • Title & Closing: $2,250.00 (1.0%)
  • Misc/Concessions: $450.00 (0.5%)
- Broker Fee (3%): $4,320.00
- Finance Costs (5%): $7,200.00
- Total Costs: $224,220.00

PROFITABILITY:
- Net Profit: $25,780.00
- Profit Margin: 10.31%

COGO ELIGIBILITY: ✅ YES (Wholesale makes it profitable!)
```

## 📁 Project Structure

```
cogo-deal-analyzer/
├── app/
│   ├── __init__.py          # Package initialization  
│   ├── main.py              # Application entry point with GUI/CLI modes
│   ├── gui.py               # Enhanced PyQt5 interface with data collection
│   ├── analyzer.py          # Deal calculation engine with 6 exit strategies
│   ├── utils.py             # Utility functions with enhanced PDF export
│   ├── reports/             # Deal reports storage (JSON format)
│   │   ├── DEAL_YYYYMMDD_HHMMSS_complete.json
│   │   └── deal_report_*.pdf
│   └── templates/
│       ├── sample_deal.json # Sample deal data
│       └── output_template.md # Report template
├── data/                    # Legacy data storage
├── reports/                 # Project-level reports (legacy)
├── test_broker_fee.py      # Broker fee functionality tests
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup  
├── requirements.txt        # Python dependencies
├── requirements-minimal.txt # Minimal dependencies for CLI
├── run.sh                  # Docker run script
└── README.md              # Complete documentation (this file)
```

### Key Files Explained
- **`gui.py`**: Complete PyQt5 interface with enhanced deal history, search functionality, and comprehensive data collection forms
- **`analyzer.py`**: Core engine implementing all COGO Capital requirements with customizable broker fees
- **`utils.py`**: Enhanced PDF export with proper text wrapping and margin optimization
- **`app/reports/`**: Primary storage location for all deal data and reports

## 🔧 Development

### Running Tests
```bash
# Basic functionality test
python app/main.py --cli

# Test with sample data
python -c "
from app.analyzer import DealAnalyzer
from app.utils import create_sample_deal
analyzer = DealAnalyzer()
deal = create_sample_deal()
results = analyzer.calculate_deal_metrics(deal)
print(analyzer.get_deal_summary(results))
"
```

### Building Custom Docker Image
```bash
# Build image
docker build -t cogo-analyzer:latest .

# Run container
docker run -it --rm \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/reports:/app/reports \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  cogo-analyzer:latest
```

## 📈 Enhanced COGO Capital Requirements Implementation

This analyzer provides complete COGO Capital lending compliance:

### Core Lending Criteria
- **Minimum Profit**: $20,000 net profit required for loan eligibility
- **Maximum LTV**: 65% of ARV (After Repair Value)
- **Maximum Purchase**: 80% of purchase price
- **Complete Documentation**: 22 broker + 6 lender documents with tracking system
- **Exit Strategies**: 6 approved strategies with optimized cost structures (1.5% - 8.0%)

### Enhanced Cost Structure
- **Customizable Broker Fee**: **1.0% - 3.5%** (major enhancement for deal optimization)
- **Finance Costs**: 5% of loan amount (interest, fees, insurance)
- **Strategy-Specific Selling Costs**: Automatically calculated based on chosen exit method

### Comprehensive Submission Preparation
- **Property Documentation**: Complete property details and address verification
- **Borrower Verification**: Full contact information, entity details, experience documentation
- **Guarantor Documentation**: Complete guarantor information when applicable
- **Financial Analysis**: Professional formatting with margin-optimized PDF export
- **Document Checklist**: Interactive tracking of all 28 required documents
- **Data Persistence**: All information saved for future reference and updates

### Quality Assurance Features
- **Input Validation**: Prevents errors and ensures data completeness
- **Professional Formatting**: PDF reports suitable for direct submission
- **Historical Tracking**: Complete audit trail of all deal analyses
- **Search Functionality**: Quickly locate deals by borrower or property
- **Data Integrity**: Automatic backup and recovery of all deal information

## 🛡️ Security Notes

- Application runs as non-root user in Docker
- Input validation prevents injection attacks
- File operations are restricted to designated directories
- No sensitive data stored in containers

## 🚀 Recent Enhancements & Version History

### Version 1.0 - Complete Loan Submission System ✅

**Major Features Added:**
- ✅ **Customizable Broker Fee**: Adjustable 1.0% - 3.5% for deal optimization
- ✅ **Enhanced Deal History**: Property address, borrower name columns with search functionality  
- ✅ **Comprehensive Data Collection**: Complete borrower and guarantor information forms
- ✅ **Professional PDF Export**: Margin-optimized formatting with text wrapping
- ✅ **Document Checklist Integration**: 28-document tracking system with interactive checkboxes
- ✅ **Data Recall Functionality**: "📝 Edit Additional Data" button for easy form access
- ✅ **Crash-Resistant Architecture**: Thread-safe signal connections and proper cleanup
- ✅ **Property Address Integration**: Full address capture throughout workflow
- ✅ **Smart Date Formatting**: Automatic extraction from deal IDs (MM/DD/YYYY)
- ✅ **Advanced Search**: Real-time filtering by borrower name or property address

**Technical Improvements:**
- ✅ **Signal Connection Safety**: Qt.QueuedConnection for stable multi-analysis
- ✅ **Enhanced Error Handling**: Graceful degradation and user feedback
- ✅ **Data Persistence**: Complete deal data with timestamps and metadata
- ✅ **Reports Directory Management**: Consistent file organization in app/reports
- ✅ **PDF Text Wrapping**: Property addresses and long content fit properly in cells
- ✅ **Form State Management**: All collected data preserved and recallable

**User Experience Enhancements:**
- ✅ **Intuitive Workflow**: Property address → broker fee → analysis → data collection → export
- ✅ **Visual Feedback**: Clear status indicators and progress tracking
- ✅ **Scalable Design**: Built to handle extensive deal databases
- ✅ **Professional Output**: Submission-ready PDF reports and documentation

### Version History Summary
- **v0.1**: Initial CLI implementation with basic deal analysis
- **v0.2**: Added PyQt5 GUI interface with exit strategy selection
- **v0.3**: Implemented document checklist system for eligible deals
- **v0.4**: Added deal history tracking and JSON export
- **v0.5**: Enhanced PDF export with professional formatting
- **v1.0**: **Complete loan submission preparation system** (current version)

## 🐛 Troubleshooting

### GUI Issues on macOS
```bash
# Install XQuartz
brew install --cask xquartz

# Start XQuartz and allow connections
xhost +localhost

# Run with proper display forwarding
docker-compose up
```

### GUI Issues on Linux
```bash
# Allow X11 forwarding
xhost +local:docker

# Run the application
docker-compose up
```

### Permission Errors
```bash
# Fix file permissions
chmod +x app/main.py
chown -R $(whoami):$(whoami) data reports
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software of House Lot & Land Sales Co. LLC.

## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Contact: [Your Support Email]

---

**Built for COGO Capital by House Lot & Land Sales Co. LLC**  
*Streamlining real estate investment analysis*