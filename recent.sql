select * from eventpositions_view 
where athlete_code = '528017'
order by formatted_date DESC

select event_code,count(*),avg(time_seconds) as avgSec 
from eventpositions_view 
where event_date='23/08/2025'
and event_code_count>1
 and adj_time_ratio<1.1
group by event_code
order by avgSec

WITH ranked_times AS (
  SELECT 
    event_code,
    time_seconds,
    PERCENT_RANK() OVER (PARTITION BY event_code ORDER BY time_seconds ASC) AS pr
  FROM eventpositions_view
  WHERE event_date = '23/08/2025'
 --   AND event_code_count > 1
)
,
top_10_per_event AS (
  SELECT event_code, time_seconds
  FROM ranked_times
    WHERE pr <= 0.10
)
SELECT 
  event_code,
  AVG(time_seconds) AS avg_top_10_time
FROM top_10_per_event
GROUP BY event_code
ORDER BY avg_top_10_time;

  SELECT 
    event_code,
    *
  FROM eventpositions_view
  WHERE event_date = '16/08/2025'
  order by event_code,time_seconds
	


ALTER TABLE eventpositions ADD COLUMN adj_time_seconds REAL;
ALTER TABLE eventpositions ADD COLUMN adj_time_ratio REAL;
ALTER TABLE eventpositions ADD COLUMN event_code_count INTEGER;

DROP VIEW eventpositions_view

CREATE VIEW eventpositions_view AS
SELECT
    event_code,
    event_date,
    -- Generate formatted_date from event_date
    substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) AS formatted_date,
    position,
    name,
    male_position,
    male_count,
    age_group,
    age_grade,
    time,
    club,
    comment,
    athlete_code,
    appearances,
    time_ratio,
	  CASE
		WHEN length(time) - length(replace(time, ':', '')) = 2 THEN
		  CAST(substr(time, 1, instr(time, ':')-1) AS INTEGER) * 3600 +
		  CAST(substr(time, instr(time, ':')+1, instr(substr(time, instr(time, ':')+1), ':')-1) AS INTEGER) * 60 +
		  CAST(substr(time, length(time) - 1, 2) AS INTEGER)
		ELSE
		  CAST(substr(time, 1, instr(time, ':')-1) AS INTEGER) * 60 +
		  CAST(substr(time, instr(time, ':')+1) AS INTEGER)
	  END AS time_seconds,

    adj_time_seconds,
    adj_time_ratio,
    event_code_count
FROM eventpositions;

UPDATE eventpositions
SET adj_time_seconds = NULL,
    adj_time_ratio = NULL,
    event_code_count = NULL;
	
UPDATE eventpositions
SET tourist_flag = NULL,
    last_event_code_count = NULL,
    total_runs = NULL;

select count(event_code_count) from eventpositions_view where event_date='23/08/2015'

WITH selected_RangeOf15Weeks AS ( SELECT pe1.event_code, pe1.formatted_date AS end_date, MAX(pe2.formatted_date) AS start_date 
FROM parkrun_events_view pe1 JOIN parkrun_events_view pe2 ON pe1.event_code = pe2.event_code AND pe2.event_number = pe1.event_number - 15 
WHERE pe1.formatted_date = '2024-12-25' GROUP BY pe1.event_code, pe1.formatted_date ), AthletesInRange AS ( 
SELECT ep.event_code, ep.event_date, ep.formatted_date, ep.time, ep.time_seconds, ep.athlete_code, ep.time_ratio 
FROM eventpositions_view ep JOIN selected_RangeOf15Weeks sr ON ep.event_code = sr.event_code AND ep.formatted_date BETWEEN sr.start_date AND sr.end_date ), athletesStatsRange AS ( 
SELECT athlete_code, COUNT(DISTINCT event_code) AS event_code_count, COUNT(*) AS appearances FROM AthletesInRange 
GROUP BY athlete_code HAVING appearances > 1 ), AthletesWithAdjTime AS ( 
SELECT ep.*, ep.formatted_date, pev.coeff, pev.coeff_event, ep.time_seconds / pev.coeff / pev.coeff_event AS adj_time_seconds 
FROM AthletesInRange ep JOIN parkrun_events pev ON ep.event_code = pev.event_code AND ep.event_date = pev.event_date JOIN athletesStatsRange asr ON ep.athlete_code = asr.athlete_code ) , 
final AS ( SELECT a.athlete_code, a.event_code, a.event_date, a.formatted_date, a.time, a.time_seconds, a.coeff, a.coeff_event, a.adj_time_seconds, asr.appearances, 
asr.event_code_count, a.time_ratio, a.adj_time_seconds / MIN(a.adj_time_seconds) 
OVER (PARTITION BY a.athlete_code) AS adj_time_ratio, CASE WHEN asr.event_code_count > 1 THEN 'T' ELSE '' END AS tourist_flag 
FROM AthletesWithAdjTime a JOIN athletesStatsRange asr ON a.athlete_code = asr.athlete_code WHERE asr.event_code_count > 1 ) 
SELECT * FROM final WHERE final.event_date='25/12/2024'
 ORDER BY athlete_code, formatted_date
 
 select * from eventpositions_view 
where formatted_date between '2025-01-01' and '2025-01-10'

ALTER TABLE eventpositions RENAME COLUMN appearances TO event_eligible_appearances;

ALTER TABLE eventpositions ADD COLUMN tourist_flag TEXT;
ALTER TABLE eventpositions ADD COLUMN last_event_code_count INTEGER;
ALTER TABLE eventpositions ADD COLUMN total_runs INTEGER;
ALTER TABLE eventpositions ADD COLUMN age_ratio_male REAL;
ALTER TABLE eventpositions ADD COLUMN age_ratio_sex REAL;
ALTER TABLE athletes ADD COLUMN age_estimate INTEGER;

select * from athletes
ALTER TABLE athletes RENAME COLUMN dob TO min_dob;
ALTER TABLE athletes ADD COLUMN last_updated TEXT;



select * from eventpositions_view where formatted_date='2025-08-30'
select * from eventpositions where event_date='30/08/2025'
select * from eventpositions_view where age_group='Unknown'

SELECT COUNT(last_event_code_count) FROM eventpositions_view WHERE event_date = '30/08/2025'

select * from  eventpositions where athlete_code='528017' and event_date='30/08/2025'

select * from  eventpositions_view where athlete_code='528017' and formatted_date between '2011-05-17' and '2025-08-30' order by formatted_date
select * from  eventpositions_view where athlete_code='4093481' and formatted_date between '2024-09-20' and '2025-05-31' order by formatted_date  -- bad
select * from  eventpositions_view where athlete_code='10023840' and formatted_date between '2011-01-01' and '2025-08-30' order by formatted_date  -- good
select * from  eventpositions_view where athlete_code='10050896' and formatted_date between '2025-03-24' and '2025-08-30' order by formatted_date
select * from  eventpositions_view where athlete_code='132170' and formatted_date between '2022-06-01' and '2023-03-30' order by formatted_date
select * from  eventpositions_view where athlete_code='1521871' and formatted_date between '2025-01-01' and '2025-08-30' order by formatted_date

select * from eventpositions_view where last_event_code_count>2 and event_code_count>4

valid_athletes as (
select * from eventpositions_view
where event_eligible_appearances>10
and event_date='30/08/2025')

select event_code,count(*)
from eventpositions_view
where formatted_date = '2025-08-30' 
  and tourist_flag='T'
group by event_code

select *
from eventpositions_view
where formatted_date = '2025-08-30' 
  and tourist_flag='T'
  and event_code=1


