WITH selected_RangeOf15Weeks AS (
  SELECT 
    MAX(pe2.formatted_date) AS start_date,
    pe1.formatted_date AS end_date
  FROM parkrun_events_view pe1
  JOIN parkrun_events_view pe2  
    ON pe1.event_code = pe2.event_code
    AND pe2.event_number = pe1.event_number - 15
  WHERE pe1.formatted_date = '2025-10-18'
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
ORDER BY event_code, ep.formatted_date,ep.time_seconds
  )
  ,
  athletesStatsRange AS (
    SELECT
      athlete_code,
      COUNT(DISTINCT event_code) AS event_code_count,
      COUNT(*) AS recent_appearances
    FROM AthletesInRange
    GROUP BY athlete_code
  )
 -- ,
 -- AthletesWithAdjTime AS (
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
	  
	where ep.athlete_code='10001431' and ep.formatted_date BETWEEN '2025-03-01' and '2025-10-18'
	  
---=============================================================================================	  
WITH	  
selected_athleteAdjTimeSec AS (
  SELECT
    ep.athlete_code,
    ep.event_code,
    ep.event_date,
    pe.coeff,
	time_seconds,
    ROUND(time_seconds / pe.coeff, 2) AS adjusted_seconds
  FROM eventpositions_view ep
  JOIN parkrun_events pe ON ep.event_code = pe.event_code AND ep.event_date = pe.event_date
  WHERE substr(ep.event_date, 7, 4) || '-' || substr(ep.event_date, 4, 2) || '-' || substr(ep.event_date, 1, 2)
        BETWEEN '2025-06-21' AND '2025-10-18'
		--and athlete_code='6093031'
		--order by substr(ep.event_date, 7, 4) || '-' || substr(ep.event_date, 4, 2) || '-' || substr(ep.event_date, 1, 2)
 )
,
athletesAdjPBforRange AS (
    SELECT athlete_code, MIN(adjusted_seconds) AS personal_best
    FROM selected_athleteAdjTimeSec
    GROUP BY athlete_code
 ) 
,
-- This CTE filters athletes who have adjusted times within 20% of their personal best. 
eligibleWithinRange AS (
    SELECT j.athlete_code, j.event_code, j.event_date, j.time_seconds,coeff,j.adjusted_seconds, pb.personal_best,j.adjusted_seconds/pb.personal_best as adj_time_ratio
    FROM selected_athleteAdjTimeSec j
    JOIN athletesAdjPBforRange pb ON j.athlete_code = pb.athlete_code
    WHERE 
		j.adjusted_seconds < pb.personal_best * 1.20
	--  and 
	--	j.athlete_code='181359'
	order by event_code,substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2),adjusted_seconds
 )
 , athlete_event_min AS (
       SELECT
          athlete_code,
          event_code,
          MIN(adjusted_seconds) AS min_per_event
      FROM eligibleWithinRange
      GROUP BY athlete_code, event_code
	  )
 ,
  athlete_min AS (
      SELECT
          athlete_code,
          MIN(adjusted_seconds) AS min_per_athlete,
		  COUNT(DISTINCT event_code) AS event_count
      FROM eligibleWithinRange
      GROUP BY athlete_code
  )
 -- ,
 --   event_counts AS (
 --     SELECT
 --         athlete_code,
 --         COUNT(DISTINCT event_code) AS event_count
 --     FROM eligibleWithinRange
 --     GROUP BY athlete_code
 -- )
  ,
    ratios AS (
      SELECT
          aem.athlete_code,
          aem.event_code,
		  aem.min_per_event , am.min_per_athlete,
          ROUND(aem.min_per_event / am.min_per_athlete, 4) AS ratio
      FROM athlete_event_min aem
      JOIN athlete_min am ON aem.athlete_code = am.athlete_code
      --JOIN event_counts ec ON aem.athlete_code = ec.athlete_code
      WHERE event_count > 1
	  
	  --and event_code=1
  )
  ,
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
  
  
  select * from eventpositions_view where athlete_code='181359' and formatted_date BETWEEN '2025-03-01' and '2025-10-18'
  
  select event_code,coeff,coeff_event from parkrun_events where event_date='18/10/2025'