select * from selected_eventRange

DROP TABLE IF EXISTS selected_eventRange;
--selected_eventRange AS (
CREATE TEMP TABLE selected_eventRange
 AS
  SELECT 
    pe1.formatted_date AS end_date,
    pe2.formatted_date AS start_date,
    pe1.event_code,
    pe1.event_number AS end_number,
    1.2 AS max_ratio
  FROM parkrun_events_view pe1
  JOIN parkrun_events_view pe2  
    ON pe1.event_code = pe2.event_code
   AND pe2.event_number = pe1.event_number - 15
  WHERE pe1.event_code = 4 and pe1.formatted_date='2023-10-28'  -- AND pe1.event_number = 500 ; --:event_code & --event_number
WITH

 athletesInEventRange AS (
  SELECT ep.event_code,ep.event_date,ep.time,ep.time_seconds,ep.athlete_code,pe.event_number, ep.formatted_date,sr.end_date
  FROM eventpositions_view ep
  JOIN parkrun_events_view pe ON ep.event_code = pe.event_code AND ep.formatted_date = pe.formatted_date
  JOIN selected_eventRange sr ON pe.event_code = sr.event_code
      AND pe.event_number BETWEEN sr.end_number - 15 AND sr.end_number 
 )
 
,
athletesStatsInEventRange AS (
  SELECT athlete_code,
      MIN(time_seconds) AS min_time_seconds,
      COUNT(*) AS event_eligible_appearances
  FROM  athletesInEventRange
  CROSS JOIN selected_eventRange
  --WHERE athletesInEventRange.event_code = 4 --:event_code
  --AND 
  --formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  GROUP BY athlete_code
  HAVING COUNT(*) > 1
)
,
ratiosInEventRange1 AS (
  SELECT pe.formatted_date, pe.athlete_code, pe.time, pe.event_code, pe.event_number, ast.event_eligible_appearances,
      CAST(pe.time_seconds AS REAL) / ast.min_time_seconds AS time_ratio
  FROM athletesInEventRange pe
  JOIN athletesStatsInEventRange ast ON pe.athlete_code = ast.athlete_code
  --CROSS JOIN selected_eventRange
  WHERE 
  --pe.event_code = 4
  --AND 
  --pe.formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  --AND 
  CAST(pe.time_seconds AS REAL) / ast.min_time_seconds <= 1.2
  AND pe.formatted_date = pe.end_date
 )
 
  SELECT formatted_date, athlete_code, time, event_code, event_number, event_eligible_appearances, time_ratio 
  FROM ratiosInEventRange1


  
  
  select * from eventpositions_view 
   CROSS JOIN selected_eventRange 
   where athlete_code='564145' and 
  formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  
  
  
  WITH selected_eventRange AS (
    -- Resolve the single event-range row
    SELECT
        pe1.formatted_date AS end_date,
        pe2.formatted_date AS start_date,
        pe1.event_code,
        pe1.event_number AS end_number,
        1.2 AS max_ratio
    FROM parkrun_events_view pe1
    JOIN parkrun_events_view pe2
        ON pe1.event_code = pe2.event_code
        AND pe2.event_number = pe1.event_number - 15
    WHERE pe1.event_code = 4  --  :event_code
      AND pe1.event_number = 500  --  :event_number
),
date_range AS (
    -- Build the scalar-like date-range row
    SELECT
        end_date,
        start_date,
        event_code,
        end_number
    FROM selected_eventRange
)
,

period_rows AS (
    -- Scan eventpositions_view within the date window
    SELECT
        ep.*,
        dr.start_date,
        dr.end_date,
		dr.end_number   
    FROM eventpositions_view ep
    JOIN date_range dr
        ON ep.event_code = dr.event_code
        AND ep.formatted_date BETWEEN dr.start_date AND dr.end_date
),

end_ranked AS (
    -- Rank athlete rows on the 'end' day
    SELECT
        pr.athlete_code,
        pr.last_event_code_count,
        pr.event_code,
        pr.event_date,
        ROW_NUMBER() OVER (
            PARTITION BY pr.athlete_code
            ORDER BY COALESCE(pr.time_seconds, 0) DESC
        ) AS rn
    FROM period_rows pr
    WHERE pr.formatted_date = DATE(pr.end_date)
),

end_day AS (
    -- Select top-ranked athlete rows for the end day
    SELECT
        athlete_code,
        last_event_code_count,
        event_code,
        event_date
    FROM end_ranked
    WHERE rn = 1
)
,

period_rows_filtered AS (
    -- Filter period rows to only athletes who appear on the end day
    SELECT pr.*
    FROM period_rows pr
    JOIN end_day ed
        ON pr.athlete_code = ed.athlete_code
)
--,

--winners AS (
    -- Count distinct courses for filtered athletes
    SELECT
        pr.athlete_code,
        COUNT(DISTINCT pr.event_code) AS distinct_courses,
        DATE(pr.end_date) AS last_date,
        COALESCE(ed.last_event_code_count, 0) AS last_event_count,
        ed.event_code AS last_code,
        ed.event_date AS update_date
    FROM period_rows_filtered pr
    LEFT JOIN end_day ed USING (athlete_code)
    GROUP BY pr.athlete_code
    HAVING distinct_courses >= 10
       AND COALESCE(ed.last_event_code_count, 9999) <= 2
),

athletes_stats AS (
    -- Compute per-athlete stats across the lookback window
    SELECT
        pr.athlete_code,
        MIN(pr.time_seconds) AS min_time_seconds,
        COUNT(*) AS event_eligible_appearances
    FROM period_rows pr
    WHERE pr.event_code = :event_code
      AND pr.formatted_date BETWEEN
          (SELECT start_date FROM date_range) AND
          (SELECT end_date FROM date_range)
    GROUP BY pr.athlete_code
    HAVING COUNT(*) > 1
),

ratiosInEventRange1 AS (
    -- Final filtered ratios for the target event_number
    SELECT
        pr.formatted_date,
        pr.athlete_code,
        pr.time,
        pr.event_code,
        pr.end_number,
        ast.event_eligible_appearances,
        CAST(pr.time_seconds AS REAL) / ast.min_time_seconds AS time_ratio
    FROM period_rows pr
    JOIN athletes_stats ast
        ON pr.athlete_code = ast.athlete_code
    WHERE pr.event_code = 4 -- :event_code
      AND pr.formatted_date BETWEEN
          (SELECT start_date FROM date_range) AND
          (SELECT end_date FROM date_range)
      AND CAST(pr.time_seconds AS REAL) / ast.min_time_seconds <=
          (SELECT max_ratio FROM selected_eventRange)
      AND pr.end_number = 500 -- :event_number
)

-- Final output
SELECT
    r.formatted_date,
    r.athlete_code,
    r.time,
    r.event_code,
    r.end_number,
    r.event_eligible_appearances,
    r.time_ratio,
    w.distinct_courses
FROM ratiosInEventRange1 r
LEFT JOIN winners w USING (athlete_code)
ORDER BY r.athlete_code, r.formatted_date;

period_rows AS (
  SELECT *,end_date
  FROM eventpositions_view e
  JOIN selected_eventRange s --ON s.event_code=e.event_code -- end_date=formatted_date and 
  WHERE formatted_date BETWEEN date(end_date,'-1 year') AND date(end_date)
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
  WHERE formatted_date = date(end_date)
)
,
end_day AS (
  SELECT athlete_code, last_event_code_count, event_code, event_date
  FROM end_ranked
  WHERE rn = 1
)
--,
--period_rows_filtered AS (
  SELECT *
  FROM period_rows
  WHERE athlete_code IN (SELECT athlete_code FROM end_day)
)
--,
--winners AS (
  SELECT
    pr.athlete_code,
    COUNT(DISTINCT pr.event_code)           AS distinct_courses,
    date(end_date)                      AS last_date
 --   COALESCE(ed.last_event_code_count, 0)   AS last_event_count,
   -- ed.event_code                            AS last_code,
 --   ed.event_date                            AS update_date
  FROM period_rows_filtered pr
  --LEFT JOIN end_day ed USING (athlete_code)
  GROUP BY pr.athlete_code
  HAVING distinct_courses >= 10
     AND COALESCE(ed.last_event_code_count, 9999) <= 2
)
