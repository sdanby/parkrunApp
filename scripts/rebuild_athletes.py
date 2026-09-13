"""One-off utility to rebuild athlete age fields into a temp snapshot.

The script mirrors the existing SQL pipeline but feeds it with the entire
`eventpositions_view` instead of the rolling tmp_eventpositions window. It
stages the results inside `tmp_rebuild_athletes` so the live `athletes` table
is untouched and easy to compare against.
"""

from __future__ import annotations

import argparse
from datetime import datetime
from typing import Optional

from scripts.database_helpers import connections, get_temp_table_sql, get_update_table_sql


ATHLETE_PIPELINE = [
	"tmp_athlete_ages",
	"tmp_age_changes",
	"tmp_dob_ranges",
	"tmp_dob_summary",
	"tmp_latest_club",
	"tmp_final_age_updates_mini",
	#"tmp_final_age_updates",
	"tmp_coalesce_age_fields",
	#"tmp_extended_age_fields",
	#"tmp_athlete_update",
	#"tmp_active_athlete_update",
	#"tmp_new_athletes",
]

BAD_ATHLETE_PIPELINE = [
	"tmp_age_changes",
	"tmp_dob_ranges",
	"tmp_dob_summary_base",
	"tmp_dob_summary_fix",
	"tmp_dob_summary",
	"tmp_latest_club",
	"tmp_final_age_updates",
	"tmp_coalesce_age_fields",
]


def _build_full_eventpositions(
	conn,
	start_date: Optional[str] = None,
	end_date: Optional[str] = None,
) -> None:
	"""Populate tmp_eventpositions with the full eventpositions_view history."""

	filters = ["athlete_code IS NOT NULL"]
	params: dict[str, object] = {}
	if start_date:
		filters.append("formatted_date >= :start_date")
		params["start_date"] = start_date
	if end_date:
		filters.append("formatted_date <= :end_date")
		params["end_date"] = end_date
	where_clause = " AND ".join(filters)

	conn.execute("DROP TABLE IF EXISTS tmp_eventpositions;")
	conn.execute(
		f"""
		CREATE TEMP TABLE tmp_eventpositions AS
		SELECT
			event_code,
			event_date,
			formatted_date,
			time,
			time_seconds,
			athlete_code,
			CAST(NULL AS REAL) AS time_ratio,
			age_grade,
			age_group,
			club,
			formatted_date AS end_date,
			1.2 AS max_ratio,
			name,
			comment
		FROM eventpositions_view
		WHERE {where_clause};
		""",
		params,
	)
	conn.execute(
		"CREATE INDEX IF NOT EXISTS idx_tmp_eventpositions_ac_fd ON tmp_eventpositions(athlete_code, formatted_date);"
	)
	conn.commit()


def _prepare_bad_temp_sources(conn, params: dict[str, object]) -> None:
	"""Build *_bad tables and materialize them into the standard temp names."""
	print("Building tmp_eventpositions_bad ...")
	get_temp_table_sql(
		"tmp_eventpositions_bad",
		params=params,
		execute_conn=conn,
		write_file=True,
		silent=False,
	)
	print("Building tmp_athlete_ages_bad ...")
	get_temp_table_sql(
		"tmp_athlete_ages_bad",
		params=params,
		execute_conn=conn,
		write_file=True,
		silent=False,
	)
	conn.execute("DROP TABLE IF EXISTS tmp_athlete_ages;")
	conn.execute(
		"""
		CREATE TABLE tmp_athlete_ages AS
		SELECT *
		FROM tmp_athlete_ages_bad;
		"""
	)
	conn.execute("DROP TABLE IF EXISTS tmp_eventpositions;")
	conn.execute(
		"""
		CREATE TABLE tmp_eventpositions AS
		SELECT *
		FROM tmp_eventpositions_bad;
		"""
	)
	conn.execute(
		"CREATE INDEX IF NOT EXISTS idx_tmp_eventpositions_ac_fd ON tmp_eventpositions(athlete_code, formatted_date);"
	)
	conn.commit()


def _run_section(name: str, conn, params: dict[str, object]) -> None:
	print(f"Building {name} ...")
	get_temp_table_sql(
		name,
		params=params,
		execute_conn=conn,
		write_file=True,
		silent=False,
	)


def _materialize_snapshot(conn, snapshot_table: str = "tmp_rebuild_athletes") -> None:
	"""Union updates, new athletes, and untouched rows into a temp snapshot."""

	conn.execute(f"DROP TABLE IF EXISTS {snapshot_table};")
	conn.execute(
		f"""
		CREATE TEMP TABLE {snapshot_table} AS
			SELECT * FROM tmp_coalesce_age_fields;
		"""
	)
	conn.commit()
def _materialize_snapshot_old(conn, snapshot_table: str = "tmp_rebuild_athletes") -> None:
	"""Union updates, new athletes, and untouched rows into a temp snapshot."""

	conn.execute(f"DROP TABLE IF EXISTS {snapshot_table};")
	conn.execute(
		f"""
		CREATE TEMP TABLE {snapshot_table} AS
		WITH changed AS (
			SELECT * FROM tmp_active_athlete_update
			UNION ALL
			SELECT * FROM tmp_new_athletes
		)
		SELECT * FROM changed
		UNION ALL
		SELECT a.athlete_code,
			   a.name,
			   a.min_dob,
			   a.max_dob,
			   a.last_updated,
			   a.club,
			   a.sex,
			   a.last_age_estimate,
			   a.current_age_estimate
		FROM athletes a
		WHERE NOT EXISTS (
			SELECT 1 FROM changed c WHERE c.athlete_code = a.athlete_code
		);
		"""
	)
	conn.commit()

def _preview_counts(conn) -> None:
	cur = conn.execute("SELECT COUNT(*) FROM tmp_rebuild_athletes;")
	snapshot_count = cur.fetchone()[0]
	cur = conn.execute("SELECT COUNT(*) FROM athletes;")
	live_count = cur.fetchone()[0]
	print(f"Snapshot athletes: {snapshot_count:,} | Live athletes: {live_count:,}")


def _preview_athlete(conn, athlete_code: str) -> None:
	query = """
	SELECT athlete_code,name,min_dob,max_dob,last_updated,sex,last_age_estimate,current_age_estimate
	FROM tmp_rebuild_athletes
	WHERE athlete_code = ?;
	"""
	rows = conn.execute(query, (athlete_code,)).fetchall()
	if not rows:
		print(f"No rebuilt row for athlete {athlete_code}")
		return
	for row in rows:
		print(row)


def rebuild_athletes_snapshot(
	start_date: Optional[str] = None,
	end_date: Optional[str] = None,
	sample_athlete: Optional[str] = None,
	athletes_bad: bool = False,
) -> None:
	conn, cursor, render_db_conn, render_cursor = connections()
	render_cursor.close()
	render_db_conn.close()
	cursor.close()

	try:
		default_date = datetime.utcnow().date().isoformat()
		params = {"formatted_date": default_date, "period": 9999, "event_code": None}
		if athletes_bad:
			_prepare_bad_temp_sources(conn, params)
			for section in BAD_ATHLETE_PIPELINE:
				_run_section(section, conn, params)
			get_update_table_sql(
				"tmp_coalesce_age_fields",
				params=params,
				execute_conn=conn,
				write_file=True,
			)
		else:
			_build_full_eventpositions(conn, start_date=start_date, end_date=end_date)
			for section in ATHLETE_PIPELINE:
				_run_section(section, conn, params)

		_materialize_snapshot(conn)
		_preview_counts(conn)
		if sample_athlete:
			_preview_athlete(conn, sample_athlete)
	finally:
		conn.close()


def _parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Rebuild athletes table into a temp snapshot")
	parser.add_argument(
		"--start-date",
		dest="start_date",
		help="Lower formatted_date bound (YYYY-MM-DD) for eventpositions_view",
	)
	parser.add_argument(
		"--end-date",
		dest="end_date",
		help="Upper formatted_date bound (YYYY-MM-DD) for eventpositions_view",
	)
	parser.add_argument(
		"--athlete",
		dest="athlete",
		help="Athlete code to preview from tmp_rebuild_athletes",
	)
	parser.add_argument(
		"--athletes-bad",
		action="store_true",
		help="Use tmp_eventpositions_bad/tmp_athlete_ages_bad pipeline instead of rebuilding from scratch.",
	)
	return parser.parse_args()


def main() -> None:
	args = _parse_args()
	rebuild_athletes_snapshot(
		start_date=args.start_date,
		end_date=args.end_date,
		sample_athlete=args.athlete,
		athletes_bad=args.athletes_bad,
	)


if __name__ == "__main__":
	main()
	
    #python rebuildAthletes.py --athletes-bad   this will repair any athletes where dobs are in error - corrects the whole of Athletes