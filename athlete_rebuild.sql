select * from tmp_extended_age_fields
where athlete_code NOT IN (select athlete_code from athletes)


SELECT * FROM athletes WHERE athlete_code='10004476';

'\n            
UPDATE athletes a\n            
SET current_age_estimate = sub.new_age\n           
 FROM (\n              
 SELECT fu.athlete_code,\n               
 CASE\n                 
 WHEN fu.min_dob IS NULL AND fu.max_dob IS NULL THEN NULL\n                
 WHEN fu.min_dob IS NULL THEN ROUND(((fu.last_updated::date - fu.max_dob::date)::numeric / 365.2425)::numeric, 2)\n              
 WHEN fu.max_dob IS NULL THEN ROUND(((fu.last_updated::date - fu.min_dob::date)::numeric / 365.2425)::numeric, 2)\n              
 ELSE ROUND((((fu.last_updated::date - fu.max_dob::date) + (fu.last_updated::date - fu.min_dob::date))::numeric / (2.0 * 365.2425))::numeric, 2)\n         
 END AS new_age\n              FROM athletes fu\n            ) sub\n            WHERE a.athlete_code = sub.athlete_code\n       
 AND sub.new_age IS NOT NULL\n            '
 
 
 select * from athletes where name like 'Oscar GANDER'
select * from eventpositions where athlete_code='10000262' order by age_ratio_male DESC

select * from eventpositions where event_code=1 and event_date='17/01/2026'


select * from athletes where min_dob>max_dob


select * from eventpositions_view where athlete_code='1640424' order by formatted_date
select * from tmp_eventpositions where athlete_code='1011406'
select * from tmp_athlete_ages where athlete_code='1014475'
select * from tmp_age_changes where athlete_code='992966'
select * from tmp_dob_ranges where athlete_code='688165' order by formatted_date
select * from tmp_dob_summary where athlete_code='11880261'
select * from tmp_latest_club where athlete_code='1640424'
select * from athletes where athlete_code='11880261'
select * from tmp_final_age_updates where athlete_code='11880261'
select * from tmp_coalesce_age_fields where athlete_code='1663675'
select * from tmp_extended_age_fields where athlete_code='1640424'
select * from tmp_extended_age_fields where athlete_code='528017'
select * from tmp_athlete_update where athlete_code='1000487'
select * from tmp_athlete_update where athlete_code='528017'
select * from tmp_active_athlete_update where athlete_code='1000487'
select * from tmp_active_athlete_update where athlete_code='528017'
select * from tmp_new_athletes where athlete_code='1000487'
select * from tmp_new_athletes where athlete_code='528017'
select * from tmp_rebuild_athletes where athlete_code='11880261'
select athlete_code,name,min_dob,max_dob,last_updated,club,sex,last_age_estimate,current_age_estimate from athletes where athlete_code='528017'

select * from tmp_ageRatio_expanded where sex='M'
Select * from tmp_ageRatio_final where athlete_code='7389668'
select * from tmp_ageRatio_clamped where athlete_code='7389668'
select * from tmp_ageRatio_expanded where sex='M'
Select * from tmp_ageRatio_final where sex='M' order by age_guess 
select * from tmp_ageRatio_clamped where sex='M' order by age_guess
select * from athletes where min_dob>max_dob

   age_dedup AS (
    SELECT age, age_max, sex, age_group,male_age_ratio, sex_age_ratio, rowid,
        ROW_NUMBER() OVER (PARTITION BY age, sex ORDER BY rowid DESC) AS rn
    FROM age_category),
    dedup_sel AS (
    SELECT age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
    FROM age_dedup
    WHERE rn = 1)
	
-- tmp_eventpositions_updates ->  ar.male_age_ratio_new
-- tmp_ageRatio_final -> male_age_ratio
-- tmp_ageRatio_clamped

---  age_category analysis

select formatted_date,time,time_seconds,age_grade,age_group,   CAST(epv.time_seconds AS REAL) / 50 ,CAST(REPLACE(epv.age_grade, '%', '') AS REAL),
ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
from tmp_eventpositions epv

21	M	SM20-24	1552	1554	1559	1.00387596899225	1.00387596899225	21
22	M	SM20-24	0	1548	1551	1	1	24
25	M	SM25-29	0	1548	2776	1	1	28
29	M	SM25-29	1549	1550	1550	1.00129198966408	1.00129198966408	29
30	M	SM30-34	0	1552	1553	1.00258397932817	1.00258397932817	30


--  age_group='SM25-29' analysis
select  count(age_grade),ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) as minX--,
		--ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) as maxX
from eventpositions_view epv
where age_group='SM25-29'
group by minX--,maxX

select ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0),* 
from eventpositions_view epv
where age_group='SM25-29'
   and (ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) <1548 
   or ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) >1550)


-- @tempTable:  tmp_eventpositions
DROP TABLE IF EXISTS tmp_eventpositions;
CREATE TEMP TABLE tmp_eventpositions AS
select event_code,event_date,formatted_date,time,time_seconds,athlete_code,time_ratio,age_grade,age_group,club,'2026-01-17' as 'end_date',1.2 AS 'max_ratio',name,comment
from eventpositions_view 
where athlete_code='10001431' 
order by formatted_date

-- @tempTable:  tmp_athlete_ages
DROP TABLE IF EXISTS tmp_athlete_ages;
CREATE TEMP TABLE tmp_athlete_ages AS
   SELECT epv.athlete_code, epv.formatted_date,ac.age,ac.age_max,epv.age_group,epv.age_grade,epv.time_seconds,ac.lower_bound,ac.upper_bound,
    ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
  FROM tmp_eventpositions epv
  JOIN age_category ac
    ON epv.age_group = ac.age_group
   AND ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) BETWEEN ac.lower_bound AND ac.upper_bound;
 
-- @tempTable:  tmp_age_changes 
 DROP TABLE IF EXISTS tmp_age_changes;
CREATE TEMP TABLE tmp_age_changes AS  
    SELECT athlete_code,formatted_date,age,age_max,
        LAG(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age,
		LAG(age_max) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age_max,
        LAG(formatted_date) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_date
    FROM tmp_athlete_ages; 

-- @tempTable:  tmp_dob_ranges	
 DROP TABLE IF EXISTS tmp_dob_ranges;
CREATE TEMP TABLE tmp_dob_ranges AS 
    SELECT athlete_code,prev_date,formatted_date,prev_age,age,
        DATE(prev_date, '+1 day', '-' || (prev_age + 1) || ' years') AS earliest_possible_dob,   -- youngest possible DOB from the previous observation
        DATE(formatted_date, '-' || age || ' years') AS latest_possible_dob               -- oldest possible DOB from the later observation
    FROM tmp_age_changes
    WHERE prev_age IS NOT NULL
    UNION ALL
    SELECT athlete_code,NULL AS prev_date,formatted_date,NULL AS prev_age,age,  -- youngest possible DOB (the later date)
        DATE(formatted_date, '-' || (age + 1) || ' years', '+1 day') AS earliest_possible_dob,
        DATE(formatted_date, '-' || age || ' years') AS latest_possible_dob  -- oldest possible DOB (about one year earlier)
    FROM tmp_age_changes
    WHERE prev_age IS NULL; 
	
WITH ranges AS (
    SELECT athlete_code,formatted_date,age,age_max,prev_age,prev_age_max, prev_date,
        DATE(formatted_date, '-' || (age_max + 1) || ' years', '+1 day') AS curr_min_dob,  -- youngest (latest) date
        DATE(formatted_date, '-' || age || ' years')                   AS curr_max_dob,  -- oldest (earliest) date
        CASE WHEN prev_age IS NOT NULL THEN DATE(prev_date, '-' || (prev_age_max + 1) || ' years', '+1 day') END AS prev_min_dob,
        CASE WHEN prev_age IS NOT NULL THEN DATE(prev_date, '-' || prev_age || ' years') END AS prev_max_dob
    FROM tmp_age_changes
),
resolved AS (
    SELECT r.*,
        CASE                             -- lower bound = later of the two minima
            WHEN r.prev_min_dob IS NULL THEN r.curr_min_dob
            WHEN r.curr_min_dob IS NULL THEN r.prev_min_dob
            WHEN r.prev_min_dob > r.curr_min_dob THEN r.prev_min_dob
            ELSE r.curr_min_dob
        END AS min_dob,
        CASE                             -- upper bound = earlier of the two maxima
            WHEN r.prev_max_dob IS NULL THEN r.curr_max_dob
            WHEN r.curr_max_dob IS NULL THEN r.prev_max_dob
            WHEN r.prev_max_dob < r.curr_max_dob THEN r.prev_max_dob
            ELSE r.curr_max_dob
        END AS max_dob
    FROM ranges r
)
--select max(min_dob),min(max_dob)
--FROM resolved
--ORDER BY athlete_code, formatted_date;
SELECT
    athlete_code,prev_date,formatted_date,prev_age,prev_age_max,age,age_max,
    min_dob as earliest_possible_dob,  -- latest possible birthdate (age_max driven)
    max_dob AS latest_possible_dob   -- earliest possible birthdate (age driven)
FROM resolved
ORDER BY athlete_code, formatted_date;

CREATE TABLE tmp_rebuild_athletes AS
		WITH changed AS (
			SELECT * FROM tmp_active_athlete_update
			UNION ALL
			SELECT * FROM tmp_new_athletes
		)
		SELECT * FROM changed
		UNION ALL
		SELECT a.athlete_code,
			   a.name,
			   a.min_dob,
			   a.max_dob,
			   a.last_updated,
			   a.club,
			   a.sex,
			   a.last_age_estimate,
			   a.current_age_estimate
		FROM athletes a
		WHERE NOT EXISTS (
			SELECT 1 FROM changed c WHERE c.athlete_code = a.athlete_code);

with tmp AS (			
SELECT 'new',r.*,julianday(r.min_dob)-julianday(a.min_dob) as date_diff
FROM tmp_rebuild_athletes r
JOIN athletes a USING (athlete_code)
WHERE COALESCE(r.min_dob,'')        <> COALESCE(a.min_dob,'')
   --OR COALESCE(r.max_dob,'')        <> COALESCE(a.max_dob,'')
   --OR COALESCE(r.last_updated,'')   <> COALESCE(a.last_updated,'')
   --OR COALESCE(r.club,'')           <> COALESCE(a.club,'')
   --OR COALESCE(r.sex,'')            <> COALESCE(a.sex,'')
   --OR COALESCE(r.last_age_estimate,'')    <> COALESCE(a.last_age_estimate,'')
UNION ALL
SELECT 'old',r.athlete_code,r.name,r.min_dob,r.max_dob,r.last_updated,r.club,r.sex,r.last_age_estimate,r.current_age_estimate,-julianday(r.min_dob)+julianday(a.min_dob) as date_diff
FROM tmp_rebuild_athletes a
JOIN athletes r USING (athlete_code)
WHERE COALESCE(r.min_dob,'')        <> COALESCE(a.min_dob,'')
   --OR COALESCE(r.max_dob,'')        <> COALESCE(a.max_dob,'')
   --OR COALESCE(r.last_updated,'')   <> COALESCE(a.last_updated,'')
   --OR COALESCE(r.club,'')           <> COALESCE(a.club,'')
   --OR COALESCE(r.sex,'')            <> COALESCE(a.sex,'')
   --OR COALESCE(r.last_age_estimate,'')    <> COALESCE(a.last_age_estimate,'')
   )
 select * from tmp 
 --where club like 'Weald%'
 where athlete_code IN
 (select athlete_code from tmp 
  where min_dob<max_dob)
 --and athlete_code IN (select athlete_code from eventpositions where event_code=3 and event_date='20/06/2015')
 order by date_diff,athlete_code 
 
 
 select * from tmp_athlete_ages where athlete_code='1669158'
 select * from tmp_rebuild_athletes where athlete_code='10247504'
 SELECT * FROM tmp_coalesce_age_fields;
 
 select athlete_code from eventpositions where event_code=3 and event_date='20/06/2015'
 
 select * from athletes order by athlete_code
 
 	SELECT
	  ta.athlete_code,ta.name,earliest_possible_dob AS final_min_dob,latest_possible_dob AS final_max_dob,
	  ta.last_updated AS final_last_updated,ta.club AS final_club,
      ta.sex AS final_sex
	FROM tmp_latest_club ta
	
	
	select * from tmp_dob_ranges where athlete_code='1029873' order by earliest_possible_dob
	
	
-- the plan is to take the output of tmp_coalesce_age_fields
-- and the output of tmp_dob_ranges and build an algorithm to correct all instances where min_dob > max_dob
-- restore the dates back in tmp_coalesce_age_fields
-- The tmp_coalesce_age_ fields need to go back into athletes
-- this needs to be passed back to postgels

WITH RECURSIVE
ordered AS (
    SELECT
        athlete_code,
        formatted_date,
        earliest_possible_dob,
        latest_possible_dob,
        ROW_NUMBER() OVER (
            PARTITION BY athlete_code
            ORDER BY formatted_date DESC
        ) AS rn
    FROM tmp_dob_ranges
),
walk AS (
    SELECT
        o.athlete_code,
        o.rn,
        o.formatted_date,
        o.earliest_possible_dob AS current_min,
        o.latest_possible_dob   AS current_max
    FROM ordered o
    WHERE o.rn = 1

    UNION ALL

    SELECT
        o.athlete_code,
        o.rn,
        o.formatted_date,
        CASE
            WHEN date(
                    CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                         THEN o.earliest_possible_dob ELSE w.current_min END
                 )
               <= date(
                    CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                         THEN o.latest_possible_dob ELSE w.current_max END
                 )
            THEN CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                      THEN o.earliest_possible_dob ELSE w.current_min END
            ELSE w.current_min
        END AS current_min,
        CASE
            WHEN date(
                    CASE WHEN date(o.earliest_possible_dob) > date(w.current_min)
                         THEN o.earliest_possible_dob ELSE w.current_min END
                 )
               <= date(
                    CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                         THEN o.latest_possible_dob ELSE w.current_max END
                 )
            THEN CASE WHEN date(o.latest_possible_dob) < date(w.current_max)
                      THEN o.latest_possible_dob ELSE w.current_max END
            ELSE w.current_max
        END AS current_max
    FROM walk w
    JOIN ordered o
      ON o.athlete_code = w.athlete_code
     AND o.rn = w.rn + 1
),
final_bounds AS (
    SELECT
        athlete_code,
        MAX(current_min) AS corrected_min_dob,
        MIN(current_max) AS corrected_max_dob
    FROM walk
    GROUP BY athlete_code
)
UPDATE tmp_coalesce_age_fields AS a
SET new_min_dob = COALESCE(
        (SELECT corrected_min_dob FROM final_bounds fb WHERE fb.athlete_code = a.athlete_code),
        new_min_dob
    ),
    new_max_dob = COALESCE(
        (SELECT corrected_max_dob FROM final_bounds fb WHERE fb.athlete_code = a.athlete_code),
        new_max_dob
    )
WHERE EXISTS (
    SELECT 1 FROM final_bounds fb WHERE fb.athlete_code = a.athlete_code
);

select * from  tmp_coalesce_age_fields
