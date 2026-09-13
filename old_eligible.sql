WITH
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
   WHERE pe1.event_code = 1 AND pe1.event_number = 465
 )
,
athletesInEventRange AS (
  SELECT ep.event_code,ep.event_date,ep.time,ep.time_seconds,ep.athlete_code,pe.event_number, ep.formatted_date
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
  WHERE athletesInEventRange.event_code = 1
  AND formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  GROUP BY athlete_code
  HAVING COUNT(*) > 1
       )
	   ,
ratiosInEventRange AS (
  SELECT pe.athlete_code,pe.formatted_date,pe.time_seconds,ast.min_time_seconds,
      CAST(pe.time_seconds AS REAL) / ast.min_time_seconds AS time_ratio
  FROM athletesInEventRange pe
  JOIN athletesStatsInEventRange ast ON pe.athlete_code = ast.athlete_code
  CROSS JOIN selected_eventRange
  WHERE pe.event_code = 1
  AND pe.formatted_date BETWEEN selected_eventRange.start_date AND selected_eventRange.end_date
  AND CAST(pe.time_seconds AS REAL) / ast.min_time_seconds <= 1.2
  order by pe.formatted_date,pe.athlete_code
 )
 ,
 ranked AS (
      SELECT *,
          ROW_NUMBER() OVER (PARTITION BY formatted_date ORDER BY time_ratio) AS rn,
          COUNT(*) OVER (PARTITION BY formatted_date) AS cnt
      FROM ratiosInEventRange
  )
  ,
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
  )
  ,
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
  select * from numbered