WITH selected_eventRange AS ( 
	SELECT '2025-10-18' AS end_date, date('2025-10-18', '-105 days') 
	AS start_date 
),
WITH
athletes_on_date AS (
  SELECT DISTINCT ep.event_code, ep.athlete_code
  FROM eventpositions_view ep
  JOIN selected_eventRange p ON ep.formatted_date = p.end_date
),
qualifying_counts AS (
  SELECT
    ep.event_code,
    ep.athlete_code,
    COUNT(*) AS qual_count
  FROM eventpositions_view ep
  JOIN selected_eventRange p ON ep.formatted_date BETWEEN p.start_date AND p.end_date
  JOIN athletes_on_date aod ON ep.event_code = aod.event_code AND ep.athlete_code = aod.athlete_code
  WHERE ep.adj_time_ratio < 1.1
  GROUP BY ep.event_code, ep.athlete_code
)
--,
--regulars_per_event AS (
  SELECT event_code, COUNT(*) AS regulars
  FROM qualifying_counts
  WHERE qual_count >= 10
  GROUP BY event_code
)


select * from selected_eventRange