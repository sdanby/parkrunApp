-------------------------------------------------------------------
-- @section: simpleSQL
-- @sectionname: latest_event_positions
    select e.formatted_date,max(last_position),count(*) 
    from eventpositions_view e
    join parkrun_events p ON p.event_code=e.event_code AND p.event_date=e.event_date
    where adj_time_ratio IS NULL
    group by e.formatted_date
-- @endsection
-------------------------------------------------------------------
-- @section: simpleSQL
-- @sectionname: event_name_number
	select event_number,event_name 
	 from parkrun_events p 
	 join events e ON p.event_code=e.event_code 
	where p.event_code=:event_code and event_date=:event_date
-- @endsection
-------------------------------------------------------------------
-- @section: simpleSQL
-- @sectionname: rebuild_all_event_positions
    SELECT DISTINCT formatted_date
    FROM parkrun_events_view e
    WHERE formatted_date >= :formatted_date
    AND (:end_date IS NULL OR formatted_date <= :end_date)
    ORDER BY formatted_date;
-- @endsection
-------------------------------------------------------------------
-- @section: simpleSQL
-- @sectionname: get_eventpositions
    select *
    from eventpositions ep
    join events e on e.event_code = ep.event_code
    where ep.event_code=:event_code AND event_date=:event_date
-- @endsection
-------------------------------------------------------------------
-- @section: simpleSQL
-- @sectionname: update_clear_coeffs
	update parkrun_events
		SET coeff=NULL,obs=NULL
-- @endsection
-------------------------------------------------------------------
-- @section: tempTable
-- @tempTable: tmp_selected_eventRange
  -- If :period > 100 we treat this as "full history" and use the event_number = 1 start
  -- otherwise use the windowed join based on :period. Parameter substitution will
  -- replace :period with a literal before execution.
  SELECT * FROM (
    -- windowed version (used when :period <= 100)
    SELECT 
      pe1.formatted_date AS end_date,
      pe2.formatted_date AS start_date,
      pe1.event_code,
      pe1.event_number AS end_number,
      1.2 AS max_ratio
    FROM parkrun_events_view pe1
    JOIN parkrun_events_view pe2  
      ON pe1.event_code = pe2.event_code
     AND pe2.event_number = max(1, pe1.event_number - :period)
   WHERE pe1.formatted_date = :formatted_date
     AND :period <= 100
    UNION ALL
    -- full-history version (used when :period > 100)
    SELECT
      pe1.formatted_date AS end_date,
      (SELECT pe2.formatted_date
         FROM parkrun_events_view pe2
        WHERE pe2.event_code = pe1.event_code
          AND pe2.event_number = 1
        LIMIT 1) AS start_date,
      pe1.event_code,
      pe1.event_number AS end_number,
      1.2 AS max_ratio
    FROM parkrun_events_view pe1
    WHERE pe1.formatted_date = (
      SELECT MAX(x.formatted_date)
      FROM parkrun_events_view x
      WHERE x.event_code = pe1.event_code
    )
    AND :period > 100
  ) AS selected_range;
-- @keys: event_code
-- @examples
  select * from tmp_selected_eventRange;
-- @endsection
-------------------------------------------------------------------
-- @section: tempTable
-- @tempTable: tmp_endDate
  SELECT max(end_date) as end_date
  from tmp_selected_eventRange;
-- @examples
  select end_date from tmp_endDate
-- @endsection
-------------------------------------------------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_end
    SELECT e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code ,e.position,s.end_date,
         e.comment,e.name,e.club
    FROM eventpositions_view e
    JOIN tmp_selected_eventRange s
    WHERE e.formatted_date = s.end_date 
    AND e.event_code = s.event_code;
-- @keys: event_code, athlete_code
-- @examples
    select * from tmp_eventpositions_end;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions
    SELECT e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code,e.time_ratio,age_grade,age_group,club,end_date,max_ratio,name,comment
    FROM eventpositions_view e
    JOIN tmp_selected_eventRange s
    WHERE e.formatted_date BETWEEN s.start_date AND s.end_date  
    AND e.event_code = s.event_code;
-- @keys: event_code, formatted_date,athlete_code
-- @examples
    select * from tmp_eventpositions --where athlete_code='10031010'
    where event_code=1;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_bad
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
    select * from tmp_eventpositions_bad where athlete_code='1001117'
    where event_code=1;
	select * from athletes where athlete_code='1001117'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_regulars
	select event_code,athlete_code,end_date,
        count(*) as appearances,
        max(formatted_date) as last_date
	from tmp_eventpositions e
	group by event_code,athlete_code
	having appearances >10 and last_date=end_date;
-- @keys: event_code, athlete_code
-- @examples
    select * from tmp_regulars --where athlete_code='10031010'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_parkrun_events
    SELECT p.event_code, p.formatted_date,p.event_code,p.event_number,p.coeff,p.coeff_event, p.last_position,end_date
    FROM parkrun_events_view p
    JOIN tmp_selected_eventRange s
    WHERE p.formatted_date BETWEEN s.start_date AND s.end_date 
    AND p.event_code = s.event_code;
-- @keys: event_code, formatted_date
-- @examples
    select * from tmp_parkrun_events
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athletesInEventRange
    SELECT
        ep.event_code, ep.event_date, ep.time, ep.time_seconds, ep.athlete_code,ep.max_ratio,comment,
        p.event_number, ep.formatted_date,p.last_position, p.end_date,
        ep.time_ratio,p.coeff,p.coeff_event,
        ep.time_seconds / p.coeff  AS adj_time_seconds,
        ep.time_seconds / p.coeff / p.coeff_event AS adj2_time_seconds,
        COUNT(*) OVER (PARTITION BY ep.athlete_code, ep.event_code) AS last_event_code_count,
        COUNT(*) OVER (PARTITION BY ep.athlete_code) AS total_runs
    FROM tmp_eventpositions ep
    JOIN tmp_parkrun_events p
    ON ep.event_code = p.event_code
    AND ep.formatted_date = p.formatted_date;
-- @keys: event_code, formatted_date,athlete_code
-- @examples
    select * from tmp_athletesInEventRange order by formatted_date,time_seconds
    --where athlete_code='2971910';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_ages
    SELECT epv.athlete_code, epv.formatted_date,ac.age,ac.age_max,epv.age_group,epv.age_grade,epv.time_seconds,ac.lower_bound,ac.upper_bound,
    ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
    FROM tmp_eventpositions epv
    JOIN age_category ac
    ON epv.age_group = ac.age_group
    AND ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) BETWEEN ac.lower_bound AND ac.upper_bound;
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_athlete_ages
    ORDER BY athlete_code ;
    select * from tmp_athlete_ages t
    left join athletes a ON a.athlete_code=t.athlete_code
    ORDER BY athlete_code; 
    select * from tmp_athlete_ages where athlete_code='10001037';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_ages_wide
    SELECT epv.athlete_code, epv.formatted_date,ac.age,ac.age_max,epv.age_group,epv.age_grade,epv.time_seconds,ac.lower_bound,ac.upper_bound,
    ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
    --FROM tmp_eventpositions epv
	FROM eventpositions_view epv
    JOIN age_category ac
    ON epv.age_group = ac.age_group
    AND ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) BETWEEN ac.lower_bound AND ac.upper_bound;
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_athlete_ages_wide
    ORDER BY athlete_code ;
    select * from tmp_athlete_ages_wide t
    left join athletes a ON a.athlete_code=t.athlete_code
    ORDER BY athlete_code; 
    select * from tmp_athlete_ages_wide where athlete_code='10001037';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_ages_bad
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
-- @section: tempTable
-- @tempTable:  tmp_age_changes
    SELECT athlete_code,formatted_date,age,age_max,
        LAG(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age,
		LAG(age_max) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age_max,
        LAG(formatted_date) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_date
    FROM tmp_athlete_ages; 
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_age_changes
    --where athlete_code='10002291'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_age_changes_wide
    SELECT athlete_code,formatted_date,age,age_max,
        LAG(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age,
		LAG(age_max) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age_max,
        LAG(formatted_date) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_date
    FROM tmp_athlete_ages_wide; 
-- @keys: athlete_code,formatted_date
-- @examples
    SELECT * FROM tmp_age_changes_wide
    --where athlete_code='10002291'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_dob_ranges
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
    SELECT * FROM tmp_dob_ranges -- where athlete_code='10002291'
    ORDER BY athlete_code ;
    --select * from athletes where athlete_code='10002291'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_dob_summary_base
    SELECT athlete_code,
        MAX(earliest_possible_dob) AS earliest_possible_dob,  -- corresponds to min_dob (oldest possible)
        MIN(latest_possible_dob)   AS latest_possible_dob,   -- corresponds to max_dob (youngest possible)
        MAX(formatted_date) AS last_updated
    FROM tmp_dob_ranges
    GROUP BY athlete_code;
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_dob_summary_base --where athlete_code='10002291'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable: tmp_dob_summary_fix
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
    SELECT athlete_code,last_updated,
        COALESCE(corrected_min_dob,earliest_possible_dob) AS earliest_possible_dob,  -- corresponds to min_dob (oldest possible)
        COALESCE(corrected_max_dob,latest_possible_dob) AS latest_possible_dob   -- corresponds to max_dob (youngest possible)
    FROM tmp_dob_summary_base
    LEFT JOIN tmp_dob_summary_fix USING(athlete_code);
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_dob_summary --where athlete_code='10002291'
    ORDER BY athlete_code;
    select * from tmp_dob_summary
	where earliest_possible_dob>latest_possible_dob
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_latest_club
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
    --where athlete_code='528017'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_latest_club_wide
   WITH ranked AS (
    SELECT fe.athlete_code, fe.club,le.last_updated,fe.name,le.earliest_possible_dob ,le.latest_possible_dob,
        substr(trim(fe.age_group),2,1) AS sex,
        ROW_NUMBER() OVER (
        PARTITION BY fe.athlete_code, fe.formatted_date
        ORDER BY fe.formatted_date DESC  
        ) AS rn
    FROM eventpositions_view fe
    JOIN  tmp_dob_summary le
        ON fe.athlete_code = le.athlete_code
    AND fe.formatted_date = le.last_updated)
    SELECT *
    FROM ranked
    WHERE rn = 1; 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_latest_club_wide
    --where athlete_code='528017'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_final_age_updates_mini
	-- 1) existing athletes that have updates
    -- not used
	-- 2) new athletes present in tmp_athlete_updates but not yet in athletes
	SELECT
	  ta.athlete_code,ta.name,earliest_possible_dob AS final_min_dob,latest_possible_dob AS final_max_dob,
	  ta.last_updated AS final_last_updated,ta.club AS final_club,
      ta.sex AS final_sex
	FROM tmp_latest_club ta;
	--WHERE ta.athlete_code NOT IN (SELECT athlete_code FROM athletes); 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_final_age_updates_mini --where athlete_code='528017'
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_final_age_updates
	-- 1) existing athletes that have updates
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
    ORDER BY athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_coalesce_age_fields
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
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_extended_age_fields
 -- 1) existing athletes (use tc values when present, fallback to a.*)
    WITH combined AS (
        SELECT
            fu.athlete_code,fu.final_name,
            COALESCE( tc.new_min_dob, a.min_dob, fu.final_min_dob) AS min_dob,
            COALESCE( tc.new_max_dob, a.max_dob, fu.final_max_dob) AS max_dob,
            COALESCE( tc.new_last_updated, a.last_updated, fu.final_last_updated) AS last_updated,
            COALESCE(tc.new_club,a.club, fu.final_club) AS club,
            COALESCE( tc.new_last_age_estimate, a.last_age_estimate) AS last_age_estimate,
            COALESCE( tc.new_sex, a.sex, fu.final_sex) AS sex
        FROM tmp_final_age_updates fu
        LEFT JOIN athletes a ON a.athlete_code = fu.athlete_code
        LEFT JOIN tmp_coalesce_age_fields tc ON tc.athlete_code = fu.athlete_code
    ),
    ages AS (
        SELECT
            c.*,
            CASE
                WHEN c.min_dob IS NULL AND c.max_dob IS NULL THEN NULL
                WHEN c.min_dob IS NULL THEN (julianday('now') - julianday(c.max_dob)) / 365.2425
                WHEN c.max_dob IS NULL THEN (julianday('now') - julianday(c.min_dob)) / 365.2425
                ELSE (
                    (julianday('now') - julianday(c.max_dob)) +
                    (julianday('now') - julianday(c.min_dob))
                ) / (2.0 * 365.2425)
            END AS dob_age_years
        FROM combined c
    )
    SELECT
        athlete_code,name,min_dob,max_dob,last_updated,club,last_age_estimate,sex,
        CASE
            WHEN dob_age_years IS NULL AND last_age_estimate IS NULL THEN NULL
            WHEN dob_age_years IS NULL THEN ROUND(last_age_estimate, 2)
            WHEN last_age_estimate IS NULL THEN ROUND(dob_age_years, 2)
            WHEN dob_age_years < last_age_estimate THEN ROUND(last_age_estimate, 2)
            ELSE ROUND(dob_age_years, 2)
        END AS new_current_age_estimate
    FROM ages
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_extended_age_fields where athlete_code='11821995' 
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_update
    WITH base AS (
    SELECT
        a.athlete_code,
        COALESCE(fu.name,a.name) AS new_name,
        COALESCE(fu.club,a.club) AS new_club,
        COALESCE(fu.sex, a.sex)      AS new_sex,
        COALESCE(fu.min_dob, a.min_dob)      AS new_min_dob,
        COALESCE(fu.max_dob, a.max_dob)      AS new_max_dob,
        COALESCE(fu.last_age_estimate,a.last_age_estimate) AS new_last_age_estimate,
        COALESCE(fu.last_updated, a.last_updated) AS new_last_updated   
    FROM athletes a
    LEFT JOIN tmp_extended_age_fields fu USING(athlete_code)
    )
    SELECT
        athlete_code,new_name,new_min_dob,new_max_dob,new_last_updated,name,new_club,new_sex,new_last_age_estimate,
        ROUND( CASE
        WHEN new_min_dob IS NULL AND new_max_dob IS NULL THEN NULL
        WHEN new_min_dob IS NULL THEN (julianday('now') - julianday(new_max_dob)) / 365.2425
        WHEN new_max_dob IS NULL THEN (julianday('now') - julianday(new_max_dob)) / 365.2425
        ELSE ((julianday('now') - julianday(new_max_dob)) + (julianday('now') - julianday(new_min_dob))) / (2.0 * 365.2425)
        END,2) AS new_current_age_estimate
    FROM base;
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_athlete_update --where athlete_code='11389772' 
-- @endsection
--------------------------
-- @section: updateTable
-- @tempTable:  tmp_coalesce_age_fields
-- @updateTable: athletes
-- @fieldsToUpdate: current_age_estimate,min_dob,max_dob,name,last_updated,club,sex,last_age_estimate,current_age_estimate
-- @keys: athlete_code
-- @example
    SELECT * FROM athletes WHERE athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_active_athlete_update
    select a.athlete_code,
        a.new_name as name,
        a.new_min_dob as min_dob,
        a.new_max_dob as max_dob,
        a.new_last_updated as last_updated,
        a.new_club as club,
        a.new_sex as sex,
        a.new_last_age_estimate as last_age_estimate,
        a.new_current_age_estimate as current_age_estimate
    from tmp_athlete_update a
    join tmp_coalesce_age_fields c using(athlete_code);
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_active_athlete_update --where athlete_code='11389772' 
-- @endsection
--------------------------
-- @section: updateTable
-- @tempTable:  tmp_active_athlete_update
-- @updateTable: athletes
-- @fieldsToUpdate: min_dob, max_dob, last_updated, club, last_age_estimate,current_age_estimate, sex
-- @keys: athlete_code
-- @example
    SELECT * FROM athletes WHERE athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_new_athletes
        --SELECT t.*
        --FROM tmp_active_athlete_update t
        --LEFT JOIN athletes a
        --ON a.athlete_code = t.athlete_code
        --WHERE a.athlete_code IS NULL;
        select athlete_code,name,
        min_dob,max_dob,last_updated,club,sex, last_age_estimate,current_age_estimate 
        --from tmp_extended_age_fields
        from tmp_coalesce_age_fields
        where athlete_code NOT IN (select athlete_code from athletes);
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_new_athletes --where athlete_code='11389772' 
-- @endsection
--------------------------
-- @section: insertTable
-- @tempTable:  tmp_new_athletes
-- @updateTable: athletes
-- @fieldsToInsert: name,min_dob, max_dob, last_updated, club, last_age_estimate,current_age_estimate, sex
-- @example
    SELECT * FROM athletes WHERE athlete_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_age
    select t.event_code,t.event_date,t.athlete_code,last_age_estimate
    from tmp_eventpositions_end t
    join athletes a using (athlete_code)
    left join tmp_ageRatio_final using (athlete_code);
-- @keys: event_code,athlete_code
-- @examples
    SELECT * FROM tmp_eventpositions_age --where athlete_code='11389772' 
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athletesRangeStat
    SELECT athlete_code,max_ratio,--time_ratio,coeff,coeff_event,adj_time_seconds,adj2_time_seconds,
        COUNT(*) AS total_runs,
        COUNT(DISTINCT event_code) AS event_code_distinct_count,
        time_seconds,
        MIN(time_seconds) AS min_time_seconds,
        MIN(adj_time_seconds) AS adj_min_time_seconds,
        MIN(adj2_time_seconds) AS min_adj2
    FROM  tmp_athletesInEventRange ek
    GROUP BY athlete_code;
-- @keys: athlete_code
-- @examples
    
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athletesInEventRangeStat
    SELECT ek.athlete_code,ek.event_code,ek.end_date,ek.max_ratio,max(ek.formatted_date) as formatted_date,
        max(ek.event_date) as event_date    ,comment,
        MIN(ek.time_seconds) AS min_time_seconds,
        COUNT(*) AS event_eligible_appearances
    FROM  tmp_eventpositions ek
    GROUP BY ek.athlete_code,ek.event_code
    HAVING COUNT(*) > 1;
-- @keys: athlete_code,event_code,formatted_date
-- @examples
    select * from tmp_athletesInEventRangeStat where athlete_code='528017' order by event_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_max_code_count
    SELECT athlete_code, MAX(last_event_code_count) AS max_last_event_count
    FROM tmp_athletesInEventRange
    WHERE athlete_code IN ( SELECT DISTINCT athlete_code FROM tmp_athletesInEventRange WHERE end_date = formatted_date)
    GROUP BY athlete_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_max_code_count where athlete_code='528017';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eligible_appearances
    SELECT
        a.event_code,a.formatted_date,a.athlete_code,a.time_seconds,am.min_time_seconds,am.event_eligible_appearances,a.end_date,am.max_ratio,
        ROUND(CAST(a.time_seconds AS REAL) / am.min_time_seconds, 6) AS local_time_ratio
    FROM tmp_athletesInEventRange a
    JOIN tmp_athletesInEventRangeStat am --USING (athlete_code)
    ON a.athlete_code = am.athlete_code
       AND a.event_code = am.event_code
    WHERE am.min_time_seconds > 0
        AND a.time_seconds IS NOT NULL 
        AND ROUND(CAST(a.time_seconds AS REAL) / am.min_time_seconds, 6) <= am.max_ratio;
-- @keys: event_code, formatted_date,athlete_code
-- @examples
    select * from tmp_eligible_appearances where athlete_code='528017' order by event_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ranked
	  SELECT *,
		  ROW_NUMBER() OVER (PARTITION BY formatted_date,event_code ORDER BY local_time_ratio) AS rn,
		  COUNT(*) OVER (PARTITION BY formatted_date,event_code) AS cnt
	  FROM tmp_eligible_appearances
	  --WHERE local_time_ratio <= max_ratio
	    --AND eligible_appearances>1
	  order by event_code,formatted_date;
-- @keys: event_code, formatted_date,athlete_code
-- @examples
    select * from tmp_ranked -- where athlete_code='527018'
	order by event_code,formatted_date,rn;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_quartile
  SELECT r1.formatted_date,r1.event_code,  
	 (SELECT 
		CASE -- Q1 (25th percentile)
		  WHEN ((r1.cnt - 1) * 0.25) % 1 = 0 THEN
			(SELECT local_time_ratio
			 FROM tmp_ranked
			 WHERE formatted_date = r1.formatted_date
			   AND event_code = r1.event_code
			   AND rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 1)
		  ELSE
			(SELECT r_low.local_time_ratio + (((r1.cnt - 1) * 0.25 - CAST((r1.cnt - 1) * 0.25 AS INTEGER))
					 * (r_high.local_time_ratio - r_low.local_time_ratio))
			 FROM tmp_ranked r_low
			 JOIN tmp_ranked r_high
			   ON r_low.formatted_date = r_high.formatted_date
			  AND r_low.event_code = r_high.event_code
			  AND r_high.rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 2
			 WHERE r_low.formatted_date = r1.formatted_date
			   AND r_low.event_code = r1.event_code
			   AND r_low.rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 1)
		END ) AS q1,       
         CASE -- Q2 (median)
           WHEN r1.cnt % 2 = 1 THEN
             (SELECT local_time_ratio
              FROM tmp_ranked
              WHERE formatted_date = r1.formatted_date
                AND event_code = r1.event_code
                AND rn = (r1.cnt + 1) / 2)
           ELSE
             (SELECT AVG(local_time_ratio)
              FROM tmp_ranked
              WHERE formatted_date = r1.formatted_date
                AND event_code = r1.event_code
                AND rn IN (r1.cnt / 2, r1.cnt / 2 + 1))
         END AS q2,       
         (SELECT
            CASE -- Q3 (75th percentile)
              WHEN ((r1.cnt - 1) * 0.75) % 1 = 0 THEN
                (SELECT local_time_ratio
                 FROM tmp_ranked
                 WHERE formatted_date = r1.formatted_date
                   AND event_code = r1.event_code
                   AND rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 1)
              ELSE
                (SELECT r_low.local_time_ratio + (((r1.cnt - 1) * 0.75 - CAST((r1.cnt - 1) * 0.75 AS INTEGER))
                       * (r_high.local_time_ratio - r_low.local_time_ratio))
                 FROM tmp_ranked r_low
                 JOIN tmp_ranked r_high
                   ON r_low.formatted_date = r_high.formatted_date
                  AND r_low.event_code = r_high.event_code
                  AND r_high.rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 2
                 WHERE r_low.formatted_date = r1.formatted_date
                   AND r_low.event_code = r1.event_code
                   AND r_low.rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 1)
            END ) AS q3,
         (SELECT ROUND(AVG(local_time_ratio), 6)           -- Mean
          FROM tmp_ranked r2
          WHERE r2.formatted_date = r1.formatted_date
            AND r2.event_code = r1.event_code) AS average
  FROM tmp_ranked r1
  GROUP BY r1.formatted_date, r1.event_code;
-- @keys: event_code, formatted_date
-- @examples
    select * from tmp_quartile
    order by event_code,formatted_date;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_final_output
   SELECT
    formatted_date,event_code,
    ROUND((q1 + q2 + q3) / 3.0, 6) AS "#1_avg_q1_q2_q3",
    q2 AS "#2_q2_median",
    average AS "#3_overall_average",
    ROUND(((q1 + q2 + q3) / 3.0 + q2 + average) / 3.0, 6) AS "avg_of_#1_#2_#3"
   FROM tmp_quartile;
-- @keys: event_code, formatted_date
-- @examples
    select * from tmp_final_output
    order by event_code,formatted_date;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_normalized
    SELECT f.*,ROUND("avg_of_#1_#2_#3" - (
            SELECT MIN("avg_of_#1_#2_#3")
            FROM tmp_final_output fo
            WHERE fo.event_code = f.event_code
                ) + 1, 6) AS normalized_score
    FROM tmp_final_output f;
-- @keys: event_code, formatted_date
-- @examples
    select * from tmp_normalized
    order by event_code,formatted_date;
-- @endsection
--------------------------
-- @section: updateSimpleTable
-- @updateTableName:  parkrun_events_coeff
-- @updateTable:  parkrun_events
    SET 
        coeff = ROUND(((COALESCE(obs, 0) * COALESCE(coeff, 0)) + (
            SELECT normalized_score
            FROM tmp_normalized
            WHERE tmp_normalized.formatted_date = 
                substr(parkrun_events.event_date, 7, 4) || char(45) || 
                substr(parkrun_events.event_date, 4, 2) || char(45) || 
                substr(parkrun_events.event_date, 1, 2)
            AND tmp_normalized.event_code = parkrun_events.event_code
            )) / (COALESCE(obs, 0) + 1), 6),
        obs = COALESCE(obs, 0) + 1
    WHERE (obs IS NULL OR obs < 16)
    -- If :event_code is provided (not NULL) restrict to that event_code, otherwise update all
    AND (:event_code IS NULL OR parkrun_events.event_code = :event_code)
    AND EXISTS (
        SELECT 1
        FROM tmp_normalized
        WHERE tmp_normalized.formatted_date = 
        substr(parkrun_events.event_date, 7, 4) || char(45) || 
        substr(parkrun_events.event_date, 4, 2) || char(45) || 
        substr(parkrun_events.event_date, 1, 2)
        AND tmp_normalized.event_code = parkrun_events.event_code
    )
-- @examples
    select * from parkrun_events 
    where       substr(parkrun_events.event_date, 7, 4) || char(45) || 
                substr(parkrun_events.event_date, 4, 2) || char(45) || 
                substr(parkrun_events.event_date, 1, 2) = 
                    (select end_date from tmp_endDate)
    and athlete_code = '528017';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_adjusted_eligible_appearances
    SELECT a.event_code,a.formatted_date,a.athlete_code,a.end_date,am.max_ratio,
            a.time_seconds,am.min_time_seconds,ROUND(CAST(a.time_seconds AS REAL) / am.min_time_seconds, 6) AS time_ratio,
            a.adj_time_seconds,am.adj_min_time_seconds, ROUND(CAST(a.adj_time_seconds AS REAL) / am.adj_min_time_seconds, 6) AS adj_time_ratio,
            a.adj2_time_seconds,am.min_adj2, ROUND(CAST(a.adj2_time_seconds AS REAL) / am.min_adj2, 6) AS adj2_time_ratio
    FROM tmp_athletesInEventRange a
    JOIN tmp_athletesRangeStat am USING (athlete_code)
    WHERE a.adj_time_seconds > 0
            AND a.time_seconds IS NOT NULL
            AND a.athlete_code=am.athlete_code
            AND adj_time_ratio <= am.max_ratio;
-- @keys: event_code,athlete_code
-- @examples
    select * from tmp_adjusted_eligible_appearances
     where athlete_code='528017' 
     order by event_code,formatted_date; --where athlete_code='528017'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_event_min
      SELECT athlete_code,event_code,
         MIN(adj_time_seconds) AS min_per_event
      FROM tmp_adjusted_eligible_appearances
      GROUP BY athlete_code, event_code;
-- @keys: event_code,athlete_code
-- @examples
    select * from tmp_athlete_event_min where athlete_code='528017' 
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_min
      SELECT athlete_code,
          MIN(adj_time_seconds) AS min_per_athlete,
		  COUNT(DISTINCT event_code) as event_count
      FROM tmp_adjusted_eligible_appearances
      GROUP BY athlete_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_athlete_min where athlete_code='528017'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_adj_ratio
      SELECT aem.athlete_code, aem.event_code,
          ROUND(aem.min_per_event / am.min_per_athlete, 4) AS adj_ratio
      FROM tmp_athlete_event_min aem
      JOIN tmp_athlete_min am ON aem.athlete_code = am.athlete_code
      WHERE am.event_count > 1;
-- @keys: event_code,athlete_code
-- @examples
    select * from tmp_adj_ratio where athlete_code='528017'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_adj_ranked_ratio
      SELECT event_code,adj_ratio,
          ROW_NUMBER() OVER (PARTITION BY event_code ORDER BY adj_ratio) AS rn,
          COUNT(*) OVER (PARTITION BY event_code) AS adj_total
      FROM tmp_adj_ratio;
-- @keys: event_code
-- @examples
    select * from tmp_adj_ranked_ratio 
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_adj_median_summary
      SELECT event_code,
          ROUND(AVG(adj_ratio), 4) AS adj_median_ratio
      FROM tmp_adj_ranked_ratio
      WHERE rn IN ( (adj_total + 1) / 2, (adj_total + 2) / 2 )
      GROUP BY event_code;
-- @keys: event_code
-- @examples
    SELECT event_code, adj_median_ratio FROM tmp_adj_median_summary
    ORDER BY event_code;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_unknown_count
    --  THIS MIGHT BE USEFUL LATER - for the UNKNOWN COUNT per event - so might move down
	select event_code,count(*) as eventAthleteCount,
        max(position) as lastPosition,
        max(position)-count(*) as unknown_count
	from tmp_eventpositions_end e
	group by event_code;
-- @keys: event_code
-- @examples
    select * from tmp_unknown_count;
    select * from tmp_eventpositions_end where event_code=18 order by time_seconds;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eligible_end
    SELECT event_code,athlete_code,formatted_date,time_seconds,local_time_ratio
    FROM tmp_eligible_appearances
    WHERE formatted_date=end_date;
-- @keys: athlete_code
-- @examples
    select * from tmp_eligible_end where athlete_code='528017';
    --select * from tmp_eventpositions_end where event_code=18 order by time_seconds;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eligible_summary_end
  SELECT event_code,athlete_code,COUNT(*)AS event_eligible_appearances,max(local_time_ratio) AS max_time_ratio,
	CASE 
		WHEN COUNT(*)>=10 THEN TRUE
		ELSE FALSE
	END AS regular
  FROM tmp_eligible_appearances
  GROUP BY event_code,athlete_code;
-- @examples
select * from tmp_eligible_summary_end where athlete_code='528017';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_parkrun_stats
    SELECT
    t.event_code,
    t.event_date,
    SUM(CASE WHEN comment = 'First Timer!' THEN 1 ELSE 0 END) AS first_timers_count,
    --SUM(CASE WHEN tourist_flag = 'F' AND (comment IS NULL OR comment <> 'First Timer!') THEN 1 ELSE 0 END) AS returners_count,
    SUM(CASE WHEN TRIM(COALESCE(club, '')) <> '' THEN 1 ELSE 0 END) AS club_count,
    SUM(CASE WHEN comment = 'New PB!' THEN 1 ELSE 0 END) AS pb_count,
    AVG(t.time_seconds) AS avg_time,
    AVG(CASE WHEN t.time_seconds IS NOT NULL AND ee.local_time_ratio < 1.12 THEN t.time_seconds
        ELSE NULL END) as avgTimeLim12,
    AVG(CASE WHEN t.time_seconds IS NOT NULL AND ee.local_time_ratio < 1.05 THEN t.time_seconds
        ELSE NULL END) as avgTimeLim5,
    SUM(CASE WHEN regular THEN 1 ELSE 0 END) as regulars,
        ms.adj_median_ratio as coeff_event
    FROM tmp_eventpositions_end t
        left join tmp_eligible_end ee ON ee.event_code=t.event_code and ee.athlete_code=t.athlete_code
        left join tmp_eligible_summary_end es ON es.event_code=t.event_code and es.athlete_code=t.athlete_code
        left join tmp_adj_median_summary ms using (event_code)
        WHERE (:event_code IS NULL OR t.event_code = :event_code)
    GROUP BY t.event_code, t.event_date;
-- @keys: event_code
-- @examples
    select * from tmp_parkrun_stats;
-- @endsection
--------------------------
-- @section: updateTable
-- @tempTable:  tmp_parkrun_stats
-- @updateTable: parkrun_events
-- @fieldsToUpdate: first_timers_count, club_count, pb_count, avg_time, avgTimeLim12, avgTimeLim5, regulars, coeff_event
-- @keys: event_code, event_date
-- @example
    SELECT * FROM parkrun_events
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_tourist_flag
    SELECT a.athlete_code,a.last_event_code_count,ar.event_code_distinct_count,formatted_date,mcc.max_last_event_count AS max_count,comment,
        CASE
            WHEN a.last_event_code_count = 1 AND a.formatted_date = a.end_date AND event_code_distinct_count = 1 THEN 'F'
            WHEN (a.last_event_code_count < mcc.max_last_event_count AND a.last_event_code_count<3) OR (mcc.max_last_event_count = 1 AND event_code_distinct_count > 1) THEN 'T'
            ELSE ''
        END AS tourist_flag
    FROM tmp_athletesInEventRange a
    JOIN tmp_max_code_count mcc   ON a.athlete_code = mcc.athlete_code
    JOIN tmp_athletesRangeStat ar ON a.athlete_code = ar.athlete_code
    --JOIN tmp_distinct_events d   ON a.athlete_code = d.athlete_code
    WHERE a.formatted_date = a.end_date
    GROUP BY a.athlete_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_tourist_flag where athlete_code='1432769';
    select * from tmp_tourist_flag where tourist_flag IS NOT '';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_err
    select e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code ,
        e.comment,e.name,e.club,
        s.earliest_possible_dob as min_dob,s.latest_possible_dob as max_dob,s.age
    from eventpositions_view e
    join tmp_dob_ranges s 
    ON	e.athlete_code=s.athlete_code 
    AND e.formatted_date=s.formatted_date
-- @keys: athlete_code,event_code,formatted_date
-- @examples
    select * from tmp_eventpositions_err
    select * from tmp_dob_ranges
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_inputs
  SELECT
    DISTINCT(a.athlete_code),a.name,a.min_dob,a.max_dob,a.last_updated,a.current_age_estimate,a.sex,
    -- guess integer age using max_dob as the anchor (same heuristic as Python caller might pass)
	ROUND(CASE
      WHEN a.min_dob IS NULL AND a.max_dob IS NULL THEN a.current_age_estimate
      WHEN a.min_dob IS NULL THEN (julianday(:formatted_date) - julianday(a.max_dob)) / 365.2425
      WHEN a.max_dob IS NULL THEN (julianday(:formatted_date) - julianday(a.min_dob)) / 365.2425
      ELSE ((julianday(:formatted_date) - julianday(a.max_dob))+ (julianday(:formatted_date) - julianday(a.min_dob)))/ (2.0 * 365.2425)
	END, 2) as age_guess
  FROM athletes a
  JOIN tmp_eventpositions_end e USING (athlete_code)
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_inputs;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_inputs_err
  SELECT a.athlete_code,e.formatted_date,e.formatted_date as last_updated,e.name,e.event_code,
        e.min_dob,e.max_dob,e.age,a.sex,
	ROUND(CASE
      WHEN e.min_dob IS NULL AND e.max_dob IS NULL THEN e.age
      WHEN e.min_dob IS NULL THEN (julianday(e.formatted_date) - julianday(e.max_dob)) / 365.2425
      WHEN e.max_dob IS NULL THEN (julianday(e.formatted_date) - julianday(e.min_dob)) / 365.2425
      ELSE ((julianday(e.formatted_date) - julianday(e.max_dob))+ (julianday(e.formatted_date) - julianday(e.min_dob)))/ (2.0 * 365.2425)
	END, 2) as age_guess
    FROM tmp_eventpositions_err e
    JOIN athletes a
    ON e.athlete_code=a.athlete_code
-- @keys: athlete_code,formatted_date
-- @examples
    select *, datetime((julianday(max_dob) + julianday(min_dob)) / 2.0) from tmp_ageRatio_inputs_err where athlete_code='2491375';	
	select * from athletes where athlete_code='7491589'
	select * from tmp_coalesce_age_fields where athlete_code='7491589'
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_calc
  SELECT athlete_code,name,min_dob,max_dob,last_updated,current_age_estimate,sex,age_guess,
    date(i.max_dob, printf('+%d years', i.age_guess)) AS birthday_max,
    date(i.min_dob, printf('+%d years', i.age_guess + 1)) AS birthday_min_next,
    (julianday(date(i.min_dob, printf('+%d years', i.age_guess + 1))) - julianday(date(i.max_dob, printf('+%d years', i.age_guess)))) AS interval_days,
    (julianday(:formatted_date) - julianday(date(i.max_dob, printf('+%d years', i.age_guess)))) AS days_since_birthday_max
  FROM tmp_ageRatio_inputs i;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_calc where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_calc_err
  SELECT athlete_code,formatted_date,name,min_dob,max_dob,last_updated,sex,age_guess,event_code,
    date(i.max_dob, printf('+%d years', i.age_guess)) AS birthday_max,
    date(i.min_dob, printf('+%d years', i.age_guess + 1)) AS birthday_min_next,
    (julianday(date(i.min_dob, printf('+%d years', i.age_guess + 1))) - julianday(date(i.max_dob, printf('+%d years', i.age_guess)))) AS interval_days,
    (julianday(formatted_date) - julianday(date(i.max_dob, printf('+%d years', i.age_guess)))) AS days_since_birthday_max
  FROM tmp_ageRatio_inputs_err i
  order by athlete_code,formatted_date;
-- @keys: athlete_code,formatted_date
-- @examples
    select * from tmp_ageRatio_calc_err where athlete_code='2491375';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_fract
  SELECT athlete_code,name,min_dob,max_dob,last_updated,current_age_estimate,sex,age_guess,birthday_max,birthday_min_next,interval_days,days_since_birthday_max,
    CASE WHEN c.interval_days > 0 THEN (c.days_since_birthday_max / c.interval_days) ELSE 0 
	END AS x_raw
  FROM tmp_ageRatio_calc c;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_fract where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_fract_err
    SELECT athlete_code,formatted_date,name,min_dob,max_dob,last_updated,sex,age_guess,birthday_max,birthday_min_next,interval_days,days_since_birthday_max,event_code,
        CASE WHEN c.interval_days > 0 THEN (c.days_since_birthday_max / c.interval_days) ELSE 0 
        END AS x_raw
    FROM tmp_ageRatio_calc_err c;
-- @keys: athlete_code,formatted_date
-- @examples
    select * from tmp_ageRatio_fract_err where athlete_code='2491375';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_clamped
    SELECT  athlete_code,name,min_dob,max_dob,last_updated,current_age_estimate,sex,age_guess,birthday_max,birthday_min_next,interval_days,days_since_birthday_max,x_raw,
    CASE WHEN f.x_raw IS NULL THEN 0
        WHEN f.x_raw < 0 THEN 0
        WHEN f.x_raw > 1 THEN 1
        ELSE f.x_raw
    END AS x
    FROM tmp_ageRatio_fract f;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_clamped where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_clamped_err
    SELECT  athlete_code,formatted_date,name,min_dob,max_dob,last_updated,sex,age_guess,birthday_max,birthday_min_next,interval_days,days_since_birthday_max,x_raw,event_code,
    CASE WHEN f.x_raw IS NULL THEN 0
        WHEN f.x_raw < 0 THEN 0
        WHEN f.x_raw > 1 THEN 1
        ELSE f.x_raw
    END AS x
    FROM tmp_ageRatio_fract_err f;
-- @keys: athlete_code,formatted_date
-- @examples
    select * from tmp_ageRatio_clamped_err where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_expanded
    WITH RECURSIVE
    age_dedup AS (
    SELECT age, age_max, sex, age_group,male_age_ratio, sex_age_ratio, rowid,
        ROW_NUMBER() OVER (PARTITION BY age, sex ORDER BY rowid DESC) AS rn
    FROM age_category),
    dedup_sel AS (
    SELECT age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
    FROM age_dedup
    WHERE rn = 1),
    expanded(age_value, age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid) AS (
        -- seed
        SELECT age AS age_value,age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
        FROM dedup_sel
        UNION ALL
        -- recursive step must return the same columns in the same order
        SELECT age_value + 1,age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
        FROM expanded
        WHERE age_value + 1 <= age_max)
    SELECT *
    FROM expanded;
-- @keys: age_value,sex
-- @examples
    select * from tmp_ageRatio_expanded order by age_value;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_final
        SELECT
        c.athlete_code,c.name,c.min_dob,c.max_dob,c.current_age_estimate,c.sex, c.age_guess,c.birthday_max,c.birthday_min_next,c.interval_days,
        c.days_since_birthday_max,c.x,
        COALESCE(CASE
            WHEN an.male_age_ratio IS NOT NULL
            THEN (an.male_age_ratio * c.x) + (ar.male_age_ratio * (1.0 - c.x))
            ELSE ar.male_age_ratio END,NULL) AS male_age_ratio_new,
        COALESCE(CASE
            WHEN an.sex_age_ratio IS NOT NULL
            THEN (an.sex_age_ratio * c.x) + (ar.sex_age_ratio * (1.0 - c.x))
            ELSE ar.sex_age_ratio END, NULL) AS sex_age_ratio_new
        FROM tmp_ageRatio_clamped AS c
        LEFT JOIN tmp_ageRatio_expanded AS ar ON CAST(ROUND(c.age_guess-0.5) AS INTEGER) = ar.age_value AND ar.sex = c.sex
        LEFT JOIN tmp_ageRatio_expanded AS an ON (CAST(ROUND(c.age_guess-0.5) AS INTEGER) + 1) = an.age_value AND an.sex = c.sex
        ORDER BY c.athlete_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_final where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_final_err
        SELECT
        c.athlete_code,c.formatted_date,c.name,c.min_dob,c.max_dob,c.sex, c.age_guess,c.birthday_max,c.birthday_min_next,c.interval_days, c.days_since_birthday_max,c.x,ar.age_value,c.event_code,
        COALESCE(CASE
            WHEN an.male_age_ratio IS NOT NULL
            THEN (an.male_age_ratio * c.x) + (ar.male_age_ratio * (1.0 - c.x))
            ELSE ar.male_age_ratio END,NULL) AS male_age_ratio,
        COALESCE(CASE
            WHEN an.sex_age_ratio IS NOT NULL
            THEN (an.sex_age_ratio * c.x) + (ar.sex_age_ratio * (1.0 - c.x))
            ELSE ar.sex_age_ratio END, NULL) AS sex_age_ratio
        FROM tmp_ageRatio_clamped_err AS c
        LEFT JOIN tmp_ageRatio_expanded AS ar ON CAST(ROUND(c.age_guess-0.5) AS INTEGER) = ar.age_value AND ar.sex = c.sex
        LEFT JOIN tmp_ageRatio_expanded AS an ON (CAST(ROUND(c.age_guess-0.5) AS INTEGER) + 1) = an.age_value AND an.sex = c.sex
-- @keys: athlete_code,formatted_date
-- @examples
    select * from tmp_ageRatio_final_err where athlete_code='10000389';
	select * from tmp_coalesce_age_fields where athlete_code='2486306';
	select * from eventpositions_view where athlete_code='528017' order by formatted_date
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_long
    SELECT athlete_code,last_event_code_count,event_code,time_seconds,formatted_date,event_date,comment,(select end_date from tmp_endDate)as end_date
    FROM eventpositions_view
    WHERE formatted_date BETWEEN date(:formatted_date,'-1 year') AND date(:formatted_date);
-- @keys: event_code, formatted_date,athlete_code
-- @examples
    select * from tmp_eventpositions_long where athlete_code='10000389';
-- @endsection
-------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_long_end
    SELECT athlete_code,event_code,time_seconds,formatted_date,event_date,comment
    FROM tmp_eventpositions_long
    WHERE formatted_date = end_date
-- @keys: athlete_code
-- @examples
    select * from tmp_eventpositions_long_end where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_distinct_event_long
	select athlete_code,COUNT(DISTINCT event_code) AS distinct_courses_long
	from tmp_eventpositions_long group by athlete_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_athlete_distinct_event_long where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_stats_long
    SELECT ep.event_code, ep.event_date, ep.time_seconds, ep.athlete_code,ep.formatted_date,distinct_courses_long,
            COUNT(*) OVER (PARTITION BY ep.athlete_code, ep.event_code) AS last_event_code_count_long,
            COUNT(*) OVER (PARTITION BY ep.athlete_code) AS total_runs_long
    FROM tmp_eventpositions_long ep
    left join tmp_athlete_distinct_event_long using (athlete_code);
-- @keys: athlete_code
-- @examples
    select * from tmp_athlete_stats_long where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_stats_long_end
    select l.athlete_code,l.event_code,l.event_date,l.formatted_date,last_event_code_count_long,
                total_runs_long,distinct_courses_long,l.time_seconds,comment
    from tmp_athlete_stats_long l
    JOIN tmp_eventpositions_long_end e
    ON l.athlete_code = e.athlete_code
    AND l.event_date   = e.event_date
    AND l.event_code   = e.event_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_eventpositions_long where athlete_code='10000389';
    select * from tmp_athlete_stats_long_end where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_superTourists
    SELECT athlete_code, event_date,total_runs_long,distinct_courses_long, last_event_code_count_long,comment,event_code
    FROM tmp_athlete_stats_long_end    
    WHERE distinct_courses_long >= 10 AND COALESCE(last_event_code_count_long, 9999) <= 2;
-- @keys: athlete_code
-- @examples
    select * from tmp_superTourists where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_eventpositions_updates
    SELECT t.event_code,t.event_date,t.position,t.athlete_code,s.event_eligible_appearances,e.local_time_ratio,
    a.time_ratio,a.adj_time_seconds,a.adj_time_ratio,a.adj2_time_seconds,a.adj2_time_ratio,
    r.event_code_distinct_count AS event_code_count,r.total_runs,tf.last_event_code_count,tf.tourist_flag,
    sl.distinct_courses_long,sl.last_event_code_count_long,sl.total_runs_long,
    ar.male_age_ratio_new AS age_ratio_male,ar.sex_age_ratio_new AS age_ratio_sex,age.last_age_estimate,ar.age_guess,
    t.time_seconds,
    CASE WHEN st.athlete_code IS NOT NULL THEN 'T' END AS super_tourist,
    CASE WHEN reg.athlete_code IS NOT NULL THEN 'T' END AS regular,
    CASE WHEN tf.last_event_code_count = 1 AND (t.comment IS NULL OR t.comment <> 'First Timer!') THEN 'T' END AS returner,
    CASE WHEN sl.last_event_code_count_long = 1 AND (t.comment IS NULL OR t.comment <> 'First Timer!') THEN 'T' END AS super_returner
    FROM tmp_eventpositions_end t
    LEFT JOIN tmp_athletesInEventRangeStat s ON s.event_code = t.event_code AND s.athlete_code = t.athlete_code 
    LEFT JOIN tmp_eligible_end e ON e.event_code = t.event_code AND e.athlete_code = t.athlete_code AND e.formatted_date = (SELECT end_date FROM tmp_endDate)
    LEFT JOIN tmp_adjusted_eligible_appearances a ON a.event_code = t.event_code AND a.athlete_code = t.athlete_code AND a.formatted_date = (SELECT end_date FROM tmp_endDate)
    LEFT JOIN tmp_athletesRangeStat r ON r.athlete_code = t.athlete_code
    LEFT JOIN tmp_tourist_flag tf ON tf.athlete_code = t.athlete_code
    LEFT JOIN tmp_athlete_stats_long_end sl ON sl.athlete_code = t.athlete_code
    LEFT JOIN tmp_superTourists st ON st.athlete_code = t.athlete_code
    LEFT JOIN tmp_ageRatio_final ar ON ar.athlete_code = t.athlete_code
    LEFT JOIN athletes ath ON ath.athlete_code = t.athlete_code
    LEFT JOIN tmp_regulars reg ON reg.athlete_code = t.athlete_code AND reg.event_code = t.event_code
	LEFT JOIN tmp_eventpositions_age age ON age.athlete_code = t.athlete_code AND age.event_code = t.event_code;
-- @keys: athlete_code
-- @examples
    select * from tmp_eventpositions_updates where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: updateSimpleTable
-- @updateTableName:  eventpositions_update
-- @updateTable:  eventpositions
SET
  event_eligible_appearances = (SELECT u.event_eligible_appearances FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  local_time_ratio = (SELECT u.local_time_ratio FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  time_ratio = (SELECT u.time_ratio FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  adj_time_seconds = (SELECT u.adj_time_seconds FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  adj_time_ratio = (SELECT u.adj_time_ratio FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  adj2_time_seconds = (SELECT u.adj2_time_seconds FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  adj2_time_ratio = (SELECT u.adj2_time_ratio FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  event_code_count = (SELECT u.event_code_count FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  total_runs = (SELECT u.total_runs FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  last_event_code_count = (SELECT u.last_event_code_count FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  tourist_flag = (SELECT u.tourist_flag FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  distinct_courses_long = (SELECT u.distinct_courses_long FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  last_event_code_count_long = (SELECT u.last_event_code_count_long FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  total_runs_long = (SELECT u.total_runs_long FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  super_tourist = (SELECT u.super_tourist FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  age_ratio_male = (SELECT u.age_ratio_male FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  age_ratio_sex = (SELECT u.age_ratio_sex FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  current_age_estimate = (SELECT u.age_guess FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),  
  regular = (SELECT u.regular FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  returner = (SELECT u.returner FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  super_returner = (SELECT u.super_returner FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1),
  time_seconds = (SELECT u.time_seconds FROM tmp_eventpositions_updates u WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code LIMIT 1)
WHERE EXISTS (
  SELECT 1 FROM tmp_eventpositions_updates u
  WHERE u.event_code=eventpositions.event_code AND u.event_date=eventpositions.event_date AND u.position=eventpositions.position AND u.athlete_code=eventpositions.athlete_code)
    -- If :event_code is provided (not NULL) restrict to that event_code, otherwise update all
    AND (:event_code IS NULL OR eventpositions.event_code = :event_code)
--@examples
   select * from eventpositions where athlete_code='528017' 
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_parkrun_events_agg
    SELECT u.event_code, event_date,
        COUNT(CASE WHEN u.tourist_flag = 'T' THEN 1 END) AS tourist_count, 
        ROUND(AVG(CASE WHEN u.last_age_estimate IS NOT NULL THEN u.last_age_estimate END), 2) AS avg_age, 
        COUNT(CASE WHEN u.regular = 'T' THEN 1 END) AS regulars, 
        COUNT(CASE WHEN u.super_tourist = 'T' THEN 1 END) AS super_tourist_count, 
        COUNT(CASE WHEN u.returner = 'T' THEN 1 END) AS returners_count, 
        COUNT(CASE WHEN u.super_returner = 'T' THEN 1 END) AS super_returner_count, 
        SUM(CASE WHEN (u.adj_time_ratio = 1 AND COALESCE(u.event_eligible_appearances,0) > 3) THEN 1 ELSE 0 END) AS recentBest_count, 
        SUM(CASE WHEN (u.adj_time_ratio < 1.05 AND COALESCE(u.event_eligible_appearances,0) > 3) THEN 1 ELSE 0 END) AS eligible_time_count, 
        MAX(u.position) AS max_position, 
        COUNT(1) AS athlete_count 
    FROM tmp_eventpositions_updates u 
    WHERE  :event_code IS NULL OR u.event_code = :event_code
    GROUP BY u.event_code,event_date
-- @keys: event_code
-- @examples
    select * from tmp_parkrun_events_agg;
-- @endsection
--------------------------
-- @section: updateSimpleTable
-- @updateTableName:  parkrun_events_update
-- @updateTable:  parkrun_events
SET
    tourist_count = COALESCE((SELECT tourist_count FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    avg_age = (SELECT avg_age FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 
    regulars = COALESCE((SELECT regulars FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    super_tourist_count = COALESCE((SELECT super_tourist_count FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    returners_count = COALESCE((SELECT returners_count FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    super_returner_count = COALESCE((SELECT super_returner_count FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    recentBest_count = COALESCE((SELECT recentBest_count FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    eligible_time_count = COALESCE((SELECT eligible_time_count FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code), 0), 
    unknown_count = COALESCE((SELECT CASE WHEN a.max_position IS NULL THEN 0 ELSE (a.max_position - a.athlete_count) END 
FROM tmp_parkrun_events_agg a 
WHERE a.event_code = parkrun_events.event_code), 0) 
WHERE EXISTS ( SELECT 1 FROM tmp_parkrun_events_agg a WHERE a.event_code = parkrun_events.event_code and a.event_date = parkrun_events.event_date);
--@examples
   select * from parkrun_events where event_code=1
-- @endsection
--------------------------
-- @section: tmp_athlete_dob_corrections
-- @tempTable:  tmp_athlete_dob_corrections
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
            o.latest_possible_dob   AS current_max
        FROM ordered o
        WHERE o.rn = 1

        UNION ALL

        SELECT
            o.athlete_code,
            o.rn,
            o.formatted_date,
            CASE
                WHEN date(
                        CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                            THEN o.earliest_possible_dob ELSE w.current_min END
                    )
                <= date(
                        CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                            THEN o.latest_possible_dob ELSE w.current_max END
                    )
                THEN CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                        THEN o.earliest_possible_dob ELSE w.current_min END
                ELSE w.current_min
            END AS current_min,
            CASE
                WHEN date(
                        CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                            THEN o.earliest_possible_dob ELSE w.current_min END
                    )
                <= date(
                        CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                            THEN o.latest_possible_dob ELSE w.current_max END
                    )
                THEN CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                        THEN o.latest_possible_dob ELSE w.current_max END
                ELSE w.current_max
            END AS current_max
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
    GROUP BY athlete_code;
--@examples
   select * from tmp_athlete_dob_corrections
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_recent_runs
    SELECT
        athlete_code,
        COUNT(*) AS recent_runs
    FROM tmp_athlete_stats_long
    GROUP BY athlete_code
-- @keys: athlete_code
-- @examples
-- select * from tmp_athlete_recent_runs;
-- @endsection
--------------------------
-- @section: updateSimpleTable
-- @updateTableName:  athletes_recent_runs_update
-- @updateTable:  athletes
    SET
        recent_runs = COALESCE(
            (SELECT r.recent_runs
            FROM tmp_athlete_recent_runs r
            WHERE r.athlete_code = athletes.athlete_code),
            0
        )
    WHERE EXISTS (
        SELECT 1
        FROM tmp_athlete_recent_runs r
        WHERE r.athlete_code = athletes.athlete_code
    );
-- @examples
-- select athlete_code, recent_runs from athletes where athlete_code='528017';
-- @endsection
--------------------------
-- @endsection