DROP TABLE IF EXISTS tmp_time_adjustment;
CREATE TABLE tmp_time_adjustment AS
	select e.event_date,e.event_code,time,athlete_code,age_ratio_male,age_ratio_sex,
	substr(e.event_date, 7, 4) || char(45) || substr(e.event_date, 4, 2) || char(45) || substr(e.event_date, 1, 2)	as formatted_date,
		CASE
			WHEN length(time) - length(replace(time, ':', '')) = 2 THEN
				CAST(substr(time, 1, instr(time, ':')-1) AS INTEGER) * 3600 +
				CAST(substr(time, instr(time, ':')+1, instr(substr(time, instr(time, ':')+1), ':')-1) AS INTEGER) * 60 +
				CAST(substr(time, length(time) - 1, 2) AS INTEGER)
			ELSE
				CAST(substr(time, 1, instr(time, ':')-1) AS INTEGER) * 60 +
				CAST(substr(time, instr(time, ':')+1) AS INTEGER)
		END AS time_seconds, adj_time_seconds,adj2_time_seconds,coeff,coeff_event
	from  eventpositions e 
	join parkrun_events p ON e.event_code=p.event_code and e.event_date=p.event_date;
select formatted_date,event_code,athlete_code,
	coeff as season_adj,
	coeff+coeff_event-1 as event_adj,
	age_ratio_male as age_adj,
	age_ratio_sex/age_ratio_male as sex_adj,
	time,
	printf('%d:%02d', CAST(time_seconds/coeff AS INTEGER) / 60, CAST(time_seconds/coeff AS INTEGER) % 60) as season_adj_time,
	printf('%d:%02d', CAST(time_seconds/(coeff+coeff_event-1) AS INTEGER) / 60, CAST(time_seconds/(coeff+coeff_event-1) AS INTEGER) % 60) as event_adj_time,		
	printf('%d:%02d', CAST(time_seconds/age_ratio_male AS INTEGER) / 60, CAST(time_seconds/age_ratio_male AS INTEGER) % 60) as age_adj_time,		
	printf('%d:%02d', CAST(time_seconds/age_ratio_sex AS INTEGER) / 60, CAST(time_seconds/age_ratio_sex AS INTEGER) % 60) as age_sex_time,		
	printf('%d:%02d', CAST(time_seconds/coeff/age_ratio_male AS INTEGER) / 60, CAST(time_seconds/coeff/age_ratio_male AS INTEGER) % 60) as age_season_adj_time,		
	printf('%d:%02d', CAST(time_seconds/coeff/age_ratio_sex AS INTEGER) / 60, CAST(time_seconds/coeff/age_ratio_sex AS INTEGER) % 60) as age_sex_season_adj_time,		
	printf('%d:%02d', CAST(time_seconds/(coeff+coeff_event-1)/age_ratio_male AS INTEGER) / 60, CAST(time_seconds/(coeff+coeff_event-1)/age_ratio_male AS INTEGER) % 60) as age_event_adj_time,		
	printf('%d:%02d', CAST(time_seconds/(coeff+coeff_event-1)/age_ratio_sex AS INTEGER) / 60, CAST(time_seconds/(coeff+coeff_event-1)/age_ratio_sex AS INTEGER) % 60) as age_sex_event_adj_time,		
	time_seconds,
	time_seconds/coeff as season_adj_time_seconds,
	time_seconds/(coeff+coeff_event-1) as event_adj_time_seconds,
	time_seconds/age_ratio_male as age_adj_time_seconds,
	time_seconds/age_ratio_sex as age_sex_adj_time_seconds,
	time_seconds/coeff/age_ratio_male as age_season_adj_time_seconds,
	time_seconds/coeff/age_ratio_sex as age_sex_season_adj_time_seconds,
	time_seconds/(coeff+coeff_event-1)/age_ratio_male as age_event_adj_time_seconds,
	time_seconds/(coeff+coeff_event-1)/age_ratio_sex as age_sex_event_adj_time_seconds
from tmp_time_adjustment
where athlete_code='528017'
order by age_event_adj_time
--order by formatted_date DESC
-- show basic/detailed
-- show adj factors/adj times/all adj
-- no_adj/event_adj/season_adj
-- no_adj/age_adj/sex_adj/ag_sex_adj

select * from eventpositions where event_code=1 and event_date='10/01/2026' 
select * from athletes where athlete_code='11821995'