import argparse
import sys
from scripts.database_helpers import connections
from etl.analytics import copy_table_to_postgres


#conn_sqlite, cur_sqlite, _, _ = connections()
#cur_sqlite.execute("SELECT athlete_code,name,last_updated FROM athletes ORDER BY last_updated DESC LIMIT 20;")
#print(cur_sqlite.fetchall())
#conn_sqlite.close()

# run from a script or interactive session in project root

#copy_athletes_to_postgres(updateFrom=None, batch_size=500, cast_timestamps=False, run_age_update=False)



def main(formatted_date: str = None, event_code: int = None, exact: bool = False):
	"""Standalone runner to push only `current_age_estimate` from SQLite->Postgres.

	Assumes `eventpositions` in SQLite already has `current_age_estimate` computed.
	"""
	# Use the same pattern as in newAnalytics: key columns and only the one field
	copy_table_to_postgres(
		table_name="eventpositions",
		key_columns=["event_code", "event_date", "athlete_code"],
		fields=["current_age_estimate"],
		earliest_date=formatted_date,
		exact_date=exact,
		updateOnly=True,
		event_code=event_code,
	)


if __name__ == '__main__':
	p = argparse.ArgumentParser(description='Push current_age_estimate from SQLite to Postgres for eventpositions')
	p.add_argument('--formatted_date', '-d', help='ISO formatted date YYYY-MM-DD to restrict rows (uses exact match if --exact).', default=None)
	p.add_argument('--event_code', '-e', type=int, help='Optional event_code to restrict updates', default=None)
	p.add_argument('--exact', action='store_true', help='Use exact date match (requires --formatted_date).', default=False)
	args = p.parse_args()

	if args.exact and not args.formatted_date:
		print("Error: --exact requires --formatted_date to be supplied (use --exact only when updating a single date).")
		sys.exit(1)

	main(formatted_date=args.formatted_date, event_code=args.event_code, exact=args.exact)