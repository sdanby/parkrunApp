--  LOCAL STARS 

CREATE TEMP TABLE athletes_on_max_date AS
SELECT event_code, athlete_code
FROM eventpositions_view
WHERE formatted_date = '2025-08-30';

CREATE TEMP TABLE athlete_max_counts AS
SELECT
  ep.event_code,
  ep.athlete_code,
  ep.name,
  MAX(ep.last_event_code_count) AS max_code_count
FROM eventpositions_view ep
JOIN athletes_on_max_date amd
  ON ep.event_code = amd.event_code AND ep.athlete_code = amd.athlete_code
WHERE ep.formatted_date BETWEEN '2025-05-24' AND '2025-08-30'
GROUP BY ep.event_code, ep.athlete_code,ep.name;

SELECT
  event_code,
  COUNT(DISTINCT athlete_code) AS num_athletes_with_10plus
FROM athlete_max_counts
WHERE max_code_count > 9
GROUP BY event_code
ORDER BY event_code;

SELECT
  *
FROM athlete_max_counts
WHERE max_code_count > 9
and event_code=1

DROP TABLE IF EXISTS athletes_on_max_date;
DROP TABLE IF EXISTS athlete_max_counts;