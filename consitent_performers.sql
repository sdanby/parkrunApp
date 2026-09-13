--  CONSISTENT PERFORMERS

CREATE TEMP TABLE athletes_on_max_date AS
SELECT event_code, athlete_code
FROM eventpositions_view
WHERE formatted_date = '2025-08-30';

CREATE TEMP TABLE qualifying_athletes AS
SELECT
  ep.event_code,
  ep.athlete_code,
  ep.name,
  COUNT(*) AS qualifying_count
FROM eventpositions_view ep
JOIN athletes_on_max_date amd
  ON ep.event_code = amd.event_code AND ep.athlete_code = amd.athlete_code
WHERE ep.formatted_date BETWEEN '2025-05-17' AND '2025-08-30'
  AND ep.adj_time_ratio < 1.1
GROUP BY ep.event_code, ep.athlete_code, ep.name;
  
SELECT event_code, COUNT(*) AS num_athletes
FROM qualifying_athletes
WHERE qualifying_count >= 10
GROUP BY event_code
ORDER BY event_code;

SELECT * 
FROM qualifying_athletes
WHERE qualifying_count >= 10
AND event_code=1

DROP TABLE IF EXISTS athletes_on_max_date;
DROP TABLE IF EXISTS qualifying_athletes;