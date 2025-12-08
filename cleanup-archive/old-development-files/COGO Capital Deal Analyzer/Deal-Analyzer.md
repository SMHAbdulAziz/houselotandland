# 📊 Deal Analyzer & COGO Loan Eligibility Guide

This document outlines the requirements, logic, and application structure for building a custom **COGO-Compliant Deal Analyzer Tool** with GUI for local use and web integration. It supports:

* ✅ Filtering fix-and-flip deals
* ✅ Ensuring COGO Capital loan eligibility (profit > $20K)
* ✅ Generating clear reports for submission
* ✅ Optional borrower submission interface for [www.HouseLotAndLand.org](http://www.HouseLotAndLand.org)

---

## 🔧 Local Application (Self-Hosted GUI via Docker)

### ⚙️ Tech Stack

* **Language**: Python 3.11+
* **GUI**: PyQt5 / Tkinter (recommended: PyQt5)
* **Data Handling**: Pandas, JSON
* **Packaging**: Dockerfile, docker-compose

### 📁 File Structure Example

```
cogo-deal-analyzer/
├── app/
│   ├── __init__.py
│   ├── main.py              # Entry point
│   ├── gui.py               # GUI layout and event logic
│   ├── analyzer.py          # Deal logic (profit calc, eligibility)
│   ├── utils.py             # Formatting, export, helpers
│   └── templates/
│       ├── sample_deal.json
│       └── output_template.md
├── data/
│   └── submitted_deals.json
├── reports/
│   └── [generated PDFs or JSONs]
├── Dockerfile
├── requirements.txt
├── .env                     # Config vars if needed
├── README.md
└── docker-compose.yml       # Optional
```

### 🧑‍🧒 Core Logic: Deal Analyzer (in `analyzer.py`)

```python
from typing import Dict

def calculate_profit(deal: Dict) -> float:
    arv = deal["arv"]
    selling_cost = arv * 0.08  # 8% sales cost
    purchase_price = deal["purchase_price"]
    rehab = deal["rehab"]
    loan_amount = min(arv * 0.65, purchase_price * 0.8)
    broker_fee = loan_amount * 0.03
    finance_costs = loan_amount * 0.05  # combined estimate

    return arv - selling_cost - purchase_price - rehab - broker_fee - finance_costs

def is_cogo_eligible(profit: float) -> bool:
    return profit >= 20000
```

### 💻 GUI Features (via `gui.py`)

* Input form:

  * ARV, Purchase Price, Rehab Cost
* Output:

  * Max Loan (80% PP or 65% ARV)
  * Estimated Net Profit
  * Eligibility ✔/❌
* Export option to PDF or JSON for deal packaging

### 🐳 Dockerfile (basic)

```Dockerfile
FROM python:3.11
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "app/main.py"]
```

### requirements.txt

```
PyQt5==5.15.9
pandas
```

### README.md

````markdown
# COGO Deal Analyzer

A desktop GUI tool for evaluating real estate deals against COGO Capital loan eligibility standards. 

## Run Locally
```bash
docker build -t deal-analyzer .
docker run --rm -it -v $PWD:/app deal-analyzer
````

## Features

* GUI for deal input
* COGO eligibility filter
* Exports reports

````

---

## 🌐 Web-Based Deal Submission Tool (Google Apps Script)

### 🔨 Use Case
Visitors enter a deal into a form on www.HouseLotAndLand.org. The app:
1. Validates deal metrics
2. Checks for profit > $20K
3. If valid → Logs into Google Sheet + Notifies your team

### 🛠️ Google Apps Script Setup (High-Level)
1. Google Form OR custom HTML form
2. Apps Script backend (doPost)
3. Spreadsheet logging + Gmail notification

### 📊 Core Validation Logic (Google Apps Script)
```javascript
function isDealEligible(arv, purchasePrice, rehab) {
  var loanAmount = Math.min(arv * 0.65, purchasePrice * 0.8);
  var sellCost = arv * 0.08;
  var brokerFee = loanAmount * 0.03;
  var financeCost = loanAmount * 0.05;
  var profit = arv - sellCost - purchasePrice - rehab - brokerFee - financeCost;
  return profit >= 20000;
}
````

### 📂 Spreadsheet Logging Structure

| Timestamp | ARV | Purchase Price | Rehab | Loan Amt | Est. Profit | COGO Eligible | Name | Email | Notes |

---

## ✅ Submission Requirements (For Eligible Deals)

If a deal is marked "COGO Eligible", your internal system will:

* Trigger a webhook or email alert
* Start a folder in Google Drive with pre-named doc templates (e.g. Promissory Note, Addendum, Pre-Approval Letter)
* Allow internal team to pick up and finalize package for COGO

---

## 📌 Roadmap

* [x] File structure + logic design
* [ ] Build local Docker app
* [ ] Build GUI + analyzer logic
* [ ] Deploy test version for feedback
* [ ] Build Apps Script version
* [ ] Integrate Google Sheets + Email Notifications
* [ ] Launch web form + link to website

---

## 🔐 Security Notes

* Limit web app data exposure
* Sanitize all form inputs
* Use OAuth for Apps Script if pushing files to Drive

---

Let me know when you're ready to begin coding — I can generate the full `main.py`, `gui.py`, `analyzer.py`, and Google Apps Script files on request.
