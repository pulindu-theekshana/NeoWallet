from flask import Flask, jsonify, request
from flask_cors import CORS
from database import get_db, init_db
from datetime import datetime
import os
import math
import secrets as _secrets

app = Flask(__name__)
CORS(app)  # Allows Electron to talk to Flask

# Token injected by Electron at startup via environment variable
_API_TOKEN = os.environ.get('EXPENSE_API_TOKEN', '')

if not _API_TOKEN:
    print('[WARNING] EXPENSE_API_TOKEN is not set. API is running unprotected.')
    print('[WARNING] This is fine for development but should never happen in production.')

@app.before_request
def check_token():
    """Reject requests that don't carry the correct token.
       Skips the health check so the renderer can poll before it has the token."""
    if request.method == 'OPTIONS':
        return  # let Flask-CORS handle preflight requests
    if request.path == '/api/health':
        return  # health check is public
    incoming = request.headers.get('X-API-Token', '')
    if _API_TOKEN and not _secrets.compare_digest(incoming, _API_TOKEN):
        return jsonify({'error': 'Unauthorized'}), 401

# Initialize the database on startup
init_db()

# ── Valid values ──────────────────────────────────────────────
VALID_CATEGORIES = {
    'Groceries', 'Utilities', 'Transport', 'Dining', 'Shopping',
    'Healthcare', 'Entertainment', 'Education', 'Sports', 'Other'
}

def validate_transaction(d):
    """Returns (errors, cleaned) where errors is a list of strings
       and cleaned is a normalized dict ready to store in the database."""
    if not isinstance(d, dict):
        return ['Invalid transaction data'], {}

    errors = []
    cleaned = {}

    # Title
    title = str(d.get('title', '')).strip()
    if not title:
        errors.append('Title is required')
    elif len(title) > 100:
        errors.append('Title must be 100 characters or less')
    else:
        cleaned['title'] = title

    # Amount
    try:
        amount = float(d.get('amount', 0))
        if not math.isfinite(amount):
            errors.append('Amount must be a finite number')
        elif amount <= 0:
            errors.append('Amount must be greater than zero')
        elif amount > 99999999:
            errors.append('Amount is too large')
        else:
            cleaned['amount'] = amount
    except (TypeError, ValueError):
        errors.append('Amount must be a valid number')

    # Category
    category = d.get('category', '')
    if category not in VALID_CATEGORIES:
        errors.append('Invalid category')
    else:
        cleaned['category'] = category

    # Date
    date_str = str(d.get('date', ''))
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        cleaned['date'] = date_str
    except ValueError:
        errors.append('Date must be in YYYY-MM-DD format')

    # Note
    note = str(d.get('note', '')).strip()
    if len(note) > 200:
        errors.append('Note must be 200 characters or less')
    else:
        cleaned['note'] = note

    return errors, cleaned

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/dashboard')
def dashboard():
    month = str(request.args.get('month', datetime.now().month)).zfill(2)
    year  = str(request.args.get('year',  datetime.now().year))

    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE strftime('%m',date)=? AND strftime('%Y',date)=?", (month, year))
    total_spent = c.fetchone()['total']

    c.execute("SELECT COUNT(*) as cnt FROM transactions WHERE strftime('%m',date)=? AND strftime('%Y',date)=?", (month, year))
    trans_count = c.fetchone()['cnt']

    c.execute("SELECT amount FROM budgets WHERE month=? AND year=?", (month, int(year)))
    brow = c.fetchone()
    monthly_budget = brow['amount'] if brow else 0

    c.execute("""
        SELECT id, title, amount, category, date, note
        FROM transactions
        WHERE strftime('%m',date)=? AND strftime('%Y',date)=?
        ORDER BY date DESC, id DESC LIMIT 10
    """, (month, year))
    recent = [dict(r) for r in c.fetchall()]

    c.execute("""
        SELECT category, SUM(amount) as total
        FROM transactions
        WHERE strftime('%m',date)=? AND strftime('%Y',date)=?
        GROUP BY category ORDER BY total DESC
    """, (month, year))
    by_cat = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify({
        'total_spent':          total_spent,
        'monthly_budget':       monthly_budget,
        'transaction_count':    trans_count,
        'recent_transactions':  recent,
        'spending_by_category': by_cat,
        'remaining':            monthly_budget - total_spent
    })


@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    month    = request.args.get('month')
    year     = request.args.get('year')
    category = request.args.get('category', '')

    conn = get_db()
    c = conn.cursor()
    query  = "SELECT * FROM transactions WHERE 1=1"
    params = []

    if month and year:
        query += " AND strftime('%m',date)=? AND strftime('%Y',date)=?"
        params.extend([str(month).zfill(2), str(year)])
    if category:
        query += " AND category=?"
        params.append(category)

    query += " ORDER BY date DESC, id DESC"
    c.execute(query, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/transactions/import', methods=['POST'])
def import_transactions():
    rows = request.get_json()
    if not isinstance(rows, list):
        return jsonify({'error': 'Expected a list'}), 400

    inserted = 0
    skipped  = 0
    conn = get_db()
    c = conn.cursor()

    for d in rows:
        errors, cleaned = validate_transaction(d)
        if errors:
            skipped += 1
            continue
        c.execute(
            "INSERT INTO transactions (title, amount, category, date, note) VALUES (?,?,?,?,?)",
            (cleaned['title'], cleaned['amount'], cleaned['category'], cleaned['date'], cleaned['note'])
        )
        inserted += 1

    conn.commit()
    conn.close()
    return jsonify({'inserted': inserted, 'skipped': skipped})


@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    d = request.get_json()
    if not d:
        return jsonify({'error': 'No data provided'}), 400
    errors, cleaned = validate_transaction(d)
    if errors:
        return jsonify({'error': errors[0]}), 400
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO transactions (title,amount,category,date,note) VALUES (?,?,?,?,?)",
              (cleaned['title'], cleaned['amount'], cleaned['category'], cleaned['date'], cleaned['note']))
    conn.commit()
    tid = c.lastrowid
    conn.close()
    return jsonify({'id': tid, 'message': 'Added'})


@app.route('/api/transactions/<int:tid>', methods=['PUT'])
def update_transaction(tid):
    d = request.get_json()
    if not d:
        return jsonify({'error': 'No data provided'}), 400
    errors, cleaned = validate_transaction(d)
    if errors:
        return jsonify({'error': errors[0]}), 400
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE transactions SET title=?,amount=?,category=?,date=?,note=? WHERE id=?",
              (cleaned['title'], cleaned['amount'], cleaned['category'], cleaned['date'], cleaned['note'], tid))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Updated'})


@app.route('/api/transactions/<int:tid>', methods=['DELETE'])
def delete_transaction(tid):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM transactions WHERE id=?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Deleted'})


@app.route('/api/budgets', methods=['GET'])
def get_budgets():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM budgets ORDER BY year DESC, month DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/budgets', methods=['POST'])
def set_budget():
    d = request.get_json()
    if not d:
        return jsonify({'error': 'No data provided'}), 400
    try:
        amount = float(d.get('amount', 0))
        if not math.isfinite(amount) or amount <= 0 or amount > 99999999:
            return jsonify({'error': 'Invalid budget amount'}), 400
        month = int(d['month'])
        if month < 1 or month > 12:
            return jsonify({'error': 'Month must be between 1 and 12'}), 400
        year = int(d['year'])
        if year < 2000 or year > 2100:
            return jsonify({'error': 'Invalid year'}), 400
    except (TypeError, ValueError, KeyError):
        return jsonify({'error': 'Invalid budget data'}), 400
    month  = str(month).zfill(2)
    # year and amount already parsed and validated above — use them directly
    conn = get_db()
    c = conn.cursor()
    # Check if exists first (compatible with older SQLite)
    c.execute("SELECT id FROM budgets WHERE month=? AND year=?", (month, year))
    existing = c.fetchone()
    if existing:
        c.execute("UPDATE budgets SET amount=? WHERE month=? AND year=?", (amount, month, year))
    else:
        c.execute("INSERT INTO budgets (month,year,amount) VALUES (?,?,?)", (month, year, amount))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Saved'})


@app.route('/api/reports')
def get_reports():
    year = str(request.args.get('year', datetime.now().year))
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        SELECT strftime('%m',date) as month, SUM(amount) as total
        FROM transactions WHERE strftime('%Y',date)=?
        GROUP BY month ORDER BY month
    """, (year,))
    monthly = [dict(r) for r in c.fetchall()]

    c.execute("""
        SELECT category, SUM(amount) as total
        FROM transactions WHERE strftime('%Y',date)=?
        GROUP BY category ORDER BY total DESC
    """, (year,))
    by_cat = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify({'monthly_spending': monthly, 'category_breakdown': by_cat})

@app.route('/api/clear', methods=['DELETE'])
def clear_all_data():
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM transactions")
    c.execute("DELETE FROM budgets")
    try:
        c.execute("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'budgets')")
    except Exception:
        pass  # table might not exist yet, that's fine
    conn.commit()
    conn.close()
    return jsonify({'message': 'All data cleared'})

if __name__ == '__main__':
    print('[Flask] Starting on http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)