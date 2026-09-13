import sqlite3

conn = sqlite3.connect(r'c:\Users\stevi\flask-backend\myapp\parkrun.db')
cur = conn.cursor()

# Check what dates we have in curve_run_metrics_history
print('=== Dates in curve_run_metrics_history ===')
cur.execute('SELECT MIN(formatted_date), MAX(formatted_date), COUNT(DISTINCT formatted_date) FROM curve_run_metrics_history')
row = cur.fetchone()
print(f'Min date: {row[0]}, Max date: {row[1]}, Total dates: {row[2]}')

# Check a few early dates to see accumulation
print('\n=== Athlete counts by period (for early weeks) ===')
for test_date in ['2011-02-19', '2011-02-26', '2011-03-05', '2011-03-12']:
    cur.execute('''
    WITH all_period AS (
        SELECT COUNT(DISTINCT athlete_code) as cnt FROM curve_run_metrics_history WHERE formatted_date <= ?
    ),
    one_y AS (
        SELECT COUNT(DISTINCT athlete_code) as cnt FROM curve_run_metrics_history 
        WHERE formatted_date <= ? AND formatted_date >= date(?, "-1 year")
    )
    SELECT (SELECT cnt FROM all_period), (SELECT cnt FROM one_y)
    ''', (test_date, test_date, test_date))
    result = cur.fetchone()
    if result:
        all_cnt, one_y_cnt = result
        print(f'{test_date}: ALL={all_cnt} athletes, 1Y={one_y_cnt} athletes')

# Now check stage2 output rows for these dates
print('\n=== Stage2 output rows by date ===')
for test_date in ['2011-02-19', '2011-02-26', '2011-03-05', '2011-03-12']:
    cur.execute('''
    SELECT period_type, COUNT(DISTINCT best_metric_seconds) as unique_times, COUNT(*) as freq_entries
    FROM curve_rank_mapping_history WHERE snapshot_date = ? GROUP BY period_type
    ''', (test_date,))
    rows = cur.fetchall()
    if rows:
        for period_type, unique_times, freq_entries in rows:
            print(f'{test_date} {period_type}: {unique_times} unique times, {freq_entries} freq entries')
    else:
        print(f'{test_date}: (no data)')

conn.close()
