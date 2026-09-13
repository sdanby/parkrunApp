DROP VIEW IF EXISTS eventpositions_view;

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
    event_eligible_appearances,
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
    event_code_count,
   tourist_flag,
   last_event_code_count,
    total_runs,
    best_curve_ranking_current,
    best_curve_ranking_historic,
    best_curve_ranking_current_type

FROM eventpositions;

ALTER TABLE parkrun_events
ADD tourist_count INT DEFAULT 0;

DROP VIEW IF EXISTS parkrun_events_view;

CREATE VIEW parkrun_events_view AS
SELECT
    event_code,
    event_date,
    substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) AS formatted_date,
    last_position,
    volunteers,
    event_number,
    coeff,
    obs,
    coeff_event,
    avg_time,
    avgTimeLim12,
    avgTimeLim5,
    tourist_count
FROM parkrun_events;

CREATE VIEW parkrun_events_view AS
SELECT
    event_code,
    event_date,
    substring(event_date FROM 7 FOR 4) || '-' || substring(event_date FROM 4 FOR 2) || '-' || substring(event_date FROM 1 FOR 2) AS formatted_date,
    last_position,
    volunteers,
    event_number,
    coeff,
    obs,
    coeff_event,
    avg_time,
    avgTimeLim12,
    avgTimeLim5,
    tourist_count
FROM parkrun_events;