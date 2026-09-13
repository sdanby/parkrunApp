-- ORIGINAL DATE WINDOWS
DROP TABLE IF EXISTS tmp_selected_eventRange;
CREATE TEMP TABLE tmp_selected_eventRange
 AS
  SELECT 
    max(pe1.formatted_date) AS end_date,
    min(pe1.formatted_date) AS start_date,
    pe1.event_code,
    max(pe1.event_number) AS end_number,
    1.2 AS max_ratio
  FROM parkrun_events_view pe1
  WHERE pe1.formatted_date   BETWEEN '2025-06-21' AND '2025-10-18'
	and event_number<10000
  group by event_code;
  select * from tmp_selected_eventRange;
  --select * from parkrun_events_view where event_code=1 and formatted_date   BETWEEN '2025-06-21' AND '2025-10-18'
  --------------------------
--  CONTROLS A WINDOW FOR EVENT_CODE AND event_date
DROP TABLE IF EXISTS tmp_selected_eventRange;
CREATE TEMP TABLE tmp_selected_eventRange
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
  WHERE pe1.formatted_date='2025-10-18';
  select * from tmp_selected_eventRange;
--------------------------
 -- end date of window for eventpositions
DROP TABLE IF EXISTS tmp_eventpositions_end;
CREATE TEMP TABLE tmp_eventpositions_end AS
SELECT e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code 
FROM eventpositions_view e
JOIN tmp_selected_eventRange s
WHERE e.formatted_date = s.end_date 
  AND e.event_code = s.event_code;
CREATE INDEX IF NOT EXISTS idx_tmp_eventpositions_end ON tmp_eventpositions_end(event_code, athlete_code);
select * from tmp_eventpositions_end where athlete_code='485408';
--------------------------
 -- 15w window of eventpositions
DROP TABLE IF EXISTS tmp_eventpositions;
CREATE TEMP TABLE tmp_eventpositions AS
SELECT e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code,e.time_ratio,
 (SELECT end_date   FROM tmp_selected_eventRange) As end_date,
 (SELECT max_ratio FROM tmp_selected_eventRange LIMIT 1) as max_ratio
FROM eventpositions_view e
JOIN tmp_selected_eventRange s
WHERE e.formatted_date BETWEEN s.start_date AND s.end_date  
  AND e.event_code = s.event_code;
CREATE INDEX IF NOT EXISTS idx_tmp_eventpositions ON tmp_eventpositions(event_code, formatted_date,athlete_code);
select * from tmp_eventpositions --where athlete_code='10031010'
where event_code=1;
--------------------------
-- 15w window of parkrun_events
DROP TABLE IF EXISTS tmp_parkrun_events;
CREATE TEMP TABLE tmp_parkrun_events AS
SELECT p.event_code, p.formatted_date,p.event_number,p.coeff,p.coeff_event,
	(SELECT end_date   FROM tmp_selected_eventRange) As end_date
FROM parkrun_events_view p
JOIN tmp_selected_eventRange s
WHERE p.formatted_date BETWEEN s.start_date AND s.end_date 
  AND p.event_code = s.event_code;
CREATE INDEX IF NOT EXISTS idx_tmp_parkrun_events ON tmp_parkrun_events(event_code, formatted_date);
select * from tmp_parkrun_events;
--------------------------
 -- 15w window combining eventpositions & parkrun_events to bring in event_number
DROP TABLE IF EXISTS tmp_athletesInEventRange;
CREATE TEMP TABLE tmp_athletesInEventRange AS
SELECT
  ep.event_code, ep.event_date, ep.time, ep.time_seconds, ep.athlete_code,ep.max_ratio,
  p.event_number, ep.formatted_date, p.end_date,
  ep.time_ratio,p.coeff,p.coeff_event,
  ep.time_seconds / p.coeff  AS adj_time_seconds,
  ep.time_seconds / p.coeff / p.coeff_event AS adj2_time_seconds
FROM tmp_eventpositions ep
JOIN tmp_parkrun_events p
  ON ep.event_code = p.event_code
 AND ep.formatted_date = p.formatted_date;
CREATE INDEX IF NOT EXISTS idx_tmp_athletesInEventRange ON tmp_athletesInEventRange(event_code, formatted_date,athlete_code);
select * from tmp_athletesInEventRange where athlete_code='6093031' order by formatted_date; --where athlete_code='2971910';
-------------------------- 
 -- 15w window calculating stats across all event_codes
DROP TABLE IF EXISTS tmp_athletesRangeStat;
CREATE TEMP TABLE tmp_athletesRangeStat AS
  SELECT athlete_code,max_ratio,
      COUNT(*) AS total_runs,
	  COUNT(DISTINCT event_code) AS event_code_count,
	  MIN(adj_time_seconds) AS adj_min_time_seconds
  FROM  tmp_athletesInEventRange ek
  GROUP BY athlete_code;
CREATE INDEX IF NOT EXISTS idx_tmp_athletesRangeStat ON tmp_athletesRangeStat(athlete_code);
select * from tmp_athletesRangeStat
where athlete_code='10031010';
-------------------------- 
 -- 15w window calculating recent quickest and number of appearance within event_code
DROP TABLE IF EXISTS tmp_athletesInEventRangeStat;
CREATE TEMP TABLE tmp_athletesInEventRangeStat AS
  SELECT ek.athlete_code,ek.event_code,ek.end_date,ek.max_ratio,
      MIN(ek.time_seconds) AS min_time_seconds,
      COUNT(*) AS event_appearances
  FROM  tmp_eventpositions ek
  GROUP BY ek.athlete_code,ek.event_code
  HAVING COUNT(*) > 1;
CREATE INDEX IF NOT EXISTS idx_tmp_athletesInEventRangeStat ON tmp_athletesInEventRangeStat(event_code,athlete_code);
select * from tmp_athletesInEventRangeStat where athlete_code='528017' order by event_code; 
-------------------------- 
 -- 15w window thinning out athletes per event_code that aren't in the last end_date
DROP TABLE IF EXISTS  tmp_eligible_appearances;
CREATE TEMP TABLE tmp_eligible_appearances AS
  SELECT
    a.event_code,a.formatted_date,a.athlete_code,a.time_seconds,am.min_time_seconds,am.event_appearances,a.end_date,am.max_ratio,
	ROUND(CAST(a.time_seconds AS REAL) / am.min_time_seconds, 6) AS time_ratio
  FROM tmp_athletesInEventRange a
  JOIN tmp_athletesInEventRangeStat am --USING (athlete_code)
  WHERE am.min_time_seconds > 0
    AND a.time_seconds IS NOT NULL
	AND a.event_code=am.event_code
	AND a.athlete_code=am.athlete_code
    AND time_ratio <= am.max_ratio;
CREATE INDEX IF NOT EXISTS idx_tmp_eligible_appearances ON tmp_eligible_appearances(event_code, formatted_date,athlete_code);
select * from tmp_eligible_appearances where athlete_code='181359' order by event_code,formatted_date,athlete_code ; -- where formatted_date=end_date
--------------------------
 -- 15w *****window to create first level of adjusted times
DROP TABLE IF EXISTS  tmp_adjusted_eligible_appearances;
CREATE TEMP TABLE tmp_adjusted_eligible_appearances AS
  SELECT
    a.event_code,a.formatted_date,a.athlete_code,a.time_seconds,a.adj_time_seconds,am.adj_min_time_seconds,a.end_date,am.max_ratio,
	ROUND(CAST(a.adj_time_seconds AS REAL) / am.adj_min_time_seconds, 6) AS adj_time_ratio
  FROM tmp_athletesInEventRange a
  JOIN tmp_athletesRangeStat am USING (athlete_code)
  WHERE a.adj_time_seconds > 0
    AND a.time_seconds IS NOT NULL
	--AND a.event_code=am.event_code
	AND a.athlete_code=am.athlete_code
    AND adj_time_ratio <= am.max_ratio;
CREATE INDEX IF NOT EXISTS idx_tmp_adjusted_eligible_appearances ON tmp_adjusted_eligible_appearances(event_code, formatted_date,athlete_code);
select * from tmp_adjusted_eligible_appearances where athlete_code='181359' order by event_code,formatted_date,time_seconds ;
--------------------------
 -- 15w window finally count eligible appearances per athlete (for end_date)
DROP TABLE IF EXISTS tmp_eligible_end;
CREATE TEMP TABLE tmp_eligible_end AS
  SELECT event_code,athlete_code,COUNT(*)AS eligible_appearances,max(time_ratio) 
  FROM tmp_eligible_appearances
  GROUP BY event_code,athlete_code;
CREATE INDEX IF NOT EXISTS idx_tmp_eligible_end ON tmp_eligible_end(event_code,athlete_code);
select * from tmp_eligible_end where athlete_code='528017';
--------------------------
DROP TABLE IF EXISTS tmp_ranked;
CREATE TEMP TABLE tmp_ranked AS
	  SELECT *,
		  ROW_NUMBER() OVER (PARTITION BY formatted_date,event_code ORDER BY time_ratio) AS rn,
		  COUNT(*) OVER (PARTITION BY formatted_date,event_code) AS cnt
	  FROM tmp_eligible_appearances
	  --WHERE time_ratio <= max_ratio
	    --AND eligible_appearances>1
	  order by event_code,formatted_date;
CREATE INDEX IF NOT EXISTS idx_tmp_ranked ON tmp_ranked(event_code,athlete_code);
select * from tmp_ranked -- where athlete_code='527018'
	order by event_code,formatted_date,rn;
--------------------------
DROP TABLE IF EXISTS tmp_quartile;
CREATE TEMP TABLE tmp_quartile AS
  SELECT r1.formatted_date,r1.event_code,  
	 (SELECT 
		CASE -- Q1 (25th percentile)
		  WHEN ((r1.cnt - 1) * 0.25) % 1 = 0 THEN
			(SELECT time_ratio
			 FROM tmp_ranked
			 WHERE formatted_date = r1.formatted_date
			   AND event_code = r1.event_code
			   AND rn = CAST((r1.cnt - 1) * 0.25 AS INTEGER) + 1)
		  ELSE
			(SELECT r_low.time_ratio + (((r1.cnt - 1) * 0.25 - CAST((r1.cnt - 1) * 0.25 AS INTEGER))
					 * (r_high.time_ratio - r_low.time_ratio))
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
             (SELECT time_ratio
              FROM tmp_ranked
              WHERE formatted_date = r1.formatted_date
                AND event_code = r1.event_code
                AND rn = (r1.cnt + 1) / 2)
           ELSE
             (SELECT AVG(time_ratio)
              FROM tmp_ranked
              WHERE formatted_date = r1.formatted_date
                AND event_code = r1.event_code
                AND rn IN (r1.cnt / 2, r1.cnt / 2 + 1))
         END AS q2,       
         (SELECT
            CASE -- Q3 (75th percentile)
              WHEN ((r1.cnt - 1) * 0.75) % 1 = 0 THEN
                (SELECT time_ratio
                 FROM tmp_ranked
                 WHERE formatted_date = r1.formatted_date
                   AND event_code = r1.event_code
                   AND rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 1)
              ELSE
                (SELECT r_low.time_ratio + (((r1.cnt - 1) * 0.75 - CAST((r1.cnt - 1) * 0.75 AS INTEGER))
                       * (r_high.time_ratio - r_low.time_ratio))
                 FROM tmp_ranked r_low
                 JOIN tmp_ranked r_high
                   ON r_low.formatted_date = r_high.formatted_date
                  AND r_low.event_code = r_high.event_code
                  AND r_high.rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 2
                 WHERE r_low.formatted_date = r1.formatted_date
                   AND r_low.event_code = r1.event_code
                   AND r_low.rn = CAST((r1.cnt - 1) * 0.75 AS INTEGER) + 1)
            END ) AS q3,
         (SELECT ROUND(AVG(time_ratio), 6)           -- Mean
          FROM tmp_ranked r2
          WHERE r2.formatted_date = r1.formatted_date
            AND r2.event_code = r1.event_code) AS average
  FROM tmp_ranked r1
  GROUP BY r1.formatted_date, r1.event_code;
 CREATE INDEX IF NOT EXISTS idx_tmp_quartile ON tmp_quartile(event_code,formatted_date);
 select * from tmp_quartile
   order by event_code,formatted_date;
 --------------------------
DROP TABLE IF EXISTS tmp_final_output;
CREATE TEMP TABLE tmp_final_output AS
   SELECT
    formatted_date,event_code,
    ROUND((q1 + q2 + q3) / 3.0, 6) AS "#1_avg_q1_q2_q3",
    q2 AS "#2_q2_median",
    average AS "#3_overall_average",
    ROUND(((q1 + q2 + q3) / 3.0 + q2 + average) / 3.0, 6) AS "avg_of_#1_#2_#3"
   FROM tmp_quartile;
 CREATE INDEX IF NOT EXISTS idx_tmp_final_output ON tmp_final_output(event_code,formatted_date);
 select * from tmp_final_output
 order by event_code,formatted_date;
 --------------------------
DROP TABLE IF EXISTS tmp_normalized;
CREATE TEMP TABLE tmp_normalized AS 
  SELECT f.*,ROUND("avg_of_#1_#2_#3" - (
		  SELECT MIN("avg_of_#1_#2_#3")
		  FROM tmp_final_output fo
		  WHERE fo.event_code = f.event_code
			) + 1, 6) AS normalized_score
  FROM tmp_final_output f;
 CREATE INDEX IF NOT EXISTS idx_tmp_normalized_keys ON tmp_normalized(event_code,formatted_date);
 select * from tmp_normalized
    order by event_code,formatted_date;
 --------------------------
DROP TABLE IF EXISTS tmp_athlete_event_min;
CREATE TEMP TABLE tmp_athlete_event_min AS 
	SELECT
	  athlete_code,event_code,
	  MIN(adj_time_seconds) AS min_per_event  
	FROM tmp_adjusted_eligible_appearances
	GROUP BY athlete_code, event_code;
CREATE INDEX IF NOT EXISTS idx_tmp_athlete_event_min ON tmp_athlete_event_min(event_code,athlete_code);
select * from tmp_athlete_event_min where athlete_code='181359';
 -------------------------- 
DROP TABLE IF EXISTS tmp_athlete_min;
CREATE TEMP TABLE tmp_athlete_min AS 
	SELECT
	  athlete_code,event_code,
	  MIN(adj_time_seconds) AS min_per_athlete,
	  COUNT(DISTINCT event_code) AS event_count  
	FROM tmp_adjusted_eligible_appearances
	GROUP BY athlete_code;
CREATE INDEX IF NOT EXISTS idx_tmp_athlete_min ON tmp_athlete_event_min(athlete_code);
select * from tmp_athlete_min;
 --------------------------  
DROP TABLE IF EXISTS tmp_adj_ratio;
CREATE TEMP TABLE tmp_adj_ratio AS 
  SELECT
	  aem.athlete_code,
	  aem.event_code,
	  aem.min_per_event , am.min_per_athlete,
	  ROUND(aem.min_per_event / am.min_per_athlete,4) AS adj_ratio
  FROM tmp_athlete_event_min aem
  JOIN tmp_athlete_min am ON aem.athlete_code = am.athlete_code
  WHERE event_count > 1;
CREATE INDEX IF NOT EXISTS idx_tmp_adj_ratio ON tmp_adj_ratio(event_code,athlete_code);
select * from tmp_adj_ratio where event_code=1;
 --------------------------    
DROP TABLE IF EXISTS tmp_adj_ranked_ratio;
CREATE TEMP TABLE tmp_adj_ranked_ratio AS
      SELECT
          event_code,
          adj_ratio,
          ROW_NUMBER() OVER (PARTITION BY event_code ORDER BY adj_ratio) AS rn,
          COUNT(*) OVER (PARTITION BY event_code) AS adj_total
      FROM tmp_adj_ratio;
CREATE INDEX IF NOT EXISTS idx_tmp_adj_ranked_ratio ON tmp_adj_ranked_ratio(event_code);
select * from tmp_adj_ranked_ratio; 
 -------------------------- 
DROP TABLE IF EXISTS tmp_adj_median_summary;
CREATE TEMP TABLE tmp_adj_median_summary AS
      SELECT
          event_code,
          ROUND(AVG(adj_ratio), 4) AS median_ratio
      FROM tmp_adj_ranked_ratio
      WHERE rn IN ( (adj_total + 1) / 2, (adj_total + 2) / 2 )
      GROUP BY event_code;
CREATE INDEX IF NOT EXISTS idx_tmp_adj_median_summary ON tmp_adj_median_summary(event_code);
SELECT event_code, median_ratio FROM tmp_adj_median_summary
ORDER BY event_code;
  -------------------------- 
  
 -- 15w window for atheletes with event_appearances & eligible_appearances for end_date only
DROP TABLE IF EXISTS tmp_ratiosInEventRange;
CREATE TEMP TABLE tmp_ratiosInEventRange AS
	SELECT ee.*,ec.eligible_appearances,er.time_ratio ,ak.event_appearances,ak.min_time_seconds,ar.event_code_count,ar.total_runs
	FROM tmp_eventpositions_end ee
	LEFT JOIN tmp_eligible_end ec ON ee.athlete_code = ec.athlete_code and ee.event_code=ec.event_code
	LEFT JOIN (select * from tmp_eligible_appearances where formatted_date=end_date) er ON ee.athlete_code=er.athlete_code
	LEFT JOIN tmp_athletesInEventRangeStat ak ON ee.athlete_code = ak.athlete_code and ee.event_code=ak.event_code
	LEFT JOIN tmp_athletesRangeStat ar ON ee.athlete_code = ar.athlete_code;
CREATE INDEX IF NOT EXISTS idx_tmp_ratiosInEventRange ON tmp_ratiosInEventRange(event_code,athlete_code);
select * from tmp_ratiosInEventRange
where athlete_code='485408'
order by event_code,time_seconds;





select * from eventpositions p
JOIN tmp_selected_eventRange s
WHERE substr(p.event_date,7,4) || '-' || substr(p.event_date,4,2) || '-' || substr(event_date,1,2) BETWEEN '2025-03-01' AND s.end_date  
AND athlete_code='10001431'
  and s.event_code=p.event_code
  order by substr(p.event_date,7,4) || '-' || substr(p.event_date,4,2) || '-' || substr(event_date,1,2);
  
 select * from parkrun_events where event_date='25/10/2025'

