-- @section: tempTable
-- @tempTable:  tmp_eventpositions_bad
CREATE INDEX IF NOT EXISTS idx_athletes_code_dobs
ON athletes (athlete_code, min_dob, max_dob);
DROP TABLE IF EXISTS tmp_eventpositions_bad;
CREATE TABLE tmp_eventpositions_bad AS
    SELECT e.event_code, e.event_date,  e.time, e.athlete_code,e.time_ratio,age_grade,age_group,e.club,e.name,comment,
       substr(event_date, 7, 4) || '-' ||substr(event_date, 4, 2) || '-' ||substr(event_date, 1, 2) AS formatted_date,
       CASE
           WHEN INSTR(e.time, ':') = 0 THEN NULL
           WHEN LENGTH(e.time) - LENGTH(REPLACE(e.time, ':', '')) = 2 THEN
               CAST(substr(e.time, 1, instr(e.time, ':')-1) AS INTEGER) * 3600 +
               CAST(substr(e.time, instr(e.time, ':')+1, instr(substr(e.time, instr(e.time, ':')+1), ':')-1) AS INTEGER) * 60 +
               CAST(substr(e.time, length(e.time) - 1, 2) AS INTEGER)
           ELSE
               CAST(substr(e.time, 1, instr(e.time, ':')-1) AS INTEGER) * 60 +
               CAST(substr(e.time, instr(e.time, ':')+1) AS INTEGER)
       END AS time_seconds
	FROM eventpositions e
	JOIN athletes a
	  ON a.athlete_code = e.athlete_code
	 AND a.min_dob > a.max_dob;
-- @keys: event_code, formatted_date,athlete_code
-- @examples
	select * from eventpositions where athlete_code='1001117' order by substr(event_date, 7, 4) || '-' ||substr(event_date, 4, 2) || '-' ||substr(event_date, 1, 2) 
    select * from tmp_eventpositions_bad where athlete_code='1001117'
    where event_code=1;
	select * from athletes where athlete_code='1001117'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_ages_bad
DROP TABLE IF EXISTS tmp_athlete_ages_bad;
CREATE TABLE tmp_athlete_ages_bad AS
    SELECT epv.athlete_code, epv.formatted_date,ac.age,ac.age_max,epv.age_group,epv.age_grade,epv.time_seconds,ac.lower_bound,ac.upper_bound,
    ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
	FROM tmp_eventpositions_bad epv
    JOIN age_category ac
    ON epv.age_group = ac.age_group
    AND ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) BETWEEN ac.lower_bound AND ac.upper_bound;
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_athlete_ages_bad where athlete_code='1001117'
    ORDER BY athlete_code ;
-- @endsection
--------------------------
DROP TABLE IF EXISTS tmp_athlete_ages;
CREATE TABLE tmp_athlete_ages AS
SELECT *
FROM tmp_athlete_ages_bad;
--------------------------
DROP TABLE IF EXISTS tmp_eventpositions;
CREATE TABLE tmp_eventpositions AS
SELECT *
FROM tmp_eventpositions_bad;
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_age_changes
DROP TABLE IF EXISTS tmp_age_changes;
CREATE TABLE tmp_age_changes AS
    SELECT athlete_code,formatted_date,age,age_max,
        LAG(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age,
		LAG(age_max) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age_max,
        LAG(formatted_date) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_date
    FROM tmp_athlete_ages; 
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_age_changes where athlete_code='1001117'
    --where athlete_code='10002291'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_dob_ranges
DROP TABLE IF EXISTS tmp_dob_ranges;
CREATE TABLE tmp_dob_ranges AS
   WITH ranges AS (
        SELECT athlete_code,formatted_date,age,age_max,prev_age,prev_age_max, prev_date,
            DATE(formatted_date, '-' || (age_max + 1) || ' years', '+1 day') AS curr_min_dob,  -- youngest (latest) date
            DATE(formatted_date, '-' || age || ' years')                   AS curr_max_dob,  -- oldest (earliest) date
            CASE WHEN prev_age IS NOT NULL THEN DATE(prev_date, '-' || (prev_age_max + 1) || ' years', '+1 day') END AS prev_min_dob,
            CASE WHEN prev_age IS NOT NULL THEN DATE(prev_date, '-' || prev_age || ' years') END AS prev_max_dob
        FROM tmp_age_changes
    ),
    resolved AS (
        SELECT r.*,
            CASE                             -- lower bound = later of the two minima
                WHEN r.prev_min_dob IS NULL THEN r.curr_min_dob
                WHEN r.curr_min_dob IS NULL THEN r.prev_min_dob
                WHEN r.prev_min_dob > r.curr_min_dob THEN r.prev_min_dob
                ELSE r.curr_min_dob
            END AS min_dob,
            CASE                             -- upper bound = earlier of the two maxima
                WHEN r.prev_max_dob IS NULL THEN r.curr_max_dob
                WHEN r.curr_max_dob IS NULL THEN r.prev_max_dob
                WHEN r.prev_max_dob < r.curr_max_dob THEN r.prev_max_dob
                ELSE r.curr_max_dob
            END AS max_dob
        FROM ranges r
    )
	SELECT
        athlete_code,prev_date,formatted_date,prev_age,prev_age_max,age,age_max,
        min_dob as earliest_possible_dob,  -- latest possible birthdate (age_max driven)
        max_dob AS latest_possible_dob   -- earliest possible birthdate (age driven)
    FROM resolved
    ORDER BY athlete_code, formatted_date;;
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_dob_ranges where athlete_code='3839246'
    ORDER BY athlete_code ;
    --select * from athletes where athlete_code='10002291'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_dob_summary_base
DROP TABLE IF EXISTS tmp_dob_summary_base;
CREATE TABLE tmp_dob_summary_base AS
    SELECT athlete_code,
        MAX(earliest_possible_dob) AS earliest_possible_dob,  -- corresponds to min_dob (oldest possible)
        MIN(latest_possible_dob)   AS latest_possible_dob,   -- corresponds to max_dob (youngest possible)
        MAX(formatted_date) AS last_updated
    FROM tmp_dob_ranges
    GROUP BY athlete_code;
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_dob_summary_base where athlete_code='1001117'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable: tmp_dob_summary_fix
DROP TABLE IF EXISTS tmp_dob_summary_fix;
CREATE TABLE tmp_dob_summary_fix AS
	WITH RECURSIVE
	ordered AS (
		SELECT
			athlete_code,
			formatted_date,
			earliest_possible_dob,
			latest_possible_dob,
			ROW_NUMBER() OVER (
				PARTITION BY athlete_code
				ORDER BY formatted_date DESC
			) AS rn
		FROM tmp_dob_ranges
	),
	walk AS (
    SELECT
        o.athlete_code,
        o.rn,
        o.formatted_date,
        o.earliest_possible_dob AS current_min,
        o.latest_possible_dob   AS current_max,
        0 AS rejected
    FROM ordered o
    WHERE o.rn = 1

    UNION ALL

    SELECT
        o.athlete_code,
        o.rn,
        o.formatted_date,
        CASE
            WHEN date(CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                           THEN o.earliest_possible_dob ELSE w.current_min END)
               <= date(CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                           THEN o.latest_possible_dob ELSE w.current_max END)
            THEN CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                      THEN o.earliest_possible_dob ELSE w.current_min END
            ELSE w.current_min
        END AS current_min,
        CASE
            WHEN date(CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                           THEN o.earliest_possible_dob ELSE w.current_min END)
               <= date(CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                           THEN o.latest_possible_dob ELSE w.current_max END)
            THEN CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                      THEN o.latest_possible_dob ELSE w.current_max END
            ELSE w.current_max
        END AS current_max,
        CASE
            WHEN date(CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                           THEN o.earliest_possible_dob ELSE w.current_min END)
               <= date(CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                           THEN o.latest_possible_dob ELSE w.current_max END)
            THEN w.rejected
            ELSE 1
        END AS rejected
    FROM walk w
    JOIN ordered o
      ON o.athlete_code = w.athlete_code
     AND o.rn = w.rn + 1
	)
	SELECT
		athlete_code,
		MAX(current_min) AS corrected_min_dob,
		MIN(current_max) AS corrected_max_dob
	FROM walk
	WHERE rejected = 1
	GROUP BY athlete_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_dob_summary_fix;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_dob_summary
DROP TABLE IF EXISTS tmp_dob_summary;
CREATE TABLE tmp_dob_summary AS
    SELECT athlete_code,last_updated,
        COALESCE(corrected_min_dob,earliest_possible_dob) AS earliest_possible_dob,  -- corresponds to min_dob (oldest possible)
        COALESCE(corrected_max_dob,latest_possible_dob) AS latest_possible_dob   -- corresponds to max_dob (youngest possible)
    FROM tmp_dob_summary_base
    LEFT JOIN tmp_dob_summary_fix USING(athlete_code);
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_dob_summary where athlete_code='1001117'
    ORDER BY athlete_code;
	select * from tmp_dob_summary
	where earliest_possible_dob>latest_possible_dob
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_latest_club
DROP TABLE IF EXISTS tmp_latest_club;
CREATE TABLE tmp_latest_club AS
    WITH ranked AS (
    SELECT fe.athlete_code, fe.club,le.last_updated,fe.name,le.earliest_possible_dob ,le.latest_possible_dob,
        substr(trim(fe.age_group),2,1) AS sex,
        ROW_NUMBER() OVER (
        PARTITION BY fe.athlete_code, fe.formatted_date
        ORDER BY fe.time_seconds ASC  -- pick earliest time; change to DESC to pick latest
        ) AS rn
    FROM tmp_eventpositions fe
    JOIN  tmp_dob_summary le
        ON fe.athlete_code = le.athlete_code
    AND fe.formatted_date = le.last_updated)
    SELECT *
    FROM ranked
    WHERE rn = 1; 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_latest_club
    where athlete_code='1221441'
	where earliest_possible_dob>latest_possible_dob
    ORDER BY athlete_code;
	select * from athletes where athlete_code='1221441'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_final_age_updates
	-- 1) existing athletes that have updates
DROP TABLE IF EXISTS tmp_final_age_updates;
CREATE TABLE tmp_final_age_updates AS
	SELECT
	  a.athlete_code,
      COALESCE(ds.name,a.name) as name,
	  CASE
		WHEN ds.earliest_possible_dob IS NULL THEN a.min_dob
		WHEN a.min_dob IS NULL THEN ds.earliest_possible_dob
		WHEN date(a.min_dob)>date(a.max_dob) AND date(ds.earliest_possible_dob)<=date(ds.latest_possible_dob)  THEN ds.earliest_possible_dob
		WHEN date(ds.earliest_possible_dob) > date(a.min_dob) THEN ds.earliest_possible_dob
		ELSE a.min_dob
	  END AS min_dob,
	  CASE
		WHEN ds.latest_possible_dob IS NULL THEN a.max_dob
		WHEN a.max_dob IS NULL THEN ds.latest_possible_dob
		WHEN date(a.min_dob)>date(a.max_dob) AND date(ds.earliest_possible_dob)<=date(ds.latest_possible_dob)  THEN ds.latest_possible_dob
		WHEN date(ds.latest_possible_dob) < date(a.max_dob) THEN ds.latest_possible_dob
		ELSE a.max_dob
	  END AS max_dob,
	  COALESCE(ds.last_updated, a.last_updated) AS last_updated,
	  COALESCE(ds.club, a.club) AS club,
      COALESCE(ds.sex, a.sex) AS sex
	FROM athletes a 
	LEFT JOIN tmp_latest_club ds ON ds.athlete_code = a.athlete_code
	--WHERE a.athlete_code IN (SELECT athlete_code FROM tmp_latest_club)
	--
	UNION ALL
	-- 2) new athletes present in tmp_athlete_updates but not yet in athletes
	SELECT
	  ta.athlete_code,ta.name,earliest_possible_dob AS final_min_dob,latest_possible_dob AS max_dob,
	  ta.last_updated AS last_updated,ta.club AS club,
      ta.sex AS sex
	FROM tmp_latest_club ta
	WHERE ta.athlete_code NOT IN (SELECT athlete_code FROM athletes); 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_final_age_updates --where athlete_code='528017'
	where min_dob>max_dob
    ORDER BY athlete_code;
	select * from athletes where athlete_code='1001117'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_coalesce_age_fields
	DROP TABLE IF EXISTS tmp_coalesce_age_fields;
	CREATE TABLE tmp_coalesce_age_fields AS
	-- 1) existing athletes that have updates
	SELECT fu.athlete_code,fu.name,fu.min_dob,fu.max_dob,fu.last_updated,fu.club,fu.sex,
	  CASE
		WHEN fu.min_dob IS NULL AND fu.max_dob IS NULL THEN NULL
		WHEN fu.min_dob IS NULL THEN ROUND((julianday(date(fu.last_updated)) - julianday(fu.max_dob)) / 365.2425, 2)
		WHEN fu.max_dob IS NULL THEN ROUND((julianday(date(fu.last_updated)) - julianday(fu.min_dob)) / 365.2425, 2)
		ELSE ROUND(((julianday(date(fu.last_updated)) - julianday(fu.max_dob))
			   + (julianday(date(fu.last_updated)) - julianday(fu.min_dob))) / (2.0 * 365.2425), 2)
	  END AS last_age_estimate,
	  CASE
		WHEN fu.min_dob IS NULL AND fu.max_dob IS NULL THEN NULL
		WHEN fu.min_dob IS NULL THEN ROUND((julianday('now') - julianday(fu.max_dob)) / 365.2425, 2)
		WHEN fu.max_dob IS NULL THEN ROUND((julianday('now') - julianday(fu.min_dob)) / 365.2425, 2)
		ELSE ROUND(((julianday('now') - julianday(fu.max_dob)) + (julianday('now') - julianday(fu.min_dob))) / (2.0 * 365.2425), 2)
	 END AS current_age_estimate
    FROM tmp_final_age_updates fu
	LEFT JOIN  athletes a ON fu.athlete_code = a.athlete_code    
    where (a.last_updated IS NULL) OR (fu.last_updated >= a.last_updated);;-- added to stop updating athlete already updated.
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_coalesce_age_fields  --where athlete_code='11389772'
	where min_dob>max_dob
	order by athlete_code
	SELECT * FROM athletes  --where athlete_code='11389772'
	where min_dob>max_dob
	order by athlete_code
-- @endsection
--------------------------