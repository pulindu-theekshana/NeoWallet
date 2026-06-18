from flask import Flask, jsonify, request
from flask_cors import CORS
from database import get_db, init_db
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allows Electron to talk to Flask

# Initialize the database on startup
init_db()


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


@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    d = request.get_json()
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO transactions (title,amount,category,date,note) VALUES (?,?,?,?,?)",
              (d['title'], d['amount'], d['category'], d['date'], d.get('note', '')))
    conn.commit()
    tid = c.lastrowid
    conn.close()
    return jsonify({'id': tid, 'message': 'Added'})


@app.route('/api/transactions/<int:tid>', methods=['PUT'])
def update_transaction(tid):
    d = request.get_json()
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE transactions SET title=?,amount=?,category=?,date=?,note=? WHERE id=?",
              (d['title'], d['amount'], d['category'], d['date'], d.get('note', ''), tid))
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
    month  = str(d['month']).zfill(2)
    year   = int(d['year'])
    amount = float(d['amount'])
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