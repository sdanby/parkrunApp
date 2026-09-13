from __future__ import annotations

import argparse
from contextlib import suppress
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from itertools import groupby
from typing import Iterable, List, Optional, Sequence

from dateutil.relativedelta import relativedelta

from etl.analytics import copy_table_to_postgres
from scripts.database_helpers import connections, get_temp_table_sql, get_update_table_sql, get_insert_table_sql

# So this code will be used to correct date of birth errors which emerge from people changing their date of births
# It means the algortithm that calculates a more accurate data of birth has to reset.
# More important, it ensures that the historic date of births are applied to the eventpostions ratios.
# Therefore the Athlete table will then need to be reset with the most current summary.
# Purpose: recompute tmp_dob_ranges so earliest/latest DOB windows stay consistent when
# athletes revise their reported dates of birth mid-history. Parameters:
#   --limit N               : only process first N rows from tmp_age_changes_wide
#   --dry-run               : build results but do not persist tmp_dob_ranges
#   --show-conflicts N      : print first N rows where earliest > latest within each run
#   --athlete CODE          : restrict processing to a single athlete_code
#   --store-no-conflict     : still write rows even if no conflicts detected
#   --max-conflict-athletes M : limit number of athletes written (default 10, 0 = no limit)
#   --summary-only          : skip tmp_dob_ranges rebuild and only refresh downstream DOB tables
#   --start-ratios          : skip DOB processing and begin at the age-ratio error tables (requires tmp_dob_ranges)
#   --skip-downstream       : skip does not update athletes or eventpositions tables after rebuilding tmp_dob_ranges
#
# use example: python clearAgeErrors.py --athlete 528017 --store-no-conflict --show-conflicts 5
#              python clearAgeErrors.py --max-conflict-athletes 0  
#               python clearAgeErrors.py --max-conflict-athletes 0   --start-ratios 
#               python clearAgeErrors.py --summary-only --skip-downstream



DATE_FORMAT = "%Y-%m-%d"
ONE_DAY = timedelta(days=1)
DEFAULT_MAX_CONFLICT_ATHLETES = 0
TABLE_NAME_ALIASES = {
	"tmp_eventpositions_err": ["eventpositions_err"],
}
EVENTPOSITIONS_RATIO_FIELDS = ["age_ratio_male", "age_ratio_sex", "current_age_estimate"]


@dataclass(frozen=True)
class AgeChangeRow:
	athlete_code: str
	formatted_date: str
	age: Optional[int]
	age_max: Optional[int]
	prev_age: Optional[int]
	prev_age_max: Optional[int]
	prev_date: Optional[str]


@dataclass(frozen=True)
class DobRangeRow:
	athlete_code: str
	prev_date: Optional[str]
	formatted_date: str
	prev_age: Optional[int]
	prev_age_max: Optional[int]
	age: Optional[int]
	age_max: Optional[int]
	earliest_possible_dob: Optional[str]
	latest_possible_dob: Optional[str]
	range_conflict: int
	raw_min_dob: Optional[str]
	raw_max_dob: Optional[str]

	@property
	def earliest_max_dob(self) -> Optional[str]:
		return self.earliest_possible_dob

	@property
	def latest_min_dob(self) -> Optional[str]:
		return self.latest_possible_dob


def _parse_iso(value: Optional[str]) -> Optional[date]:
	if not value:
		return None
	return datetime.strptime(value, DATE_FORMAT).date()


def _format_iso(value: Optional[date]) -> Optional[str]:
	return value.strftime(DATE_FORMAT) if value else None


def _later(first: Optional[date], second: Optional[date]) -> Optional[date]:
	if first and second:
		return first if first > second else second
	return first or second


def _earlier(first: Optional[date], second: Optional[date]) -> Optional[date]:
	if first and second:
		return first if first < second else second
	return first or second


def _current_min(formatted: Optional[date], age_max: Optional[int]) -> Optional[date]:
	if formatted is None or age_max is None:
		return None
	return formatted - relativedelta(years=age_max + 1) + ONE_DAY


def _current_max(formatted: Optional[date], age_value: Optional[int]) -> Optional[date]:
	if formatted is None or age_value is None:
		return None
	return formatted - relativedelta(years=age_value)


def _previous_bounds(row: AgeChangeRow) -> tuple[Optional[date], Optional[date]]:
	if row.prev_age is None or not row.prev_date:
		return None, None
	prev_date = _parse_iso(row.prev_date)
	if prev_date is None:
		return None, None
	prev_min = _current_min(prev_date, row.prev_age_max)
	prev_max = _current_max(prev_date, row.prev_age)
	return prev_min, prev_max


def _compute_bounds(row: AgeChangeRow) -> DobRangeRow:
	formatted_date = _parse_iso(row.formatted_date)
	curr_min = _current_min(formatted_date, row.age_max)
	curr_max = _current_max(formatted_date, row.age)
	prev_min, prev_max = _previous_bounds(row)
	earliest_possible = _later(curr_min, prev_min)
	latest_possible = _earlier(curr_max, prev_max)
	return DobRangeRow(
		athlete_code=row.athlete_code,
		prev_date=row.prev_date,
		formatted_date=row.formatted_date,
		prev_age=row.prev_age,
		prev_age_max=row.prev_age_max,
		age=row.age,
		age_max=row.age_max,
		earliest_possible_dob=_format_iso(earliest_possible),
		latest_possible_dob=_format_iso(latest_possible),
		range_conflict=0,
		raw_min_dob=_format_iso(curr_min),
		raw_max_dob=_format_iso(curr_max),
	)


def _max_iso(prev: Optional[str], current: Optional[str]) -> Optional[str]:
	if prev is None:
		return current
	if current is None:
		return prev
	return prev if prev > current else current


def _min_iso(prev: Optional[str], current: Optional[str]) -> Optional[str]:
	if prev is None:
		return current
	if current is None:
		return prev
	return prev if prev < current else current


def _apply_running_bounds(rows: Sequence[DobRangeRow]) -> List[DobRangeRow]:
	adjusted: List[DobRangeRow] = []
	prev_min: Optional[str] = None
	prev_max: Optional[str] = None
	for row in rows:
		new_min = _max_iso(prev_min, row.earliest_possible_dob)
		new_max = _min_iso(prev_max, row.latest_possible_dob)
		range_conflict = 1 if new_min and new_max and new_min > new_max else 0
		if range_conflict:
			new_min = row.raw_min_dob
			new_max = row.raw_max_dob
		adjusted_row = replace(
			row,
			earliest_possible_dob=new_min,
			latest_possible_dob=new_max,
			range_conflict=range_conflict,
		)
		adjusted.append(adjusted_row)
		prev_min, prev_max = new_min, new_max
	return adjusted

def _ensure_wide_sources(conn) -> None:
	params: dict = {}
	get_temp_table_sql('tmp_athlete_ages_wide', write_file=True, params=params, execute_conn=conn, silent=False)
	get_temp_table_sql('tmp_age_changes_wide', write_file=True, params=params, execute_conn=conn, silent=False)


def _build_temp_table(conn, table_name: str, params: Optional[dict] = None) -> None:
	params = params or {}
	names_to_try = [table_name] + TABLE_NAME_ALIASES.get(table_name, [])
	last_exc: Optional[Exception] = None
	for candidate in names_to_try:
		try:
			get_temp_table_sql(candidate, write_file=True, params=params, execute_conn=conn, silent=False)
			return
		except Exception as exc:
			last_exc = exc
	if last_exc:
		raise last_exc


def _apply_coalesce_age_updates(conn, params: Optional[dict] = None) -> None:
	params = params or {}
	get_update_table_sql('tmp_coalesce_age_fields', write_file=True, params=params, execute_conn=conn)
	_build_temp_table(conn, 'tmp_new_athletes', params)
	get_insert_table_sql('tmp_new_athletes', write_file=True, params=params, execute_conn=conn)


def _table_exists(cursor, table_name: str) -> bool:
	cursor.execute(
		"SELECT name FROM sqlite_master WHERE type='table' AND name=?",
		(table_name,),
	)
	return cursor.fetchone() is not None


def _refresh_latest_club_chain(conn, cursor) -> None:
	params: dict = {}
	_build_temp_table(conn, 'tmp_latest_club_wide', params)
	cursor.execute("DROP TABLE IF EXISTS tmp_latest_club")
	cursor.execute("ALTER TABLE tmp_latest_club_wide RENAME TO tmp_latest_club")
	_build_temp_table(conn, 'tmp_final_age_updates', params)
	_build_temp_table(conn, 'tmp_coalesce_age_fields', params)
	_apply_coalesce_age_updates(conn, params)


def _build_ratio_error_chain(conn) -> None:
	params: dict = {}
	for table_name in (
		'tmp_eventpositions_err',
		'tmp_ageRatio_inputs_err',
		'tmp_ageRatio_calc_err',
		'tmp_ageRatio_fract_err',
		'tmp_ageRatio_clamped_err',
		'tmp_ageRatio_final_err',
	):
		_build_temp_table(conn, table_name, params)
	_update_eventpositions_from_ratios(conn)
	_sync_eventpositions_to_postgres(conn)


def _update_eventpositions_from_ratios(conn) -> None:
	conn.execute(
		"""
		UPDATE eventpositions
		SET age_ratio_male = (
		        SELECT r.male_age_ratio
		        FROM tmp_ageRatio_final_err r
		        WHERE r.athlete_code = eventpositions.athlete_code
		          AND r.event_code = eventpositions.event_code
		          AND strftime('%d/%m/%Y', r.formatted_date) = eventpositions.event_date
		    ),
		    age_ratio_sex = (
		        SELECT r.sex_age_ratio
		        FROM tmp_ageRatio_final_err r
		        WHERE r.athlete_code = eventpositions.athlete_code
		          AND r.event_code = eventpositions.event_code
		          AND strftime('%d/%m/%Y', r.formatted_date) = eventpositions.event_date
		    ),
		    current_age_estimate = (
		        SELECT r.age_guess
		        FROM tmp_ageRatio_final_err r
		        WHERE r.athlete_code = eventpositions.athlete_code
		          AND r.event_code = eventpositions.event_code
		          AND strftime('%d/%m/%Y', r.formatted_date) = eventpositions.event_date
		    )
		WHERE EXISTS (
		    SELECT 1
		    FROM tmp_ageRatio_final_err r
		    WHERE r.athlete_code = eventpositions.athlete_code
		      AND r.event_code = eventpositions.event_code
		      AND strftime('%d/%m/%Y', r.formatted_date) = eventpositions.event_date
		)
		"""
	)

def _sync_eventpositions_to_postgres(conn) -> None:
	cursor = conn.cursor()
	try:
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		cursor.execute(
			"""
			CREATE TABLE tmp_eventpositions_ratio_sync AS
			SELECT e.event_code,
			       e.event_date,
			       e.athlete_code,
			       e.age_ratio_male,
			       e.age_ratio_sex,
			       e.current_age_estimate
			FROM eventpositions e
			JOIN tmp_ageRatio_final_err r
			  ON r.athlete_code = e.athlete_code
			 AND r.event_code = e.event_code
			 AND strftime('%d/%m/%Y', r.formatted_date) = e.event_date
			"""
		)
		conn.commit()
		cursor.execute("SELECT COUNT(*) FROM tmp_eventpositions_ratio_sync")
		count_row = cursor.fetchone()
		row_count = count_row[0] if count_row else 0
	except Exception as exc:
		print(f"Skipping Postgres sync for eventpositions; unable to build sync table ({exc})")
		return
	if not row_count:
		print("No eventpositions rows to sync to Postgres.")
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		conn.commit()
		return
	rows = cursor.execute(
		"""
		SELECT event_code,
		       event_date,
		       athlete_code,
		       age_ratio_male,
		       age_ratio_sex,
		       current_age_estimate
		FROM tmp_eventpositions_ratio_sync
		ORDER BY event_code, event_date, athlete_code
		"""
	).fetchall()
	if not rows:
		print("No rows fetched from tmp_eventpositions_ratio_sync; skipping Postgres sync.")
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		conn.commit()
		return
	try:
		from psycopg2.extras import execute_values  # type: ignore
	except Exception as exc:
		print(f"Unable to import execute_values for Postgres sync ({exc}); skipping upload.")
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		conn.commit()
		return
	pg_conn = None
	pg_cursor = None
	try:
		local_conn, local_cursor, pg_conn, pg_cursor = connections()
		with suppress(Exception):
			local_cursor.close()
		with suppress(Exception):
			local_conn.close()
	except Exception as exc:
		print(f"Unable to open Postgres connection for ratio sync ({exc})")
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		conn.commit()
		return
	if pg_conn is None or pg_cursor is None:
		print("Postgres connection unavailable; skipping ratio sync upload.")
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		conn.commit()
		return
	try:
		all_columns = ["event_code", "event_date", "athlete_code"] + EVENTPOSITIONS_RATIO_FIELDS
		v_cols = ", ".join(all_columns)
		set_clause = ", ".join([f"{field} = v.{field}" for field in EVENTPOSITIONS_RATIO_FIELDS])
		update_sql = (
			f"WITH v({v_cols}) AS (VALUES %s) "
			"UPDATE eventpositions SET " + set_clause +
			" FROM v WHERE eventpositions.event_code = v.event_code"
			" AND eventpositions.event_date = v.event_date"
			" AND eventpositions.athlete_code = v.athlete_code"
		)
		execute_values(pg_cursor, update_sql, rows, page_size=1000)
		pg_conn.commit()
		print(f"Synced {len(rows)} eventpositions rows to Postgres from ratio temp table.")
	except Exception as exc:
		print(f"Failed to sync eventpositions ratios to Postgres ({exc})")
		with suppress(Exception):
			pg_conn.rollback()
	finally:
		with suppress(Exception):
			pg_cursor.close()
		with suppress(Exception):
			pg_conn.close()
		cursor.execute("DROP TABLE IF EXISTS tmp_eventpositions_ratio_sync")
		conn.commit()


def _fetch_age_changes(cursor, athlete_filter: Optional[str] = None) -> List[AgeChangeRow]:
	if athlete_filter:
		cursor.execute(
			"""
			SELECT athlete_code,
			       formatted_date,
			       age,
			       age_max,
			       prev_age,
			       prev_age_max,
			       prev_date
			FROM tmp_age_changes_wide
			WHERE athlete_code = ?
			ORDER BY athlete_code, formatted_date
			""",
			(athlete_filter,),
		)
	else:
		cursor.execute(
			"""
			SELECT athlete_code,
			       formatted_date,
			       age,
			       age_max,
			       prev_age,
			       prev_age_max,
			       prev_date
			FROM tmp_age_changes_wide
			ORDER BY athlete_code, formatted_date
			"""
		)
	rows = cursor.fetchall()
	return [AgeChangeRow(*row) for row in rows]


def _group_rows_by_athlete(rows: Sequence[AgeChangeRow]) -> Iterable[tuple[str, List[AgeChangeRow]]]:
	key_fn = lambda r: r.athlete_code
	for athlete_code, group in groupby(rows, key=key_fn):
		yield athlete_code, list(group)


def _recreate_tmp_dob_ranges(cursor) -> None:
	cursor.execute("DROP TABLE IF EXISTS tmp_dob_ranges")
	cursor.execute(
		"""
		CREATE TABLE tmp_dob_ranges (
			athlete_code TEXT NOT NULL,
			prev_date TEXT,
			formatted_date TEXT NOT NULL,
			prev_age INTEGER,
			prev_age_max INTEGER,
			age INTEGER,
			age_max INTEGER,
			earliest_possible_dob TEXT,
			latest_possible_dob TEXT,
			range_conflict INTEGER DEFAULT 0,
			PRIMARY KEY (athlete_code, formatted_date)
		)
		"""
	)


def _persist_dob_ranges(cursor, rows: Sequence[DobRangeRow]) -> None:
	cursor.executemany(
		"""
		INSERT OR REPLACE INTO tmp_dob_ranges (
			athlete_code,
			prev_date,
			formatted_date,
			prev_age,
			prev_age_max,
			age,
			age_max,
			earliest_possible_dob,
			latest_possible_dob,
			range_conflict
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		""",
		[
			(
				row.athlete_code,
				row.prev_date,
				row.formatted_date,
				row.prev_age,
				row.prev_age_max,
				row.age,
				row.age_max,
				row.earliest_possible_dob,
				row.latest_possible_dob,
				row.range_conflict,
			)
			for row in rows
		],
	)


def _find_conflicts(rows: Iterable[DobRangeRow]) -> List[DobRangeRow]:
	conflicts: List[DobRangeRow] = []
	for row in rows:
		if row.range_conflict:
			conflicts.append(row)
	return conflicts


def _rebuild_tmp_dob_summary(cursor) -> None:
	cursor.execute("DROP TABLE IF EXISTS tmp_dob_summary")
	cursor.execute(
		"""
		CREATE TABLE tmp_dob_summary AS
		WITH ranked AS (
		    SELECT athlete_code,
		           formatted_date,
		           earliest_possible_dob,
		           latest_possible_dob,
		           ROW_NUMBER() OVER (
		               PARTITION BY athlete_code
		               ORDER BY formatted_date DESC
		           ) AS rn
		    FROM tmp_dob_ranges
		)
		SELECT athlete_code,
		       formatted_date AS last_updated,
		       earliest_possible_dob,
		       latest_possible_dob
		FROM ranked
		WHERE rn = 1
		"""
	)


def refresh_tmp_dob_ranges(limit: Optional[int] = None, dry_run: bool = False,
						   show_conflicts: int = 0,
						   athlete_filter: Optional[str] = None,
						   store_without_conflict: bool = False,
		   max_conflict_athletes: int = DEFAULT_MAX_CONFLICT_ATHLETES,
		   rebuild_summary_only: bool = False,
		   start_ratios: bool = False,
		   skip_downstream: bool = False) -> dict:
	conn, cursor, render_conn, render_cursor = connections()
	with suppress(Exception):
		render_cursor.close()
	with suppress(Exception):
		render_conn.close()
	summary = {"processed": 0, "written": 0, "conflicts": 0}
	try:
		if rebuild_summary_only and start_ratios:
			raise ValueError("Cannot combine --summary-only with --start-ratios.")
		if rebuild_summary_only:
			if dry_run:
				return summary
			if not _table_exists(cursor, "tmp_dob_ranges"):
				raise RuntimeError("Cannot rebuild summary only because tmp_dob_ranges does not exist.")
			_rebuild_tmp_dob_summary(cursor)
			if skip_downstream:
				conn.commit()
				return summary
			_refresh_latest_club_chain(conn, cursor)
			_build_ratio_error_chain(conn)
			conn.commit()
			return summary
		if start_ratios:
			if dry_run:
				return summary
			if not _table_exists(cursor, "tmp_dob_ranges"):
				raise RuntimeError("Cannot start ratios because tmp_dob_ranges does not exist.")
			_build_ratio_error_chain(conn)
			conn.commit()
			return summary
		_ensure_wide_sources(conn)
		age_rows = _fetch_age_changes(cursor, athlete_filter=athlete_filter)
		if limit is not None:
			age_rows = age_rows[:limit]
		summary["processed"] = len(age_rows)
		stored_rows: List[DobRangeRow] = []
		conflict_athletes: List[str] = []
		for athlete_code, athlete_rows in _group_rows_by_athlete(age_rows):
			dob_rows = [_compute_bounds(row) for row in athlete_rows]
			adjusted = _apply_running_bounds(dob_rows)
			has_conflict = any(row.range_conflict for row in adjusted)
			should_store = has_conflict or store_without_conflict
			if should_store:
				stored_rows.extend(adjusted)
				if has_conflict:
					conflict_athletes.append(athlete_code)
					if max_conflict_athletes > 0 and len(conflict_athletes) >= max_conflict_athletes:
						break
		summary["conflicts"] = len(conflict_athletes)
		if show_conflicts and stored_rows:
			conflict_rows = [row for row in stored_rows if row.range_conflict]
			print(
				f"Found {len(conflict_rows)} conflicting rows across {len(conflict_athletes)} athletes "
				f"(showing first {min(show_conflicts, len(conflict_rows))})"
			)
			for row in conflict_rows[:show_conflicts]:
				print(
					f" - athlete {row.athlete_code} on {row.formatted_date}: "
					f"earliest={row.earliest_possible_dob}, latest={row.latest_possible_dob}"
				)
		if dry_run:
			summary["written"] = 0
			return summary
		if stored_rows:
			_recreate_tmp_dob_ranges(cursor)
			_persist_dob_ranges(cursor, stored_rows)
			summary["written"] = len(stored_rows)
		else:
			summary["written"] = 0
		if _table_exists(cursor, "tmp_dob_ranges"):
			_rebuild_tmp_dob_summary(cursor)
			if skip_downstream:
				conn.commit()
				return summary
			_refresh_latest_club_chain(conn, cursor)
			_build_ratio_error_chain(conn)
		conn.commit()
		return summary
	finally:
		conn.close()


def _parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Rebuild tmp_dob_ranges using the tmp_age_changes_wide source data."
	)
	parser.add_argument(
		"--limit",
		type=int,
		default=None,
		help="Process only the first N rows (useful for debugging).",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Calculate DOB ranges without writing tmp_dob_ranges.",
	)
	parser.add_argument(
		"--show-conflicts",
		type=int,
		default=0,
		help="Display the first N rows where earliest DOB exceeds latest DOB.",
	)
	parser.add_argument(
		"--athlete",
		type=str,
		default=None,
		help="Restrict processing to a single athlete_code.",
	)
	parser.add_argument(
		"--store-no-conflict",
		action="store_true",
		help="Persist results even when no conflicts are detected.",
	)
	parser.add_argument(
		"--max-conflict-athletes",
		type=int,
		default=DEFAULT_MAX_CONFLICT_ATHLETES,
		help="Limit number of conflict athletes persisted (0 = no limit).",
	)
	parser.add_argument(
		"--summary-only",
		action="store_true",
		help="Rebuild tmp_dob_summary and downstream age tables from existing tmp_dob_ranges data.",
	)
	parser.add_argument(
		"--start-ratios",
		action="store_true",
		help="Begin at tmp_*_err age-ratio tables (requires tmp_dob_ranges already built).",
	)
	parser.add_argument(
		"--skip-downstream",
		action="store_true",
		help="Stop after rebuilding tmp_dob_summary (no athlete/eventpositions updates).",
	)
	return parser.parse_args()


def main() -> None:
	args = _parse_args()
	summary = refresh_tmp_dob_ranges(
		limit=args.limit,
		dry_run=args.dry_run,
		show_conflicts=args.show_conflicts,
		athlete_filter=args.athlete,
		store_without_conflict=args.store_no_conflict,
		max_conflict_athletes=args.max_conflict_athletes,
		rebuild_summary_only=args.summary_only,
		start_ratios=args.start_ratios,
		skip_downstream=args.skip_downstream,
	)
	print(
		f"Processed {summary['processed']} rows; "
		f"conflicts={summary['conflicts']}; written={summary['written']}"
	)


if __name__ == "__main__":
	main()
