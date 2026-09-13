-- Identifing athletes with problem dob
-- perhaps the best way is to go through each events per date and 
-- take the athletes and get their dob min and max.
-- check if the dob is within the min/max rules
-- if it is update athletes 
-- if not then reset the athlete to new dob range.
-- then apply the age grouping to the athlete index in eventpositions

select *,ROUND(((julianday(date('now')) - julianday(max_dob))
			   + (julianday(date('now')) - julianday(min_dob))) / (2.0 * 365.2425), 2)-current_age_estimate as change
from athletes
where  min_dob>max_dob
order by change

======================================================================  

 SELECT max(end_date) as end_date
  from tmp_selected_eventRange;
   
======================================================================   
    DROP TABLE IF EXISTS tmp_eventpositions;
	CREATE TABLE tmp_eventpositions AS
    SELECT e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code,e.time_ratio,age_grade,age_group,club,end_date,max_ratio,name,comment
    FROM eventpositions_view e
    JOIN tmp_selected_eventRange s
    WHERE e.formatted_date BETWEEN s.start_date AND s.end_date  
    AND e.event_code = s.event_code;
   
   select * from tmp_eventpositions   
======================================================================
    DROP TABLE IF EXISTS tmp_athlete_ages;
	CREATE TABLE tmp_athlete_ages AS
    SELECT epv.athlete_code, epv.formatted_date,ac.age,ac.age_max,epv.age_group,epv.age_grade,epv.time_seconds,ac.lower_bound,ac.upper_bound,
    ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) AS age_calc
    --FROM tmp_eventpositions epv
	FROM eventpositions_view epv
    JOIN age_category ac
    ON epv.age_group = ac.age_group
    AND ROUND(CAST(REPLACE(epv.age_grade, '%', '') AS REAL) * CAST(epv.time_seconds AS REAL) / 50, 0) BETWEEN ac.lower_bound AND ac.upper_bound;
	
	select * from tmp_athlete_ages order by athlete_code,formatted_date;
			select * from tmp_athlete_ages where athlete_code='558877' ORDER BY athlete_code, formatted_date;;
======================================================================
    DROP TABLE IF EXISTS tmp_athlete_ages_err;
	CREATE TABLE tmp_athlete_ages_err AS			
	WITH flagged AS (
		SELECT
			t.*,
			CASE
				WHEN age > LEAD(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date)
				THEN 1 ELSE 0
			END AS next_age_drop_flag
		FROM tmp_athlete_ages t
	)
	SELECT *,count(*)
	FROM flagged
	WHERE next_age_drop_flag = 1
	group by athlete_code
	ORDER BY athlete_code, formatted_date;
select * from  tmp_athlete_ages_err
select * from tmp_athlete_ages where athlete_code IN (select athlete_code from tmp_athlete_ages_err)
select * from tmp_athlete_ages where athlete_code IN (select athlete_code from tmp_dob_summary_fix)
select * from tmp_dob_ranges where athlete_code IN (select athlete_code from tmp_athlete_ages_err)
select * from  tmp_dob_ranges where athlete_code IN (select athlete_code from tmp_dob_summary_fix)
======================================================================
    DROP TABLE IF EXISTS tmp_age_changes;
	CREATE TABLE tmp_age_changes AS
    SELECT athlete_code,formatted_date,age,age_max,
        LAG(age) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age,
		LAG(age_max) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_age_max,
        LAG(formatted_date) OVER (PARTITION BY athlete_code ORDER BY formatted_date) AS prev_date
    FROM tmp_athlete_ages; 
	
	select * from tmp_age_changes;
		select * from tmp_age_changes where athlete_code='558877';
======================================================================
    DROP TABLE IF EXISTS tmp_dob_ranges;
	CREATE TABLE tmp_dob_ranges AS
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
	SELECT
        athlete_code,prev_date,formatted_date,prev_age,prev_age_max,age,age_max,
        min_dob as earliest_possible_dob,  -- latest possible birthdate (age_max driven)
        max_dob AS latest_possible_dob   -- earliest possible birthdate (age driven)
    FROM resolved
    ORDER BY athlete_code, formatted_date;;
	
	select * from tmp_dob_ranges;
	select athlete_code,count(*) from tmp_dob_ranges group by athlete_code;
	
	select * from tmp_dob_ranges where athlete_code='2486306';
	SELECT * FROM tmp_dob_summary where athlete_code='2486306';
		
	from tmp_dob_ranges where athlete_code='8596043';
	SELECT * FROM tmp_dob_ranges WHERE range_conflict = 1 ORDER BY athlete_code, formatted_date;.
		
======================================================================
    DROP TABLE IF EXISTS tmp_dob_summary_base;
	CREATE TABLE tmp_dob_summary_base AS
    SELECT athlete_code,
        MAX(earliest_possible_dob) AS earliest_possible_dob,  -- corresponds to min_dob (oldest possible)
        MIN(latest_possible_dob)   AS latest_possible_dob,   -- corresponds to max_dob (youngest possible)
        MAX(formatted_date) AS last_updated
    FROM tmp_dob_ranges
    GROUP BY athlete_code;
	
	select * from tmp_dob_summary_base;
	
	select * from tmp_dob_summary_base 
	where earliest_possible_dob>latest_possible_dob and athlete_code='1011406';
======================================================================
DROP TABLE IF EXISTS tmp_dob_summary_fix;
CREATE TABLE tmp_dob_summary_fix AS
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
		where athlete_code='907645'
	)	
	,
	walk AS (
    SELECT
        o.athlete_code,
        o.rn,
        o.formatted_date,
        o.earliest_possible_dob AS current_min,
        o.latest_possible_dob   AS current_max,
        0 AS rejected
    FROM ordered o 
    WHERE o.rn = 1 

   UNION ALL
    SELECT
        o.athlete_code,
        o.rn,
        o.formatted_date,
        CASE
            WHEN o.earliest_possible_dob <= w.current_max
                 AND o.latest_possible_dob >= w.current_min
            THEN MAX( o.earliest_possible_dob, w.current_min )
            ELSE o.earliest_possible_dob
        END AS current_min,
        CASE
            WHEN o.earliest_possible_dob <= w.current_max
                 AND o.latest_possible_dob >= w.current_min
            THEN MIN( o.latest_possible_dob, w.current_max )
            ELSE o.latest_possible_dob
        END AS current_max,
        CASE
            WHEN o.earliest_possible_dob <= w.current_max
                 AND o.latest_possible_dob >= w.current_min
            THEN w.rejected
            ELSE 1
        END AS rejected
    FROM walk w
    JOIN ordered o
      ON o.athlete_code = w.athlete_code
     AND o.rn = w.rn + 1)
	 SELECT * FROM walk
	SELECT
		athlete_code,
		MAX(CASE WHEN rejected = 0 THEN current_min END) AS corrected_min_dob,
		MIN(CASE WHEN rejected = 0 THEN current_max END) AS corrected_max_dob,
		SUM(CASE WHEN rejected = 1 THEN 1 ELSE 0 END) AS reject_count
	FROM walk
	GROUP BY athlete_code
	HAVING SUM(CASE WHEN rejected = 1 THEN 1 ELSE 0 END) > 0;
	
select * from tmp_dob_summary_fix where athlete_code='558877'
select * from tmp_dob_summary_fix where date(corrected_min_dob)>date(corrected_max_dob)
======================================================================
DROP TABLE IF EXISTS tmp_dob_summary;
CREATE TABLE tmp_dob_summary AS
    SELECT athlete_code,last_updated,
        COALESCE(corrected_min_dob,earliest_possible_dob) AS earliest_possible_dob,  -- corresponds to min_dob (oldest possible)
        COALESCE(corrected_max_dob,latest_possible_dob) AS latest_possible_dob   -- corresponds to max_dob (youngest possible)
    FROM tmp_dob_summary_base
    LEFT JOIN tmp_dob_summary_fix USING(athlete_code);
	
	select * from tmp_dob_summary;
	
	select * from tmp_dob_summary
	where earliest_possible_dob>latest_possible_dob

======================================================================	
DROP TABLE IF EXISTS tmp_latest_club;
CREATE TABLE tmp_latest_club AS
   WITH ranked AS (
    SELECT fe.athlete_code, fe.club,le.last_updated,fe.name,le.earliest_possible_dob ,le.latest_possible_dob,
        substr(trim(fe.age_group),2,1) AS sex,
        ROW_NUMBER() OVER (
        PARTITION BY fe.athlete_code, fe.formatted_date
        ORDER BY fe.time_seconds DESC  
        ) AS rn
    FROM tmp_eventpositions fe
    JOIN  tmp_dob_summary le
        ON fe.athlete_code = le.athlete_code
    AND fe.formatted_date = le.last_updated)
    SELECT *
    FROM ranked
    WHERE rn = 1; 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_latest_club
    where athlete_code='2486306'
    ORDER BY athlete_code;
-- @endsection
======================================================================	
DROP TABLE IF EXISTS tmp_latest_club_wide;
CREATE TABLE tmp_latest_club_wide AS
   WITH ranked AS (
    SELECT fe.athlete_code, fe.club,le.last_updated,fe.name,le.earliest_possible_dob ,le.latest_possible_dob,
        substr(trim(fe.age_group),2,1) AS sex,
        ROW_NUMBER() OVER (
        PARTITION BY fe.athlete_code, fe.formatted_date
        ORDER BY fe.formatted_date DESC  
        ) AS rn
    FROM eventpositions_view fe
    JOIN  tmp_dob_summary le
        ON fe.athlete_code = le.athlete_code
    AND fe.formatted_date = le.last_updated)
    SELECT *
    FROM ranked
    WHERE rn = 1; 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_latest_club_wide
    where athlete_code='2486306'
    ORDER BY athlete_code;
	select * from eventpositions_view where athlete_code='118733' order by formatted_date desc
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_final_age_updates
	-- 1) existing athletes that have updates
DROP TABLE IF EXISTS tmp_final_age_updates;
CREATE TABLE tmp_final_age_updates AS	
	SELECT
	  a.athlete_code,
      COALESCE(ds.name,a.name) as name,--ds.earliest_possible_dob,
	  CASE
		WHEN ds.earliest_possible_dob IS NULL THEN a.min_dob
		WHEN a.min_dob IS NULL THEN ds.earliest_possible_dob
		WHEN date(a.min_dob)>date(a.max_dob) AND date(ds.earliest_possible_dob)<= date(a.max_dob) THEN ds.earliest_possible_dob
		WHEN date(ds.earliest_possible_dob) > date(a.min_dob) THEN ds.earliest_possible_dob
		ELSE a.min_dob
	  END AS min_dob,
	  CASE
		WHEN ds.latest_possible_dob IS NULL THEN a.max_dob
		WHEN a.max_dob IS NULL THEN ds.latest_possible_dob
		WHEN date(a.min_dob)>date(a.max_dob) AND date(ds.latest_possible_dob)>= date(a.min_dob) THEN ds.latest_possible_dob
		WHEN date(ds.latest_possible_dob) < date(a.max_dob) THEN ds.latest_possible_dob
		ELSE a.max_dob
	  END AS max_dob,
	  COALESCE(ds.last_updated, a.last_updated) AS last_updated,
	  COALESCE(ds.club, a.club) AS club,
      COALESCE(ds.sex, a.sex) AS sex
	FROM athletes a 
	LEFT JOIN tmp_latest_club ds ON ds.athlete_code = a.athlete_code
	--WHERE a.athlete_code IN (SELECT athlete_code FROM tmp_latest_club)
	--
	UNION ALL
	-- 2) new athletes present in tmp_athlete_updates but not yet in athletes
	SELECT
	  ta.athlete_code,ta.name,earliest_possible_dob AS final_min_dob,latest_possible_dob AS max_dob,
	  ta.last_updated AS last_updated,ta.club AS club,
      ta.sex AS sex
	FROM tmp_latest_club ta
	WHERE ta.athlete_code NOT IN (SELECT athlete_code FROM athletes); 
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_final_age_updates where athlete_code='2486306'
    ORDER BY athlete_code;
	select * from athletes
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_coalesce_age_fields
	-- 1) existing athletes that have updates
DROP TABLE IF EXISTS tmp_coalesce_age_fields;
CREATE TABLE tmp_coalesce_age_fields AS
	SELECT fu.athlete_code,fu.name,fu.min_dob,fu.max_dob,fu.last_updated,fu.club,fu.sex,
	  CASE
		WHEN fu.min_dob IS NULL AND fu.max_dob IS NULL THEN NULL
		WHEN fu.min_dob IS NULL THEN ROUND((julianday(date(fu.last_updated)) - julianday(fu.max_dob)) / 365.2425, 2)
		WHEN fu.max_dob IS NULL THEN ROUND((julianday(date(fu.last_updated)) - julianday(fu.min_dob)) / 365.2425, 2)
		ELSE ROUND(((julianday(date(fu.last_updated)) - julianday(fu.max_dob))
			   + (julianday(date(fu.last_updated)) - julianday(fu.min_dob))) / (2.0 * 365.2425), 2)
	  END AS last_age_estimate,
	  CASE
		WHEN fu.min_dob IS NULL AND fu.max_dob IS NULL THEN NULL
		WHEN fu.min_dob IS NULL THEN ROUND((julianday('now') - julianday(fu.max_dob)) / 365.2425, 2)
		WHEN fu.max_dob IS NULL THEN ROUND((julianday('now') - julianday(fu.min_dob)) / 365.2425, 2)
		ELSE ROUND(((julianday('now') - julianday(fu.max_dob)) + (julianday('now') - julianday(fu.min_dob))) / (2.0 * 365.2425), 2)
	 END AS current_age_estimate
    FROM tmp_final_age_updates fu
	LEFT JOIN  athletes a ON fu.athlete_code = a.athlete_code    
    where (a.last_updated IS NULL) OR (fu.last_updated >= a.last_updated);;-- added to stop updating athlete already updated.
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_coalesce_age_fields where athlete_code='2486306'
	select * from athletes where athlete_code='2486306'
	select * from tmp_dob_summary
	--where last_age_estimate>dob_age_years
	order by athlete_code
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_extended_age_fields
 -- 1) existing athletes (use tc values when present, fallback to a.*)
    WITH combined AS (
        SELECT
            fu.athlete_code,fu.final_name,
            COALESCE( tc.new_min_dob, a.min_dob, fu.final_min_dob) AS min_dob,
            COALESCE( tc.new_max_dob, a.max_dob, fu.final_max_dob) AS max_dob,
            COALESCE( tc.new_last_updated, a.last_updated, fu.final_last_updated) AS last_updated,
            COALESCE(tc.new_club,a.club, fu.final_club) AS club,
            COALESCE( tc.new_last_age_estimate, a.last_age_estimate) AS last_age_estimate,
            COALESCE( tc.new_sex, a.sex, fu.final_sex) AS sex
        FROM tmp_final_age_updates fu
        LEFT JOIN athletes a ON a.athlete_code = fu.athlete_code
        LEFT JOIN tmp_coalesce_age_fields tc ON tc.athlete_code = fu.athlete_code
    ),
    ages AS (
        SELECT
            c.*,
            CASE
                WHEN c.min_dob IS NULL AND c.max_dob IS NULL THEN NULL
                WHEN c.min_dob IS NULL THEN (julianday('now') - julianday(c.max_dob)) / 365.2425
                WHEN c.max_dob IS NULL THEN (julianday('now') - julianday(c.min_dob)) / 365.2425
                ELSE (
                    (julianday('now') - julianday(c.max_dob)) +
                    (julianday('now') - julianday(c.min_dob))
                ) / (2.0 * 365.2425)
            END AS dob_age_years
        FROM combined c
    )
    SELECT
        athlete_code,name,min_dob,max_dob,last_updated,club,last_age_estimate,sex,
        CASE
            WHEN dob_age_years IS NULL AND last_age_estimate IS NULL THEN NULL
            WHEN dob_age_years IS NULL THEN ROUND(last_age_estimate, 2)
            WHEN last_age_estimate IS NULL THEN ROUND(dob_age_years, 2)
            WHEN dob_age_years < last_age_estimate THEN ROUND(last_age_estimate, 2)
            ELSE ROUND(dob_age_years, 2)
        END AS new_current_age_estimate
    FROM ages
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_extended_age_fields where athlete_code='11821995' 
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_athlete_update
    WITH base AS (
    SELECT
        a.athlete_code,
        COALESCE(fu.name,a.name) AS new_name,
        COALESCE(fu.club,a.club) AS new_club,
        COALESCE(fu.sex, a.sex)      AS new_sex,
        COALESCE(fu.min_dob, a.min_dob)      AS new_min_dob,
        COALESCE(fu.max_dob, a.max_dob)      AS new_max_dob,
        COALESCE(fu.last_age_estimate,a.last_age_estimate) AS new_last_age_estimate,
        COALESCE(fu.last_updated, a.last_updated) AS new_last_updated   
    FROM athletes a
    LEFT JOIN tmp_extended_age_fields fu USING(athlete_code)
    )
    SELECT
        athlete_code,new_name,new_min_dob,new_max_dob,new_last_updated,name,new_club,new_sex,new_last_age_estimate,
        ROUND( CASE
        WHEN new_min_dob IS NULL AND new_max_dob IS NULL THEN NULL
        WHEN new_min_dob IS NULL THEN (julianday('now') - julianday(new_max_dob)) / 365.2425
        WHEN new_max_dob IS NULL THEN (julianday('now') - julianday(new_max_dob)) / 365.2425
        ELSE ((julianday('now') - julianday(new_max_dob)) + (julianday('now') - julianday(new_min_dob))) / (2.0 * 365.2425)
        END,2) AS new_current_age_estimate
    FROM base;
-- @keys: athlete_code
-- @examples
    SELECT * FROM tmp_athlete_update --where athlete_code='11389772' 
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_new_athletes
        --SELECT t.*
        --FROM tmp_active_athlete_update t
        --LEFT JOIN athletes a
        --ON a.athlete_code = t.athlete_code
        --WHERE a.athlete_code IS NULL;
        select athlete_code,name,
        min_dob,max_dob,last_updated,club,sex, last_age_estimate,current_age_estimate 
        --from tmp_extended_age_fields
        from tmp_coalesce_age_fields
        where athlete_code NOT IN (select athlete_code from athletes);
--------------------------		
DROP TABLE IF EXISTS eventpositions_err;
DROP TABLE IF EXISTS tmp_eventpositions_end;
CREATE TABLE tmp_eventpositions_end AS
select e.event_code, e.event_date, e.formatted_date, e.time, e.time_seconds, e.athlete_code ,e.position,e.comment,e.name,e.club,
	s.earliest_possible_dob as min_dob,s.latest_possible_dob as max_dob,s.age
from eventpositions_view e
join tmp_dob_ranges s 
ON	e.athlete_code=s.athlete_code 
AND e.formatted_date=s.formatted_date


select * from tmp_eventpositions_end
select * from tmp_dob_ranges 

--------------------------	

-- @section: tempTable
-- @tempTable:  tmp_ageRatio_inputs
DROP TABLE IF EXISTS tmp_ageRatio_inputs;
CREATE TABLE tmp_ageRatio_inputs AS
  SELECT
    --DISTINCT(a.athlete_code),e.name,a.min_dob,a.max_dob,a.last_updated,a.current_age_estimate,a.sex,
	a.athlete_code,e.formatted_date,e.formatted_date as last_updated,e.name,e.min_dob,e.max_dob,e.age,a.sex,
    -- guess integer age using max_dob as the anchor (same heuristic as Python caller might pass)
	ROUND(CASE
      WHEN e.min_dob IS NULL AND e.max_dob IS NULL THEN e.age
      WHEN e.min_dob IS NULL THEN (julianday(e.formatted_date) - julianday(e.max_dob)) / 365.2425
      WHEN e.max_dob IS NULL THEN (julianday(e.formatted_date) - julianday(e.min_dob)) / 365.2425
      ELSE ((julianday(e.formatted_date) - julianday(e.max_dob))+ (julianday(e.formatted_date) - julianday(e.min_dob)))/ (2.0 * 365.2425)
	END, 2) as age_guess
  --FROM athletes a
  --JOIN tmp_eventpositions_end e USING (athlete_code)
    FROM tmp_eventpositions_end e
--  JOIN tmp_dob_ranges a 
--  ON e.athlete_code=a.athlete_code and e.formatted_date=a.formatted_date
  JOIN athletes a
  ON e.athlete_code=a.athlete_code
-- @keys: athlete_code
-- @examples
    select *, datetime((julianday(max_dob) + julianday(min_dob)) / 2.0) from tmp_ageRatio_inputs where athlete_code='2491375';	
	select * from athletes where athlete_code='7491589'
	select * from tmp_coalesce_age_fields where athlete_code='7491589'
-------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_calc
DROP TABLE IF EXISTS tmp_ageRatio_calc;
CREATE TABLE tmp_ageRatio_calc AS
  SELECT athlete_code,formatted_date,name,min_dob,max_dob,last_updated,sex,age_guess,
    date(i.max_dob, printf('+%d years', i.age_guess)) AS birthday_max,
    date(i.min_dob, printf('+%d years', i.age_guess + 1)) AS birthday_min_next,
    (julianday(date(i.min_dob, printf('+%d years', i.age_guess + 1))) - julianday(date(i.max_dob, printf('+%d years', i.age_guess)))) AS interval_days,
    (julianday(formatted_date) - julianday(date(i.max_dob, printf('+%d years', i.age_guess)))) AS days_since_birthday_max
  FROM tmp_ageRatio_inputs i
  order by athlete_code,formatted_date;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_calc where athlete_code='2491375';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_fract
DROP TABLE IF EXISTS tmp_ageRatio_fract;
CREATE TABLE tmp_ageRatio_fract AS
  SELECT athlete_code,formatted_date,name,min_dob,max_dob,last_updated,sex,age_guess,birthday_max,birthday_min_next,interval_days,days_since_birthday_max,
    CASE WHEN c.interval_days > 0 THEN (c.days_since_birthday_max / c.interval_days) ELSE 0 
	END AS x_raw
  FROM tmp_ageRatio_calc c;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_fract where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_clamped
DROP TABLE IF EXISTS tmp_ageRatio_clamped;
CREATE TABLE tmp_ageRatio_clamped AS
    SELECT  athlete_code,formatted_date,name,min_dob,max_dob,last_updated,sex,age_guess,birthday_max,birthday_min_next,interval_days,days_since_birthday_max,x_raw,
    CASE WHEN f.x_raw IS NULL THEN 0
        WHEN f.x_raw < 0 THEN 0
        WHEN f.x_raw > 1 THEN 1
        ELSE f.x_raw
    END AS x
    FROM tmp_ageRatio_fract f;
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_clamped where athlete_code='10000389';
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_expanded
    WITH RECURSIVE
    age_dedup AS (
    SELECT age, age_max, sex, age_group,male_age_ratio, sex_age_ratio, rowid,
        ROW_NUMBER() OVER (PARTITION BY age, sex ORDER BY rowid DESC) AS rn
    FROM age_category),
    dedup_sel AS (
    SELECT age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
    FROM age_dedup
    WHERE rn = 1),
    expanded(age_value, age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid) AS (
        -- seed
        SELECT age AS age_value,age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
        FROM dedup_sel
        UNION ALL
        -- recursive step must return the same columns in the same order
        SELECT age_value + 1,age, age_max, sex, age_group, male_age_ratio, sex_age_ratio, rowid
        FROM expanded
        WHERE age_value + 1 <= age_max)
    SELECT *
    FROM expanded;
-- @keys: age_value,sex
-- @examples
    select * from tmp_ageRatio_expanded order by age_value;
-- @endsection
--------------------------
-- @section: tempTable
-- @tempTable:  tmp_ageRatio_final
DROP TABLE IF EXISTS tmp_ageRatio_final;
CREATE TABLE tmp_ageRatio_final AS
        SELECT
        c.athlete_code,c.formatted_date,c.name,c.min_dob,c.max_dob,c.sex, c.age_guess,c.birthday_max,c.birthday_min_next,c.interval_days, c.days_since_birthday_max,c.x,ar.age_value,
        COALESCE(CASE
            WHEN an.male_age_ratio IS NOT NULL
            THEN (an.male_age_ratio * c.x) + (ar.male_age_ratio * (1.0 - c.x))
            ELSE ar.male_age_ratio END,NULL) AS male_age_ratio_new,
        COALESCE(CASE
            WHEN an.sex_age_ratio IS NOT NULL
            THEN (an.sex_age_ratio * c.x) + (ar.sex_age_ratio * (1.0 - c.x))
            ELSE ar.sex_age_ratio END, NULL) AS sex_age_ratio_new
        FROM tmp_ageRatio_clamped AS c
        LEFT JOIN tmp_ageRatio_expanded AS ar ON CAST(ROUND(c.age_guess-0.5) AS INTEGER) = ar.age_value AND ar.sex = c.sex
        LEFT JOIN tmp_ageRatio_expanded AS an ON (CAST(ROUND(c.age_guess-0.5) AS INTEGER) + 1) = an.age_value AND an.sex = c.sex
        --ORDER BY c.athlete_code;
		--ORDER BY c.sex,c.age_guess
-- @keys: athlete_code
-- @examples
    select * from tmp_ageRatio_final_err where athlete_code='10000389';
	select * from tmp_ageRatio_clamped_err
	select * from tmp_coalesce_age_fields where athlete_code='2486306';
	select * from eventpositions where athlete_code='1014475' order by formatted_date 
-- @endsection
