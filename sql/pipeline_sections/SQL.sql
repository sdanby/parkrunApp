-- @section final_calcCoeffEvent
-- This section calculates the coefficient for each event based on the adjusted times of eligible athletes.
-- It uses Common Table Expressions (CTEs) to filter athletes, calculate adjusted times, and
-- compute the median ratios for each event.  
-- It updates the parkrun_events table with the calculated coefficients and observation counts.
-- DEPENDENCIES: eligible_summary; 
WITH athlete_event_min AS (
      SELECT
          athlete_code,
          event_code,
          MIN(adjusted_seconds) AS min_per_event
      FROM eligible_summary
      GROUP BY athlete_code, event_code
  ),
  athlete_min AS (
      SELECT
          athlete_code,
          MIN(adjusted_seconds) AS min_per_athlete
      FROM eligible_summary
      GROUP BY athlete_code
  ),
  event_counts AS (
      SELECT
          athlete_code,
          COUNT(DISTINCT event_code) AS event_count
      FROM eligible_summary
      GROUP BY athlete_code
  ),
  ratios AS (
      SELECT
          aem.athlete_code,
          aem.event_code,
          ROUND(aem.min_per_event / am.min_per_athlete, 4) AS ratio
      FROM athlete_event_min aem
      JOIN athlete_min am ON aem.athlete_code = am.athlete_code
      JOIN event_counts ec ON aem.athlete_code = ec.athlete_code
      WHERE ec.event_count > 1
  ),
    ranked_ratios AS (
        SELECT
            event_code,
            ratio,
            ROW_NUMBER() OVER (PARTITION BY event_code ORDER BY ratio) AS rn,
            COUNT(*) OVER (PARTITION BY event_code) AS total
        FROM ratios
    ),
    median_summary AS (
        SELECT
            event_code,
            ROUND(AVG(ratio), 4) AS median_ratio
        FROM ranked_ratios
        WHERE rn IN ( (total + 1) / 2, (total + 2) / 2 )
        GROUP BY event_code
    )
    SELECT event_code, median_ratio FROM median_summary
    ORDER BY event_code
-- @endsection


-- @section athleteAdjTimesSec
-- This CTE calculates the adjusted time in seconds for each athlete based on their event code and date.
-- It joins the eventpositions_view with parkrun_events to get the coefficient for adjustment.
-- It uses event_date as this is a more efficient join condition than formatted_date.
selected_athleteAdjTimeSec AS (
  SELECT
    ep.athlete_code,
    ep.event_code,
    ep.event_date,
    pe.coeff,
    ROUND(time_seconds / pe.coeff, 2) AS adjusted_seconds
  FROM eventpositions_view ep
  JOIN parkrun_events pe ON ep.event_code = pe.event_code AND ep.event_date = pe.event_date
  WHERE substr(ep.event_date, 7, 4) || '-' || substr(ep.event_date, 4, 2) || '-' || substr(ep.event_date, 1, 2)
        BETWEEN :start_date AND :end_date
 )
-- @endsection

--@section athletesAdjPBforRange
athletesAdjPBforRange AS (
    SELECT athlete_code, MIN(adjusted_seconds) AS personal_best
    FROM selected_athleteAdjTimeSec
    GROUP BY athlete_code
 ) 
-- @endsection

--@section eligibleWithinRange
-- This CTE filters athletes who have adjusted times within 20% of their personal best. 
eligibleWithinRange AS (
    SELECT j.athlete_code, j.event_code, j.event_date, j.adjusted_seconds, pb.personal_best
    FROM selected_athleteAdjTimeSec j
    JOIN athletesAdjPBforRange pb ON j.athlete_code = pb.athlete_code
    WHERE j.adjusted_seconds < pb.personal_best * 1.20
 )
-- @endsection

-- @section eligibleAthletes
-- This CTE retrieves athletes who have adjusted times within 20% of their personal best.
SELECT * FROM eligibleWithinRange
-- @endsection

-- @section selected_eventRange
-- This CTE selects a range of events based on the event_code and event_number.
-- It retrieves the start and end dates, event_code, end_number, and a max_ratio.
selected_eventRange AS (
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
  WHERE pe1.event_code = :event_code AND pe1.event_number = :event_number
 )
-- @endsection

-- @section athletesInEventRange
-- This CTE retrieves athletes who participated in a specific event range.
-- It joins the eventpositions_view and parkrun_events_view to filter by event_code and
-- DEPENDENCIES: selected_eventRange; 
athletesInEventRange AS (
  SELECT ep.event_code,ep.event_date,ep.time,ep.time_seconds,ep.athlete_code,pe.event_number, ep.formatted_date
  FROM eventpositions_view ep
  JOIN parkrun_events_view pe ON ep.event_code = pe.event_code AND ep.formatted_date = pe.formatted_date
  JOIN selected_eventRange sr ON pe.event_code = sr.event_code
      AND pe.event_number BETWEEN sr.end_number - 15 AND sr.end_number 
 )
-- @endsection

-- @section athletesStatsInEventRange
-- This CTE retrieves statistics for athletes who participated in a specific event range.
-- It counts the number of event eligible appearances and calculates the minimum time for each athlete.
-- It filters athletes who have more than one event eligible appearance in the specified event range.
-- DEPENDENCIES: selected_eventRange; 
athletesStatsInEventRange AS (
  SELECT athlete_code,
      MIN(time_seconds) AS min_time_seconds,
      COUNT(*) AS event_eligible_appearances
  FROM  athletesInEventRange
  CROSS JOIN selected_eventRange
  WHERE athletesInEventRange.event_code = :event_code
  AND formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  GROUP BY athlete_code
  HAVING COUNT(*) > 1
       )
-- @endsection

-- @section ratiosInEventRange
-- This CTE calculates the ratio of each athlete's time to the minimum time in the event range.
-- It filters athletes whose time ratio is less than or equal to 1.2.
-- DEPENDENCIES: selected_eventRange; athlete_statsInEventRange;
ratiosInEventRange AS (
  SELECT pe.formatted_date,
      CAST(pe.time_seconds AS REAL) / ast.min_time_seconds AS time_ratio
  FROM athletesInEventRange pe
  JOIN athletesStatsInEventRange ast ON pe.athlete_code = ast.athlete_code
  CROSS JOIN selected_eventRange
  WHERE pe.event_code = :event_code
  AND pe.formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  AND CAST(pe.time_seconds AS REAL) / ast.min_time_seconds <= 1.2
 ),
-- @endsection

-- @section final_selectRatios
-- This section selects the formatted date, athlete code, time, event code, event number,
  SELECT formatted_date, athlete_code, time, event_code, event_number, event_eligible_appearances, time_ratio
  FROM ratiosInEventRange1
-- @endsection

-- @section ratiosInEventRange1
-- This CTE calculates the ratio of each athlete's time to the minimum time in the event range.
-- It filters athletes whose time ratio is less than or equal to 1.2.
-- DEPENDENCIES: selected_eventRange; athlete_statsInEventRange;
ratiosInEventRange1 AS (
  SELECT pe.formatted_date, pe.athlete_code, pe.time, pe.event_code, pe.event_number, ast.event_eligible_appearances,
      CAST(pe.time_seconds AS REAL) / ast.min_time_seconds AS time_ratio
  FROM athletesInEventRange pe
  JOIN athletesStatsInEventRange ast ON pe.athlete_code = ast.athlete_code
  CROSS JOIN selected_eventRange
  WHERE pe.event_code = :event_code
  AND pe.formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  AND CAST(pe.time_seconds AS REAL) / ast.min_time_seconds <= 1.2
  AND pe.event_number = :event_number
 )
-- @endsection

-- @section medianCalcsandUpdate
-- This CTE calculates the quartiles and averages for the time ratios of athletes in the event range.
-- It ranks the time ratios, calculates the quartiles (Q1, Q2, Q3), and the overall average.
-- It then updates the parkrun_events table with the calculated coefficients and observation counts.    
-- DEPENDENCIES: ratiosInEventRange;  
ranked AS (
      SELECT *,
          ROW_NUMBER() OVER (PARTITION BY formatted_date ORDER BY time_ratio) AS rn,
          COUNT(*) OVER (PARTITION BY formatted_date) AS cnt
      FROM ratiosInEventRange
  ),
  quartiles AS (
      SELECT r1.formatted_date,
          -- Q1 (25th percentile)
          (SELECT
              CASE 
                  WHEN ((r1.cnt - 1) * 0.25) % 1 = 0 THEN
                      (SELECT time_ratio
                      FROM ranked
                      WHERE formatted_date = r1.formatted_date
                      AND rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 1)
                  ELSE
                      (SELECT r_low.time_ratio + 
                              (((r1.cnt - 1) * 0.25 - CAST((r1.cnt - 1) * 0.25 AS INTEGER)) *
                              (r_high.time_ratio - r_low.time_ratio))
                      FROM ranked r_low
                      JOIN ranked r_high 
                      ON r_low.formatted_date = r_high.formatted_date 
                      AND r_high.rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 2
                      WHERE r_low.formatted_date = r1.formatted_date
                      AND r_low.rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 1)
              END
          ) AS q1,
          -- Q2 (median)
          CASE 
              WHEN r1.cnt % 2 = 1 THEN
                  (SELECT time_ratio
                  FROM ranked
                  WHERE formatted_date = r1.formatted_date
                  AND rn = (r1.cnt + 1) / 2)
              ELSE
                  (SELECT AVG(time_ratio)
                  FROM ranked
                  WHERE formatted_date = r1.formatted_date
                  AND rn IN (r1.cnt / 2, r1.cnt / 2 + 1))
          END AS q2,
          -- Q3 (75th percentile)
          (SELECT
              CASE 
                  WHEN ((r1.cnt - 1) * 0.75) % 1 = 0 THEN
                      (SELECT time_ratio
                      FROM ranked
                      WHERE formatted_date = r1.formatted_date
                      AND rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 1)
                  ELSE
                      (SELECT r_low.time_ratio + 
                              (((r1.cnt - 1) * 0.75 - CAST((r1.cnt - 1) * 0.75 AS INTEGER)) *
                              (r_high.time_ratio - r_low.time_ratio))
                      FROM ranked r_low
                      JOIN ranked r_high 
                      ON r_low.formatted_date = r_high.formatted_date 
                      AND r_high.rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 2
                      WHERE r_low.formatted_date = r1.formatted_date
                      AND r_low.rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 1)
              END
          ) AS q3,
          -- Mean
          (SELECT ROUND(AVG(time_ratio), 6)
          FROM ranked r2
          WHERE r2.formatted_date = r1.formatted_date) AS average
      FROM ranked r1
      GROUP BY r1.formatted_date
  ),
  final_output AS (
      SELECT
          formatted_date,
          ROUND((q1 + q2 + q3) / 3.0, 6) AS "#1_avg_q1_q2_q3",
          q2 AS "#2_q2_median",
          average AS "#3_overall_average",
          ROUND(((q1 + q2 + q3) / 3.0 + q2 + average) / 3.0, 6) AS "avg_of_#1_#2_#3"
      FROM quartiles
  ),
  normalized AS (
      SELECT *,
          ROUND("avg_of_#1_#2_#3" - (SELECT MIN("avg_of_#1_#2_#3") FROM final_output) + 1, 6) AS normalized_score
      FROM final_output
  ),
  numbered AS (
      SELECT 
          n.*,
          p.event_code
      FROM normalized n
      CROSS JOIN selected_eventRange p
  )
  UPDATE parkrun_events
  SET 
    coeff = ROUND(((COALESCE(obs, 0) * COALESCE(coeff, 0)) + (
      SELECT normalized_score
      FROM numbered
      WHERE numbered.formatted_date = 
        substr(parkrun_events.event_date, 7, 4) || char(45) || 
        substr(parkrun_events.event_date, 4, 2) || char(45) || 
        substr(parkrun_events.event_date, 1, 2)
      AND numbered.event_code = parkrun_events.event_code
    )) / (COALESCE(obs, 0) + 1), 6),
    obs = COALESCE(obs, 0) + 1
  WHERE (obs IS NULL OR obs < 16)
  AND EXISTS (
    SELECT 1
    FROM numbered
    WHERE numbered.formatted_date = 
      substr(parkrun_events.event_date, 7, 4) || char(45) || 
      substr(parkrun_events.event_date, 4, 2) || char(45) || 
      substr(parkrun_events.event_date, 1, 2)
    AND numbered.event_code = parkrun_events.event_code
  )
-- @endsection

-- @section weightedAvgTimeRatioCoeff
-- This section calculates the weighted average time ratio coefficient for a specific event and date.
-- this is an alternative coefficient calculation method to be used alongside the median based one.
WITH event_ranges AS (
  SELECT 
    pe.event_code,
    pe.event_number,
    pe.event_date,
    range.end_number,
    range.start_date
  FROM parkrun_events pe
  JOIN (
    SELECT 
      pe1.event_code,
      pe1.event_number AS end_number,
      pe1.event_date AS end_date,
      COALESCE(
        (
          SELECT pe2.event_date
          FROM parkrun_events pe2
          WHERE pe2.event_code = pe1.event_code
            AND pe2.event_number = pe1.event_number - 15
          LIMIT 1
        ),
        (
          SELECT pe3.event_date
          FROM parkrun_events pe3
          WHERE pe3.event_code = pe1.event_code
            AND pe3.event_number = 1
          LIMIT 1
        )
      ) AS start_date
    FROM parkrun_events pe1
    WHERE pe1.event_date = :event_date
  ) range ON pe.event_code = range.event_code
    AND pe.event_number BETWEEN range.end_number - 14 AND range.end_number
)
,
ratiosInEventRange1 AS (
SELECT
  ev.event_code,
  ev.event_date,
  ev.formatted_date,
  ev.athlete_code,
  ev.time,
  ev.time_seconds,
  ev.time_seconds / ev.time_ratio AS min_time_seconds,
  ev.time_ratio,
  ev.event_eligible_appearances,
  pe.event_number
FROM eventpositions_view ev
JOIN parkrun_events pe 
  ON ev.event_code = pe.event_code
  AND ev.event_date = pe.event_date
JOIN event_ranges er
  ON pe.event_code = er.event_code
  AND pe.event_number =er.event_number
 --Where athlete_code='131550'
ORDER BY ev.event_code, pe.event_number,athlete_code
)
,
athlete_weights AS (
  SELECT
    athlete_code,
    event_code,
    COUNT(*) AS weight
  FROM ratiosInEventRange1
  WHERE time_ratio < 1.1
  GROUP BY athlete_code, event_code
)
,
weighted_avg_time_ratios AS (
  SELECT
    r.formatted_date,
    r.event_code,
    SUM(CASE WHEN r.time_ratio < 1.1 THEN r.time_ratio * w.weight ELSE 0 END) / 
      NULLIF(SUM(CASE WHEN r.time_ratio < 1.1 THEN w.weight ELSE 0 END), 0) AS weighted_avg_time_ratio
  FROM ratiosInEventRange1 r
  JOIN athlete_weights w ON r.athlete_code = w.athlete_code AND r.event_code = w.event_code
  GROUP BY r.formatted_date, r.event_code
)
-- This update statement updates the parkrun_events table with the calculated weighted average time ratio coefficient.
-- It uses the weighted_avg_time_ratios CTE to get the weighted average time ratio for each event and date.
-- It updates the coeff_w and obs_w fields in the parkrun_events table. 
UPDATE parkrun_events
SET 
  coeff_w = ROUND(
    CASE
      WHEN coeff_w IS NULL THEN (
        SELECT 1 + weighted_avg_time_ratio - (
          SELECT MIN(weighted_avg_time_ratio)
          FROM weighted_avg_time_ratios
          WHERE formatted_date = substr(parkrun_events.event_date, 7, 4) || '-' || substr(parkrun_events.event_date, 4, 2) || '-' || substr(parkrun_events.event_date, 1, 2)
        )
        FROM weighted_avg_time_ratios
        WHERE weighted_avg_time_ratios.event_code = parkrun_events.event_code
          AND weighted_avg_time_ratios.formatted_date = substr(parkrun_events.event_date, 7, 4) || '-' || substr(parkrun_events.event_date, 4, 2) || '-' || substr(parkrun_events.event_date, 1, 2)
      )
      ELSE (
        (COALESCE(obs_w, 0) * COALESCE(coeff_w, 0) + (
          SELECT 1 + weighted_avg_time_ratio - (
            SELECT MIN(weighted_avg_time_ratio)
            FROM weighted_avg_time_ratios
            WHERE formatted_date = substr(parkrun_events.event_date, 7, 4) || '-' || substr(parkrun_events.event_date, 4, 2) || '-' || substr(parkrun_events.event_date, 1, 2)
          )
          FROM weighted_avg_time_ratios
          WHERE weighted_avg_time_ratios.event_code = parkrun_events.event_code
            AND weighted_avg_time_ratios.formatted_date = substr(parkrun_events.event_date, 7, 4) || '-' || substr(parkrun_events.event_date, 4, 2) || '-' || substr(parkrun_events.event_date, 1, 2)
        )) / (COALESCE(obs_w, 0) + 1)
      )
    END, 6
  ),
  obs_w = COALESCE(obs_w, 0) + 1
WHERE (obs_w IS NULL OR obs_w < 16)
  AND EXISTS (
    SELECT 1
    FROM weighted_avg_time_ratios
    WHERE weighted_avg_time_ratios.event_code = parkrun_events.event_code
      AND weighted_avg_time_ratios.formatted_date = substr(parkrun_events.event_date, 7, 4) || '-' || substr(parkrun_events.event_date, 4, 2) || '-' || substr(parkrun_events.event_date, 1, 2)
  )
-- @endsection

-- @section weightedAvgTimeRatioCoeffUpdate
-- This section updates the parkrun_events table with the calculated weighted average time ratio coefficient.
UPDATE parkrun_events
SET 
  coeff_w = ROUND(((COALESCE(obs_w, 0) * COALESCE(coeff_w, 0)) + :normalized_weighted_avg_time_ratio) / (COALESCE(obs_w, 0) + 1), 6),
  obs_w = COALESCE(obs_w, 0) + 1
WHERE event_code = :event_code
  AND substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = :formatted_date
  AND (obs_w IS NULL OR obs_w < 16)
-- @endsection

-- @section max_date_cte
-- This CTE retrieves the maximum event date from the parkrun_events_view.
max_date_cte AS (
  SELECT MAX(formatted_date) AS max_event_date
  FROM parkrun_events_view
 )
-- @endsection

-- @section max_event_row
-- This CTE retrieves the maximum event row from the parkrun_events_view based on the maximum event date.
-- DEPENDENCIES: max_date_cte; 
max_event_row AS (
  SELECT coeff, obs, coeff_event
  FROM parkrun_events_view
  JOIN max_date_cte ON parkrun_events_view.formatted_date = max_date_cte.max_event_date
 )
-- @endsection

-- @section final_maxFlag_select
-- This TAIL checks if all values in the maximum event row are NULL.
-- If all values are NULL, it returns 'TRUE', otherwise 'FALSE'.
-- DEPENDENCIES: max_event_row; 
SELECT 
    CASE 
      WHEN coeff IS NULL AND obs IS NULL AND coeff_event IS NULL THEN 'TRUE'
      ELSE 'FALSE'
    END AS is_all_null
  FROM max_event_row
  LIMIT 1
-- @endsection

-- @section final_getEvents
SELECT event_number, event_date, coeff, obs,coeff_event
  FROM parkrun_events
  WHERE event_code = :event_code
    AND event_number >= 15
    AND event_number <= 10000
  ORDER BY event_number DESC
-- @endsection

-- @section final_getEventDates
SELECT DISTINCT formatted_date AS event_date
  FROM parkrun_events_view
  ORDER BY event_date
-- @endsection

-- @section final_AvgTimePerEvent
  SELECT event_code,
      (SELECT AVG(time_seconds)
        FROM eventpositions_view
        WHERE eventpositions_view.event_code = pe.event_code
          AND eventpositions_view.event_date = pe.event_date
          AND time_seconds IS NOT NULL) as avg_time,
      (SELECT AVG(time_seconds)
        FROM eventpositions_view
        WHERE eventpositions_view.event_code = pe.event_code
          AND eventpositions_view.event_date = pe.event_date
          AND time_seconds IS NOT NULL
          AND time_ratio < 1.12) as avgTimeLim12,
      (SELECT AVG(time_seconds)
        FROM eventpositions_view
        WHERE eventpositions_view.event_code = pe.event_code
          AND eventpositions_view.event_date = pe.event_date
          AND time_seconds IS NOT NULL
          AND time_ratio < 1.05) as avgTimeLim5
    FROM parkrun_events pe
    WHERE substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = :event_date
    GROUP BY event_code
-- @endsection

-- @section final_TouristCalc
-- This section calculates average times for events on a specific date.
WITH selected_RangeOf15Weeks AS (
  SELECT 
    MAX(pe2.formatted_date) AS start_date,
    pe1.formatted_date AS end_date
  FROM parkrun_events_view pe1
  JOIN parkrun_events_view pe2  
    ON pe1.event_code = pe2.event_code
    AND pe2.event_number = pe1.event_number - 15
  WHERE pe1.formatted_date = :formatted_date
)
, date_range AS (
  SELECT start_date, end_date FROM selected_RangeOf15Weeks
)
,
AthletesInRange AS (
SELECT
  ep.event_code,
  ep.event_date,
  ep.formatted_date,
  ep.time,
  ep.time_seconds,
  ep.athlete_code,
  ep.time_ratio
FROM eventpositions_view ep
CROSS JOIN date_range dr
WHERE ep.formatted_date BETWEEN dr.start_date AND dr.end_date
ORDER BY ep.athlete_code, ep.formatted_date
  ),
  athletesStatsRange AS (
    SELECT
      athlete_code,
      COUNT(DISTINCT event_code) AS event_code_count,
      COUNT(*) AS recent_appearances
    FROM AthletesInRange
    GROUP BY athlete_code
  ),
  AthletesWithAdjTime AS (
    SELECT
      ep.*,
    ep.formatted_date,
      pev.coeff,
      pev.coeff_event,
      ep.time_seconds / pev.coeff / pev.coeff_event AS adj_time_seconds
    FROM AthletesInRange ep
    JOIN parkrun_events pev
      ON ep.event_code = pev.event_code
      AND ep.event_date = pev.event_date
    JOIN athletesStatsRange asr
      ON ep.athlete_code = asr.athlete_code
  --	WHERE ep.athlete_code = '528017'
  )
  , final AS (
    SELECT
      a.athlete_code,
      a.event_code,
      a.event_date,
      a.formatted_date,
      a.time,
      a.time_seconds,
      a.coeff,
      a.coeff_event,
      a.adj_time_seconds,
      asr.recent_appearances,
      asr.event_code_count,
      a.time_ratio,
      a.adj_time_seconds / MIN(a.adj_time_seconds) OVER (PARTITION BY a.athlete_code) AS adj_time_ratio,
      CASE WHEN asr.event_code_count > 1 THEN 'T' ELSE '' END AS tourist_flag -- only simple tourist flag - see next SQL section
    FROM AthletesWithAdjTime a
    JOIN athletesStatsRange asr ON a.athlete_code = asr.athlete_code
    --WHERE asr.event_code_count > 1
  )
  SELECT *
  FROM final
  WHERE final.event_date=:event_date
  ORDER BY athlete_code, formatted_date
-- @endsection

-- @section final_AvgTimePerEvent
  SELECT event_code,
      (SELECT AVG(time_seconds)
        FROM eventpositions_view
        WHERE eventpositions_view.event_code = pe.event_code
          AND eventpositions_view.event_date = pe.event_date
          AND time_seconds IS NOT NULL) as avg_time,
      (SELECT AVG(time_seconds)
        FROM eventpositions_view
        WHERE eventpositions_view.event_code = pe.event_code
          AND eventpositions_view.event_date = pe.event_date
          AND time_seconds IS NOT NULL
          AND time_ratio < 1.12) as avgTimeLim12,
      (SELECT AVG(time_seconds)
        FROM eventpositions_view
        WHERE eventpositions_view.event_code = pe.event_code
          AND eventpositions_view.event_date = pe.event_date
          AND time_seconds IS NOT NULL
          AND time_ratio < 1.05) as avgTimeLim5
    FROM parkrun_events pe
    WHERE substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = :event_date
    GROUP BY event_code
-- @endsection

-- @section final_TouristFlag
-- This section flags athletes as tourists based on their event participation.
-- Also identifies athletes with only one event in the date range as a 'first-time participant'
WITH athlete_runs AS (
  SELECT   event_code,event_date,formatted_date,position,name,male_position,male_count,age_group,age_grade,time,club,comment,athlete_code,event_eligible_appearances,time_ratio,
           time_seconds,adj_time_seconds,adj_time_ratio,event_code_count,
           COUNT(*) OVER (PARTITION BY athlete_code, event_code) AS last_event_code_count,
           COUNT(*) OVER (PARTITION BY athlete_code) AS total_runs,
           MAX(formatted_date) OVER (PARTITION BY athlete_code) AS max_date
  FROM eventpositions_view
  WHERE formatted_date BETWEEN :start_date AND :end_date
),
athletes_on_max_date AS (
  SELECT DISTINCT athlete_code
  FROM athlete_runs
  WHERE max_date = :end_date
),
max_code_count AS (
  SELECT athlete_code, MAX(last_event_code_count) AS max_count
  FROM athlete_runs
  WHERE athlete_code IN (SELECT athlete_code FROM athletes_on_max_date)
  GROUP BY athlete_code
)
SELECT ar.*,
  CASE
    WHEN ar.last_event_code_count = 1
         AND ar.formatted_date = ar.max_date
         AND NOT EXISTS (
           SELECT 1 FROM athlete_runs ar2
           WHERE ar2.athlete_code = ar.athlete_code
             AND ar2.event_code <> ar.event_code
         )
      THEN 'F'
    WHEN (ar.last_event_code_count < mcc.max_count) or
		     (mcc.max_count=1 and ar.event_code_count>1) THEN 'T'
    ELSE ''
  END AS tourist_flag
FROM athlete_runs ar
JOIN max_code_count mcc ON ar.athlete_code = mcc.athlete_code
WHERE ar.formatted_date = ar.max_date
  AND ar.max_date = :end_date
  --and total_runs>5
ORDER BY ar.athlete_code, ar.formatted_date
-- @endsection

-- @section final_AgeCalculation
-- This section calculates the earliest and latest possible dates of birth (DOB) for athletes based on their age categories and event participation.
-- It uses Common Table Expressions (CTEs) to filter events, map ages to categories,
-- detect age changes, infer DOB ranges, and summarize the results.

  WITH  -- 1) restrict eventpositions to the date window for performance
filtered_events AS (
  SELECT *
  FROM eventpositions_view
  WHERE formatted_date BETWEEN date(:start_date) AND date(:end_date)  -- << replace start/end here
)
, -- 2) find ages mapped to categories (same method you already have)
athlete_ages AS (
  SELECT
    epv.athlete_code,
    epv.formatted_date,
    ac.age,
    ROUND(
      CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
  FROM filtered_events epv
  JOIN age_category ac
    ON epv.age_group = ac.age_group
   AND ROUND(
       CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50
     , 0) BETWEEN ac.lower_bound AND ac.upper_bound
	--where epv.athlete_code='10007387'
)
,-- 3) detect successive age observations so we can infer dob ranges
age_changes AS (
  SELECT
    athlete_code,
    formatted_date,
    age,
    LAG(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age,
    LAG(formatted_date) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_date
  FROM athlete_ages
)
,-- 4) convert observed ages -> earliest/ latest possible DOBs per observation pair
dob_ranges AS (  -- 4a) existing two-observation logic (when we have a previous age/date)
  SELECT
    athlete_code,
    prev_date,
    formatted_date,
    prev_age,
    age,
    DATE(prev_date, '+1 day', '-' || (prev_age + 1) || ' years') AS latest_possible_dob,   -- youngest possible DOB from the previous observation
    DATE(formatted_date, '-' || age || ' years') AS earliest_possible_dob               -- oldest possible DOB from the later observation
  FROM age_changes
  WHERE prev_age IS NOT NULL
  UNION ALL
  -- 4b) single-observation logic (no previous observation) -> DOB window ~ 1 year
  -- If we only see one observation (no LAG), the DOB must lie between:
  --   DATE(formatted_date, '-' || (age + 1) || ' years', '+1 day')  (oldest possible)  and
  --   DATE(formatted_date, '-' || age || ' years')                 (youngest possible)
  SELECT
    athlete_code,
    NULL                 AS prev_date,
    formatted_date,
    NULL                 AS prev_age,
    age,  -- youngest possible DOB (the later date)
    DATE(formatted_date, '-' || age || ' years') AS latest_possible_dob,  -- oldest possible DOB (about one year earlier)
    DATE(formatted_date, '-' || (age + 1) || ' years', '+1 day') AS earliest_possible_dob
  FROM age_changes
  WHERE prev_age IS NULL
)
,-- 5) collapse per-athlete to a single DOB window
dob_summary AS (
  SELECT
    athlete_code,
    MAX(latest_possible_dob)   AS latest_possible_dob,   -- corresponds to max_dob (youngest possible)
    MIN(earliest_possible_dob) AS earliest_possible_dob  -- corresponds to min_dob (oldest possible)
  FROM dob_ranges
  GROUP BY athlete_code
)
,-- 6) latest event date (last_updated) for each athlete in the window
latest_events AS (
  SELECT athlete_code, MAX(formatted_date) AS last_updated
  FROM filtered_events
  GROUP BY athlete_code
),-- 7) club at the latest event (pick the club for the max date)
latest_club AS (
  SELECT fe.athlete_code, fe.club
  FROM filtered_events fe
  JOIN latest_events le
    ON fe.athlete_code = le.athlete_code
   AND fe.formatted_date = le.last_updated
)
,-- 8) final per-athlete values (coalesce computed dob window with existing values if no new dob info)
athlete_updates AS (
  SELECT
    aco.athlete_code, -- prefer computed summary dob if available; otherwise keep existing athletes table values (correlation will use these)
    ds.earliest_possible_dob  AS candidate_min_dob,
    ds.latest_possible_dob    AS candidate_max_dob,
    le.last_updated,
    lc.club
  FROM latest_events le
  LEFT JOIN dob_summary ds ON ds.athlete_code = le.athlete_code
  LEFT JOIN latest_club lc   ON lc.athlete_code = le.athlete_code
  -- aco is used for athlete_code list, derive from latest_events
  JOIN (SELECT athlete_code AS athlete_code FROM latest_events) aco ON aco.athlete_code = le.athlete_code
),
final_updates AS (
    SELECT
      a.athlete_code,-- determine final_min_dob: choose the later date (i.e. move min forward) only if candidate narrows
      CASE
        WHEN ds.earliest_possible_dob IS NULL THEN a.min_dob
        WHEN a.min_dob IS NULL THEN ds.earliest_possible_dob
        WHEN date(ds.earliest_possible_dob) > date(a.min_dob) THEN ds.earliest_possible_dob
        ELSE a.min_dob
      END AS final_min_dob, -- determine final_max_dob: choose the earlier date (i.e. move max backward) only if candidate narrows
      CASE
        WHEN ds.latest_possible_dob IS NULL THEN a.max_dob
        WHEN a.max_dob IS NULL THEN ds.latest_possible_dob
        WHEN date(ds.latest_possible_dob) < date(a.max_dob) THEN ds.latest_possible_dob
        ELSE a.max_dob
      END AS final_max_dob,  -- last_updated and club from latest_events/latest_club if present, otherwise keep existing
      COALESCE(le.last_updated, a.last_updated) AS final_last_updated,
      COALESCE(lc.club, a.club)           AS final_club
    FROM athletes a
    LEFT JOIN dob_summary ds ON ds.athlete_code = a.athlete_code
    LEFT JOIN latest_events le ON le.athlete_code = a.athlete_code
    LEFT JOIN latest_club   lc ON lc.athlete_code = a.athlete_code  -- limit to athletes that have recent events if desired:
    WHERE a.athlete_code IN (SELECT athlete_code FROM latest_events)
  )
-- Perform the UPDATE using correlated subqueries against the CTEs above.
UPDATE athletes
SET
  min_dob = (SELECT final_min_dob FROM final_updates fu WHERE fu.athlete_code = athletes.athlete_code),
  max_dob = (SELECT final_max_dob FROM final_updates fu WHERE fu.athlete_code = athletes.athlete_code),
  last_updated = (SELECT final_last_updated FROM final_updates fu WHERE fu.athlete_code = athletes.athlete_code),
  club = (SELECT final_club FROM final_updates fu WHERE fu.athlete_code = athletes.athlete_code),

  -- last_age_estimate: midpoint fractional age at final_last_updated (handles single/missing DOBs)
  last_age_estimate = (
    SELECT
      CASE
        WHEN fu.final_last_updated IS NULL THEN NULL
        WHEN fu.final_min_dob IS NULL AND fu.final_max_dob IS NULL THEN NULL
        WHEN fu.final_min_dob IS NULL THEN ROUND((julianday(date(fu.final_last_updated)) - julianday(fu.final_max_dob)) / 365.2425, 2)
        WHEN fu.final_max_dob IS NULL THEN ROUND((julianday(date(fu.final_last_updated)) - julianday(fu.final_min_dob)) / 365.2425, 2)
        ELSE ROUND(
               (
                 (julianday(date(fu.final_last_updated)) - julianday(fu.final_max_dob))
               + (julianday(date(fu.final_last_updated)) - julianday(fu.final_min_dob))
               ) / (2.0 * 365.2425)
             , 2)
      END
    FROM final_updates fu
    WHERE fu.athlete_code = athletes.athlete_code
  )
WHERE athlete_code IN (SELECT athlete_code FROM final_updates);

-- 2) Recalculate current_age_estimate for ALL athletes using stored min_dob/max_dob (today),
--    but never let current be smaller than stored last_age_estimate.
UPDATE athletes
SET current_age_estimate = (
  -- compute unrounded current_calc (fractional) then apply clamp vs last_age_estimate
  SELECT
    CASE
      WHEN current_calc IS NULL AND last_age_estimate IS NULL THEN NULL
      WHEN current_calc IS NULL THEN ROUND(last_age_estimate, 2)
      WHEN last_age_estimate IS NULL THEN ROUND(current_calc, 2)
      WHEN current_calc < last_age_estimate THEN ROUND(last_age_estimate, 2)
      ELSE ROUND(current_calc, 2)
    END
  FROM (
    SELECT
      -- current_calc (unrounded) based on stored min/max DOB at today
      CASE
        WHEN a.min_dob IS NULL AND a.max_dob IS NULL THEN NULL
        WHEN a.min_dob IS NULL THEN (julianday(date('now')) - julianday(a.max_dob)) / 365.2425
        WHEN a.max_dob IS NULL THEN (julianday(date('now')) - julianday(a.min_dob)) / 365.2425
        ELSE ((julianday(date('now')) - julianday(a.max_dob)) + (julianday(date('now')) - julianday(a.min_dob))) / (2.0 * 365.2425)
      END AS current_calc
    FROM athletes a
    WHERE a.athlete_code = athletes.athlete_code
  )
)
-- @endsection

-- @section tmp_final_updates
-- Build a temp table of final per-athlete values that includes:
--  * existing athletes that have update candidates (from tmp_athlete_updates)
--  * new athlete codes introduced in tmp_athlete_updates but not yet present in athletes
DROP TABLE IF EXISTS tmp_final_updates;
CREATE TEMP TABLE tmp_final_updates AS
-- 1) existing athletes (merge dob summary and latest event/club where available)
SELECT
  a.athlete_code,
  CASE
    WHEN ds.earliest_possible_dob IS NULL THEN a.min_dob
    WHEN a.min_dob IS NULL THEN ds.earliest_possible_dob
    WHEN date(ds.earliest_possible_dob) > date(a.min_dob) THEN ds.earliest_possible_dob
    ELSE a.min_dob
  END AS final_min_dob,
  CASE
    WHEN ds.latest_possible_dob IS NULL THEN a.max_dob
    WHEN a.max_dob IS NULL THEN ds.latest_possible_dob
    WHEN date(ds.latest_possible_dob) < date(a.max_dob) THEN ds.latest_possible_dob
    ELSE a.max_dob
  END AS final_max_dob,
  COALESCE(lc.last_updated, a.last_updated) AS final_last_updated,
  COALESCE(lc.club, a.club)           AS final_club
FROM athletes a
LEFT JOIN dob_summary ds ON ds.athlete_code = a.athlete_code
LEFT JOIN latest_events le ON le.athlete_code = a.athlete_code
LEFT JOIN latest_club   lc ON lc.athlete_code = a.athlete_code
WHERE a.athlete_code IN (SELECT athlete_code FROM tmp_athlete_updates)

UNION ALL

-- 2) new athletes (present in tmp_athlete_updates but not yet in athletes)
SELECT
  ta.athlete_code,
  ds.earliest_possible_dob AS final_min_dob,
  ds.latest_possible_dob   AS final_max_dob,
  COALESCE(ta.last_updated, (SELECT last_updated FROM latest_events le2 WHERE le2.athlete_code = ta.athlete_code)) AS final_last_updated,
  ta.club AS final_club
FROM tmp_athlete_updates ta
LEFT JOIN dob_summary ds ON ds.athlete_code = ta.athlete_code
WHERE ta.athlete_code NOT IN (SELECT athlete_code FROM athletes);

CREATE INDEX IF NOT EXISTS idx_tmp_final_updates ON tmp_final_updates(athlete_code);
-- @endsection

-- @section final_AvgAgePerEvent
-- This section calculates and updates the average age of participants for recent events where avg_age is NULL.
-- It uses temporary tables to store the dates to fix and the computed averages, and then updates the parkrun_events table accordingly.
-- 1) ensure avg_age column exists
  -- 3a) pick the N most recent dates that still have avg_age NULL
CREATE TEMP TABLE _dates_to_fix(event_date TEXT);
INSERT INTO _dates_to_fix(event_date)
SELECT event_date
FROM parkrun_events
WHERE avg_age IS NULL
ORDER BY substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) DESC
LIMIT 10;  -- change 10 to however many weeks you want to process

-- 3b) compute averages once for those dates
CREATE TEMP TABLE _avg_for_events(event_code INTEGER, event_date TEXT, avg_age REAL);
INSERT INTO _avg_for_events(event_code,event_date,avg_age)
SELECT
  ep.event_code,
  ep.event_date,
  ROUND(AVG(
    CASE
      WHEN (a.min_dob IS NOT NULL OR a.max_dob IS NOT NULL) THEN
        (
          julianday(substr(ep.event_date,7,4)||'-'||substr(ep.event_date,4,2)||'-'||substr(ep.event_date,1,2))
          -
          CASE
            WHEN a.min_dob IS NOT NULL AND a.max_dob IS NOT NULL THEN (julianday(a.min_dob)+julianday(a.max_dob))/2.0
            WHEN a.min_dob IS NOT NULL THEN julianday(a.min_dob)
            WHEN a.max_dob IS NOT NULL THEN julianday(a.max_dob)
          END
        )/365.25
      WHEN a.current_age_estimate IS NOT NULL THEN (CAST(a.current_age_estimate AS REAL) - ((julianday('now') - julianday(substr(ep.event_date,7,4)||'-'||substr(ep.event_date,4,2)||'-'||substr(ep.event_date,1,2)))/365.25))
      ELSE NULL
    END
  ),2) AS avg_age
FROM eventpositions ep
JOIN athletes a ON a.athlete_code = ep.athlete_code
WHERE ep.event_date IN (SELECT event_date FROM _dates_to_fix)
GROUP BY ep.event_code, ep.event_date;

-- 3c) update parkrun_events only where avg_age is NULL and a computed value exists
UPDATE parkrun_events
SET avg_age = (
  SELECT avg_age FROM _avg_for_events t
  WHERE t.event_code = parkrun_events.event_code
    AND t.event_date = parkrun_events.event_date
)
WHERE avg_age IS NULL
  AND event_date IN (SELECT event_date FROM _dates_to_fix)
  AND EXISTS (
    SELECT 1 FROM _avg_for_events t
    WHERE t.event_code = parkrun_events.event_code
      AND t.event_date = parkrun_events.event_date
  );

-- cleanup temp tables (optional; they drop on connection close)
DROP TABLE IF EXISTS _avg_for_events;
DROP TABLE IF EXISTS _dates_to_fix;
-- @endsection


-- @section final_regularAthletesCount
-- This section counts the number of athletes who have participated in more than 9 events for each event as of the maximum event date '2025-08-30'.
-- It creates temporary tables to store athletes on the maximum date and their maximum event counts, then performs the final count and cleanup.
-- Create temporary tables to hold intermediate results
-- Update parkrun_events.regulars for a supplied :formatted_date using a lookback window (default 15 weeks)
-- For each event_code present on :formatted_date, count athletes who (a) appear on :formatted_date and
-- (b) have >=10 appearances with adj_time_ratio < 1.1 within the lookback window [start_date, :formatted_date].
-- Writes the result into parkrun_events.regulars for matching event_code and event_date.

WITH params AS (
  SELECT :formatted_date AS end_date,
         date(:formatted_date, '-105 days') AS start_date  -- 15 weeks ~= 105 days
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
),
regulars_per_event AS (
  SELECT event_code, COUNT(*) AS regulars
  FROM qualifying_counts
  WHERE qual_count >= 10
  GROUP BY event_code
)
-- SQLite-compatible update: set regulars from correlated subquery where a matching row exists
UPDATE parkrun_events
SET regulars = (
  SELECT r.regulars FROM regulars_per_event r WHERE r.event_code = parkrun_events.event_code
)
WHERE EXISTS (
  SELECT 1 FROM regulars_per_event r WHERE r.event_code = parkrun_events.event_code
)
AND substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) = (SELECT end_date FROM params LIMIT 1);

-- Note: This updates only parkrun_events rows for which an event exists on the supplied :formatted_date.
-- @endsection

-- @section final_superTourist
-- This section identifies "super tourists" - athletes who have participated in at least 10 different events in the past year
-- but have only participated in 2 or fewer events at their most recent event.
WITH period_rows AS (
  SELECT *
  FROM eventpositions_view
  WHERE formatted_date BETWEEN date(:formatted_date,'-1 year') AND date(:formatted_date)
),
-- pick one end-day row per athlete (tie-break by time_seconds)
end_ranked AS (
  SELECT
    athlete_code,
    last_event_code_count,
    event_code,
    event_date,
    ROW_NUMBER() OVER (PARTITION BY athlete_code ORDER BY COALESCE(time_seconds,0) DESC) AS rn
  FROM period_rows
  WHERE formatted_date = date(:formatted_date)
),
end_day AS (
  SELECT athlete_code, last_event_code_count, event_code, event_date
  FROM end_ranked
  WHERE rn = 1
),
period_rows_filtered AS (
  SELECT *
  FROM period_rows
  WHERE athlete_code IN (SELECT athlete_code FROM end_day)
),
winners AS (
  SELECT
    pr.athlete_code,
    COUNT(DISTINCT pr.event_code)           AS distinct_courses,
    date(:formatted_date)                      AS last_date,
    COALESCE(ed.last_event_code_count, 0)   AS last_event_count,
    ed.event_code                            AS last_code,
    ed.event_date                            AS update_date
  FROM period_rows_filtered pr
  LEFT JOIN end_day ed USING (athlete_code)
  GROUP BY pr.athlete_code
  HAVING distinct_courses >= 10
     AND COALESCE(ed.last_event_code_count, 9999) <= 2
)
UPDATE eventpositions
SET super_tourist = (
  SELECT w.distinct_courses
  FROM winners w
  WHERE w.athlete_code = eventpositions.athlete_code
    AND w.last_code = eventpositions.event_code
    AND w.update_date = eventpositions.event_date
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM winners w
  WHERE w.athlete_code = eventpositions.athlete_code
    AND w.last_code = eventpositions.event_code
    AND w.update_date = eventpositions.event_date
);
  -- @endsection

-- @section final_superTouristCount
-- This section counts the number of super tourists for each event within a specified date range and updates the parkrun_events table accordingly.
-- It uses a subquery to count the number of athletes marked as super tourists for each event
DROP TABLE IF EXISTS tmp_counts;
CREATE TEMP TABLE tmp_counts AS
SELECT event_code, formatted_date, COUNT(*) AS cnt
FROM eventpositions_view
WHERE super_tourist > 0
  AND formatted_date BETWEEN :start_date AND :end_date
GROUP BY event_code, formatted_date;

UPDATE parkrun_events
SET super_tourist_count = (
  SELECT cnt FROM tmp_counts t
  WHERE t.event_code = parkrun_events.event_code
    AND t.formatted_date = (substr(parkrun_events.event_date,7,4) || '-' || substr(parkrun_events.event_date,4,2) || '-' || substr(parkrun_events.event_date,1,2))
)
WHERE EXISTS (
  SELECT 1 FROM tmp_counts t
  WHERE t.event_code = parkrun_events.event_code
    AND t.formatted_date = (substr(parkrun_events.event_date,7,4) || '-' || substr(parkrun_events.event_date,4,2) || '-' || substr(parkrun_events.event_date,1,2))
);

DROP TABLE tmp_counts;
    -- @endsection

-- @section final_event_counts_update
-- Add these columns to parkrun_events if they do not already exist (run once).
-- Note: SQLite will error if the column already exists; run these only if needed.
-- ALTER TABLE parkrun_events ADD COLUMN first_timers_count INTEGER DEFAULT 0;
-- ALTER TABLE parkrun_events ADD COLUMN returners_count INTEGER DEFAULT 0;
-- ALTER TABLE parkrun_events ADD COLUMN club_count INTEGER DEFAULT 0;
-- ALTER TABLE parkrun_events ADD COLUMN pb_count INTEGER DEFAULT 0;
-- ALTER TABLE parkrun_events ADD COLUMN recentBest_count INTEGER DEFAULT 0;
-- ALTER TABLE parkrun_events ADD COLUMN eligible_time_count INTEGER DEFAULT 0;

-- Compute per-event/date counts from eventpositions_view and update parkrun_events
-- Build counts for a single formatted_date (YYYY-MM-DD) passed as :formatted_date
DROP TABLE IF EXISTS tmp_event_counts;
CREATE TEMP TABLE tmp_event_counts AS
SELECT
  event_code,
  formatted_date,
  SUM(CASE WHEN comment = 'First Timer!' THEN 1 ELSE 0 END) AS first_timers_count,
  SUM(CASE WHEN tourist_flag = 'F' AND (comment IS NULL OR comment <> 'First Timer!') THEN 1 ELSE 0 END) AS returners_count,
  SUM(CASE WHEN TRIM(COALESCE(club, '')) <> '' THEN 1 ELSE 0 END) AS club_count,
  SUM(CASE WHEN comment = 'New PB!' THEN 1 ELSE 0 END) AS pb_count,
  SUM(CASE WHEN adj_time_ratio = 1 AND event_eligible_appearances > 3 THEN 1 ELSE 0 END) AS recentBest_count,
  SUM(CASE WHEN adj_time_ratio < 1.05 AND event_eligible_appearances > 3 THEN 1 ELSE 0 END) AS eligible_time_count
FROM eventpositions_view
WHERE formatted_date = :formatted_date
  -- optionally restrict to a single event_code if provided
  AND (:event_code IS NULL OR event_code = :event_code)
GROUP BY event_code, formatted_date;

-- Update only the parkrun_events row(s) matching the supplied formatted_date (and optional event_code)
UPDATE parkrun_events
SET
  first_timers_count = (SELECT t.first_timers_count FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date),
  returners_count = (SELECT t.returners_count FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date),
  club_count = (SELECT t.club_count FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date),
  pb_count = (SELECT t.pb_count FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date),
  recentBest_count = (SELECT t.recentBest_count FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date),
  eligible_time_count = (SELECT t.eligible_time_count FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date)
WHERE substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) = :formatted_date
  AND (:event_code IS NULL OR parkrun_events.event_code = :event_code)
  AND EXISTS (
    SELECT 1 FROM tmp_event_counts t WHERE t.event_code = parkrun_events.event_code AND t.formatted_date = :formatted_date
  );

-- Cleanup
DROP TABLE IF EXISTS tmp_event_counts;
-- @endsection

-- @section final_unknowns_update
-- Compute number of missing (unknown) positions for each event on a supplied :event_date
-- and update parkrun_events.unknown_count accordingly.
-- Run once to add column if needed (remove comment and execute only if the column doesn't exist):
-- ALTER TABLE parkrun_events ADD COLUMN unknown_count INTEGER DEFAULT 0;

-- Build per-event unknown counts for the supplied event_date (stored format, e.g. '11/10/2025')
DROP TABLE IF EXISTS tmp_unknowns;
CREATE TEMP TABLE tmp_unknowns AS
SELECT
  ep.event_code,
  ep.event_date,
  COALESCE(pe.last_position,
    (SELECT MAX(position) FROM eventpositions ep2
     WHERE ep2.event_code = ep.event_code AND ep2.event_date = ep.event_date)
  ) AS expected_max,
  COUNT(*) AS actual_count,
  (COALESCE(pe.last_position,
    (SELECT MAX(position) FROM eventpositions ep3
     WHERE ep3.event_code = ep.event_code AND ep3.event_date = ep.event_date)
  ) - COUNT(*)) AS unknown_count
FROM eventpositions ep
LEFT JOIN parkrun_events pe ON ep.event_code = pe.event_code AND ep.event_date = pe.event_date
WHERE substr(ep.event_date,7,4) || '-' || substr(ep.event_date,4,2) || '-' || substr(ep.event_date,1,2) = :event_date
GROUP BY ep.event_code, ep.event_date;

-- Update parkrun_events.unknown_count only for rows that have a matching computed value
UPDATE parkrun_events
SET unknown_count = (
  SELECT t.unknown_count FROM tmp_unknowns t
  WHERE t.event_date = parkrun_events.event_date
    AND t.event_code = parkrun_events.event_code
)
WHERE substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) = :event_date
  AND EXISTS (
    SELECT 1 FROM tmp_unknowns t
    WHERE t.event_date = parkrun_events.event_date
      AND t.event_code = parkrun_events.event_code
  );

DROP TABLE IF EXISTS tmp_unknowns;
-- @endsection

-- @section final_regulars_new_update
-- This section computes and updates the count of new regular athletes for each event on a specified date.
-- Create a temporary table to hold the counts of new regular athletes per event
-- start here	
DROP TABLE IF EXISTS tmp_params;
CREATE TEMP TABLE tmp_params(end_date TEXT, start_date TEXT);
INSERT INTO tmp_params(end_date, start_date)
VALUES (:start_date, date(:start_date, '-105 days'));
-- 1) materialize the event window into a temp table
DROP TABLE IF EXISTS tmp_event_window;
CREATE TEMP TABLE tmp_event_window AS
SELECT *
FROM eventpositions_view
WHERE formatted_date BETWEEN (SELECT start_date FROM tmp_params) AND (SELECT end_date FROM tmp_params);
--
CREATE INDEX IF NOT EXISTS idx_tmp_evt_window_date ON tmp_event_window(formatted_date);
CREATE INDEX IF NOT EXISTS idx_tmp_evt_window_ath ON tmp_event_window(athlete_code);
CREATE INDEX IF NOT EXISTS idx_tmp_evt_window_ec ON tmp_event_window(event_code);
-- 2) compute qualifying counts
DROP TABLE IF EXISTS tmp_athletes_on_date;
CREATE TEMP TABLE tmp_athletes_on_date AS
  SELECT DISTINCT event_code, athlete_code
  FROM tmp_event_window
  WHERE formatted_date = (SELECT end_date FROM tmp_params);
DROP TABLE IF EXISTS tmp_qualifying_counts;
CREATE TEMP TABLE tmp_qualifying_counts AS
--  qualifying_counts AS (
  SELECT ep.event_code, ep.athlete_code, COUNT(*) AS qual_count
  FROM tmp_event_window ep
  JOIN tmp_athletes_on_date aod ON ep.event_code = aod.event_code AND ep.athlete_code = aod.athlete_code
  WHERE ep.adj_time_ratio < 1.1
  GROUP BY ep.event_code, ep.athlete_code;
DROP TABLE IF EXISTS tmp_regulars_per_event;
CREATE TEMP TABLE tmp_regulars_per_event AS
--  regulars_per_event AS (
	SELECT event_code, COUNT(*) AS regulars FROM tmp_qualifying_counts WHERE qual_count >= 10 GROUP BY event_code;
-- 3) perform the update
UPDATE parkrun_events 
	SET regulars = COALESCE( (
		SELECT r.regulars FROM tmp_regulars_per_event r 
		WHERE r.event_code = parkrun_events.event_code), 0 ) 
	WHERE substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) = (SELECT end_date FROM tmp_params LIMIT 1);
--select event_code,regulars from parkrun_events 
--where substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2)=
--	(SELECT end_date FROM tmp_params LIMIT 1) 
--order by event_code;
-- cleanup
DROP INDEX IF EXISTS idx_tmp_evt_window_date;
DROP INDEX IF EXISTS idx_tmp_evt_window_ath;
DROP INDEX IF EXISTS idx_tmp_evt_window_ec;
DROP TABLE IF EXISTS tmp_event_window;
DROP TABLE IF EXISTS tmp_regulars_per_event;
DROP TABLE IF EXISTS tmp_qualifying_counts;
DROP TABLE IF EXISTS tmp_regulars_per_event;
DROP TABLE IF EXISTS tmp_params;
-- @endsection