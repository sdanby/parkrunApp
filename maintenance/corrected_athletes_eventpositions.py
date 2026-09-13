from __future__ import annotations

import argparse
from datetime import datetime
from typing import Iterable, List, Tuple

from etl.analytics import copy_table_to_postgres
from scripts.database_helpers import connections, get_temp_table_sql


AGE_RATIO_SECTIONS = [
	"tmp_ageRatio_inputs",
	"tmp_ageRatio_calc",
	"tmp_ageRatio_fract",
	"tmp_ageRatio_clamped",
	"tmp_ageRatio_expanded",
	"tmp_ageRatio_final",
]


def _build_corrections_table(sqlite_conn, params) -> List[Tuple[str, str, str]]:
	"""Create tmp_athlete_dob_corrections and return the rows."""

	get_temp_table_sql(
		"tmp_athlete_dob_corrections",
		execute_conn=sqlite_conn,
		params=params,
		write_file=True,
		silent=True,
	)

	rows = sqlite_conn.execute(
		"SELECT athlete_code, corrected_min_dob, corrected_max_dob FROM tmp_athlete_dob_corrections"
	).fetchall()
	return rows


def _create_tmp_eventpositions(sqlite_conn) -> List[Tuple[int, str, str]]:
	"""Populate tmp_eventpositions_end with every race for the corrected athletes."""

	sqlite_conn.execute("DROP TABLE IF EXISTS tmp_eventpositions_end;")
	sqlite_conn.execute(
		"""
		CREATE TEMP TABLE tmp_eventpositions_end AS
		SELECT
			e.event_code,
			e.event_date,
			e.formatted_date,
			e.time,
			e.time_seconds,
			e.athlete_code,
			e.position,
			e.formatted_date AS end_date,
			e.comment,
			e.name,
			e.club
		FROM eventpositions_view e
		WHERE e.athlete_code IN (SELECT athlete_code FROM tmp_athlete_dob_corrections);
		"""
	)
	sqlite_conn.execute(
		"CREATE INDEX IF NOT EXISTS idx_tmp_eventpositions_end_ac ON tmp_eventpositions_end(athlete_code);"
	)

	event_ranges = sqlite_conn.execute(
		"""
		SELECT event_code, MIN(formatted_date) AS start_iso, MAX(formatted_date) AS end_iso
		FROM tmp_eventpositions_end
		GROUP BY event_code;
		"""
	).fetchall()
	return event_ranges


def _run_age_ratio_pipeline(sqlite_conn, params) -> None:
	for section in AGE_RATIO_SECTIONS:
		get_temp_table_sql(
			section,
			execute_conn=sqlite_conn,
			params=params,
			write_file=True,
			silent=True,
		)


def _build_corrected_age_estimates(sqlite_conn) -> None:
	sqlite_conn.execute("DROP TABLE IF EXISTS tmp_corrected_age_estimates;")
	sqlite_conn.execute(
		"""
		CREATE TEMP TABLE tmp_corrected_age_estimates AS
		WITH event_rows AS (
			SELECT
				ee.event_code,
				ee.event_date,
				ee.formatted_date,
				ee.athlete_code,
				corr.corrected_min_dob,
				corr.corrected_max_dob,
				COALESCE(ee.formatted_date, ee.event_date) AS event_iso
			FROM tmp_eventpositions_end ee
			JOIN tmp_athlete_dob_corrections corr USING (athlete_code)
		)
		SELECT
			event_code,
			event_date,
			formatted_date,
			athlete_code,
			corrected_min_dob,
			corrected_max_dob,
			CASE
				WHEN corrected_min_dob IS NULL AND corrected_max_dob IS NULL THEN NULL
				WHEN corrected_min_dob IS NULL THEN ROUND((julianday(event_iso) - julianday(corrected_max_dob)) / 365.2425, 2)
				WHEN corrected_max_dob IS NULL THEN ROUND((julianday(event_iso) - julianday(corrected_min_dob)) / 365.2425, 2)
				ELSE ROUND(((julianday(event_iso) - julianday(corrected_max_dob)) + (julianday(event_iso) - julianday(corrected_min_dob))) / (2.0 * 365.2425), 2)
			END AS new_current_age_estimate
		FROM event_rows;
		""",
	)


def _preview_changes(sqlite_conn, limit: int = 25) -> List[Tuple]:
	preview_rows = sqlite_conn.execute(
		"""
		SELECT e.event_code,
		       tee.formatted_date,
			   e.position,
			   e.athlete_code,
			   e.age_ratio_male AS old_male,
			   af.male_age_ratio_new AS new_male,
			   e.age_ratio_sex AS old_sex,
			   af.sex_age_ratio_new AS new_sex,
			   e.current_age_estimate AS old_age_est,
		       cae.new_current_age_estimate AS new_age_est
		FROM eventpositions e
		JOIN tmp_eventpositions_end tee
			ON tee.event_code = e.event_code
			AND tee.event_date = e.event_date
			AND tee.athlete_code = e.athlete_code
		JOIN tmp_athlete_dob_corrections corr USING (athlete_code)
		JOIN tmp_ageRatio_final af USING (athlete_code)
		LEFT JOIN tmp_corrected_age_estimates cae
			ON cae.event_code = e.event_code
			AND cae.event_date = e.event_date
			AND cae.athlete_code = e.athlete_code
		ORDER BY e.event_code, tee.formatted_date, e.position
		LIMIT ?;
		""",
		(limit,),
	).fetchall()
	return preview_rows


def _update_eventpositions(sqlite_conn) -> int:
	result = sqlite_conn.execute(
		"""
		UPDATE eventpositions
		SET age_ratio_male = COALESCE(
				(SELECT male_age_ratio_new FROM tmp_ageRatio_final af WHERE af.athlete_code = eventpositions.athlete_code),
				age_ratio_male
			),
			age_ratio_sex = COALESCE(
				(SELECT sex_age_ratio_new FROM tmp_ageRatio_final af WHERE af.athlete_code = eventpositions.athlete_code),
				age_ratio_sex
			),
			current_age_estimate = COALESCE(
				(
					SELECT new_current_age_estimate
					FROM tmp_corrected_age_estimates cae
					WHERE cae.athlete_code = eventpositions.athlete_code
					  AND cae.event_code = eventpositions.event_code
					  AND cae.event_date = eventpositions.event_date
				),
				current_age_estimate
			)
		WHERE athlete_code IN (SELECT athlete_code FROM tmp_athlete_dob_corrections);
		"""
	)
	return result.rowcount if hasattr(result, "rowcount") else 0


def _push_to_postgres(event_ranges: Iterable[Tuple[int, str, str]]) -> None:
	for event_code, start_iso, end_iso in event_ranges:
		try:
			copy_table_to_postgres(
				table_name="eventpositions",
				key_columns=["event_code", "event_date", "athlete_code"],
				fields=["age_ratio_male", "age_ratio_sex", "current_age_estimate"],
				start_date=start_iso,
				end_date=end_iso,
				date_column="formatted_date",
				date_is_iso=True,
				updateOnly=True,
				event_code=event_code,
			)
			print(f"Pushed event_code {event_code} ({start_iso}..{end_iso}) to Postgres")
		except Exception as exc:  # pragma: no cover - best effort logging
			print(f"Failed to push event_code {event_code}: {exc}")


def run(reference_date: str, apply_updates: bool, push_postgres: bool, preview_limit: int) -> None:
	sqlite_conn, sqlite_cursor, render_conn, render_cursor = connections()
	try:
		render_cursor.close()
		render_conn.close()
	except Exception:
		pass

	try:
		params = {"formatted_date": reference_date}
		corrections = _build_corrections_table(sqlite_conn, params)
		if not corrections:
			print("No rows in tmp_athlete_dob_corrections; nothing to do.")
			return

		print(f"Loaded {len(corrections)} correction candidates.")

		event_ranges = _create_tmp_eventpositions(sqlite_conn)
		if not event_ranges:
			print("No eventpositions rows found for corrected athletes.")
			return

		_run_age_ratio_pipeline(sqlite_conn, params)
		_build_corrected_age_estimates(sqlite_conn)

		preview_rows = _preview_changes(sqlite_conn, limit=preview_limit)
		if not preview_rows:
			print("No eventpositions records require updates.")
			return

		print("Preview of pending updates (event_code, formatted_date, position, athlete_code, old/new ratios & ages):")
		for row in preview_rows:
			print(row)

		if not apply_updates:
			print("apply_updates flag not set; skipping database update.")
			return

		updated = _update_eventpositions(sqlite_conn)
		sqlite_conn.commit()
		print(f"Updated {updated} eventpositions rows.")

		if push_postgres:
			_push_to_postgres(event_ranges)
	finally:
		try:
			sqlite_cursor.close()
		except Exception:
			pass
		try:
			sqlite_conn.close()
		except Exception:
			pass


def _parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Rebuild eventpositions age ratios for corrected athletes")
	parser.add_argument(
		"--reference-date",
		dest="reference_date",
		default=datetime.utcnow().date().isoformat(),
		help="ISO date used when estimating ages (defaults to today)",
	)
	parser.add_argument(
		"--apply",
		action="store_true",
		help="Apply the computed updates to the eventpositions table",
	)
	parser.add_argument(
		"--push-postgres",
		action="store_true",
		help="After updating SQLite, copy the affected rows to Postgres",
	)
	parser.add_argument(
		"--preview-limit",
		type=int,
		default=25,
		help="Number of rows to display before applying updates",
	)
	return parser.parse_args()


def main() -> None:
	args = _parse_args()
	run(
		reference_date=args.reference_date,
		apply_updates=args.apply,
		push_postgres=args.push_postgres,
		preview_limit=args.preview_limit,
	)


if __name__ == "__main__":
	main()
