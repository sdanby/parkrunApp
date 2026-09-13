--CREATE TEMP TABLE IF NOT EXISTS _avg_category( event_code INTEGER, event_date TEXT, avg_age_regular REAL, avg_age_super_tourist REAL );
--DELETE FROM _avg_regulars; -- ensure clean for repeated runs
-- INSERT INTO _param(date) VALUES('2025-10-04')
WITH params AS (
  SELECT '2025-10-04' AS end_date,
         date('2025-10-04', '-105 days') AS start_date  -- 15 weeks ~= 105 days
),
athletes_on_date AS (
  SELECT DISTINCT ep.event_code, ep.athlete_code
  FROM eventpositions_view ep
  JOIN params p ON ep.formatted_date = p.end_date
),
qualifying_counts AS (
  SELECT
    ep.event_code,
    ep.athlete_code,
    COUNT(*) AS qual_count
  FROM eventpositions_view ep
  JOIN params p ON ep.formatted_date BETWEEN p.start_date AND p.end_date
  JOIN athletes_on_date aod ON ep.event_code = aod.event_code AND ep.athlete_code = aod.athlete_code
  WHERE ep.adj_time_ratio < 1.1
  GROUP BY ep.event_code, ep.athlete_code
)
,
regulars_athletes AS (
  -- the actual regular athlete_codes (qual_count >= 10) for the end_date's events
  SELECT event_code, athlete_code
  FROM qualifying_counts
  WHERE qual_count >= 10
)
,
--  =======================================================================
--WITH
period_rows AS (
  SELECT *
  FROM eventpositions_view
  WHERE formatted_date BETWEEN date((select end_date from params),'-1 year') AND (select end_date from params)
)
,
end_ranked AS (
  SELECT
    athlete_code,
    last_event_code_count,
    event_code,
    event_date,
    ROW_NUMBER() OVER (PARTITION BY athlete_code ORDER BY COALESCE(time_seconds,0) DESC) AS rn
  FROM period_rows
  WHERE formatted_date = (select end_date from params)
),
end_day AS (
  SELECT athlete_code, last_event_code_count, event_code, event_date
  FROM end_ranked
  WHERE rn = 1
)
,
period_rows_filtered AS (
  SELECT *
  FROM period_rows
  WHERE athlete_code IN (SELECT athlete_code FROM end_day)
)
,
winners AS (
  SELECT
    pr.athlete_code,
    COUNT(DISTINCT pr.event_code)           AS distinct_courses,
    date(:formatted_date)                      AS last_date,
    COALESCE(ed.last_event_code_count, 0)   AS last_event_count,
    ed.event_code                            AS last_code,
    substr(ed.event_date,7,4) || '-' || substr(ed.event_date,4,2) || '-' || substr(ed.event_date,1,2)  AS update_date
  FROM period_rows_filtered pr
  LEFT JOIN end_day ed USING (athlete_code)
  GROUP BY pr.athlete_code
  HAVING distinct_courses >= 10
     AND COALESCE(ed.last_event_code_count, 9999) <= 2
)
,
super_athletes AS ( 
	SELECT last_code AS event_code, athlete_code 
	  FROM winners 
	  WHERE update_date = (select end_date from params) 
),
--  =======================================================================
-- compute per-event counts (same as your tmp_event_counts; kept as CTE) 
event_counts AS ( 
	SELECT ep.event_code, ep.formatted_date AS event_date, 
		SUM(CASE WHEN comment = 'First Timer!' THEN 1 ELSE 0 END) AS first_timers_count, 
		SUM(CASE WHEN tourist_flag = 'F' AND (comment IS NULL OR comment <> 'First Timer!') THEN 1 ELSE 0 END) AS returners_count, 
		SUM(CASE WHEN TRIM(COALESCE(club, '')) <> '' THEN 1 ELSE 0 END) AS club_count, SUM(CASE WHEN comment = 'New PB!' THEN 1 ELSE 0 END) AS pb_count, 
		SUM(CASE WHEN adj_time_ratio = 1 AND event_eligible_appearances > 3 THEN 1 ELSE 0 END) AS recentBest_count, 
		SUM(CASE WHEN adj_time_ratio < 1.05 AND event_eligible_appearances > 3 THEN 1 ELSE 0 END) AS eligible_time_count 
	FROM eventpositions_view ep 
	WHERE ep.formatted_date = (select end_date from params) -- AND (:event_code IS NULL OR ep.event_code = :event_code) 
	GROUP BY ep.event_code, ep.formatted_date ),

-- compute per-athlete age in years for events on the target date (NULL if cannot compute) 
ages AS ( 
	SELECT ep.event_code, ep.event_date, ep.athlete_code, 
		CASE WHEN (a.min_dob IS NOT NULL OR a.max_dob IS NOT NULL) 
		     THEN ( julianday( substr(ep.event_date,7,4) || '-' || substr(ep.event_date,4,2) || '-' || substr(ep.event_date,1,2) ) - 
			CASE WHEN a.min_dob IS NOT NULL AND a.max_dob IS NOT NULL THEN (julianday(a.min_dob) + julianday(a.max_dob)) / 2.0 
				 WHEN a.min_dob IS NOT NULL THEN julianday(a.min_dob) 
				 WHEN a.max_dob IS NOT NULL THEN julianday(a.max_dob) 
			END ) / 365.25 
			WHEN a.current_age_estimate IS NOT NULL THEN (CAST(a.current_age_estimate AS REAL) - 
				((julianday('now') - julianday( substr(ep.event_date,7,4) || '-' || substr(ep.event_date,4,2) || '-' || substr(ep.event_date,1,2) )) / 365.25)) 
			ELSE NULL 
		END AS age_years 
	FROM eventpositions ep 
	JOIN athletes a ON a.athlete_code = ep.athlete_code 
   WHERE substr(ep.event_date,7,4) || '-' || substr(ep.event_date,4,2) || '-' || substr(ep.event_date,1,2) = (select end_date from params) 
   --order by ep.event_code,ep.athlete_code
   )
, 
-- =========================================================
-- compute average age for each flag by joining ages -> filter conditions match the counts 
avg_age_flags AS ( 
	SELECT ag.event_code, ag.event_date, -- average ages (NULL if no matches) 
		ROUND(AVG(CASE WHEN ep.comment = 'First Timer!' THEN ag.age_years END), 2) AS avg_age_first_timer, 
		ROUND(AVG(CASE WHEN ep.tourist_flag = 'F' AND (ep.comment IS NULL OR ep.comment <> 'First Timer!') THEN ag.age_years END), 2) AS avg_age_returner, 
		ROUND(AVG(CASE WHEN TRIM(COALESCE(ep.club,'')) <> '' THEN ag.age_years END), 2) AS avg_age_clubber, 
		ROUND(AVG(CASE WHEN ep.comment = 'New PB!' THEN ag.age_years END), 2) AS avg_age_pb, 
		ROUND(AVG(CASE WHEN ep.adj_time_ratio = 1 AND ep.event_eligible_appearances > 3 THEN ag.age_years END), 2) AS avg_age_recentBest, 
		ROUND(AVG(CASE WHEN ep.adj_time_ratio < 1.05 AND ep.event_eligible_appearances > 3 THEN ag.age_years END), 2) AS avg_age_eligible_time 
	FROM ages ag 
	LEFT JOIN eventpositions_view ep ON ag.event_code = ep.event_code AND ag.event_date = ep.event_date AND ag.athlete_code = ep.athlete_code 
	WHERE ag.event_date = (select end_date from params) --AND (:event_code IS NULL OR ag.event_code = :event_code) 
	GROUP BY ag.event_code, ag.event_date 
	)
--	,


-- merged aggregates: conditional    AVG() for regulars and for super-tourists 
--merged_avg AS ( 
	SELECT ag.event_code, ag.event_date, 
		ROUND(AVG(CASE WHEN r.athlete_code IS NOT NULL 
						THEN ag.age_years 
				  END), 2) AS avg_age_regular, 
		ROUND(AVG(CASE WHEN s.athlete_code IS NOT NULL 
						THEN ag.age_years 
				END), 2) AS avg_age_super_tourist,
		af.avg_age_first_timer, af.avg_age_returner, af.avg_age_clubber, af.avg_age_pb, af.avg_age_recentBest, af.avg_age_eligible_time
	  FROM ages ag 
 LEFT JOIN regulars_athletes r ON r.event_code = ag.event_code AND r.athlete_code = ag.athlete_code 
 LEFT JOIN super_athletes s ON s.event_code = ag.event_code AND s.athlete_code = ag.athlete_code 
 LEFT JOIN avg_age_flags af ON af.event_code = ag.event_code AND af.event_date = ag.event_date 
  GROUP BY ag.event_code, ag.event_date 
 )

-- insert one row per event on the date; avg columns will be NULL if no matching group 
INSERT INTO _avg_category(event_code, event_date, avg_age_regular, avg_age_super_tourist) 
     SELECT event_code, event_date, avg_age_regular, avg_age_super_tourist 
	   FROM merged_avg 
  ORDER BY event_code;