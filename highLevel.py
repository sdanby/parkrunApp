# INPUTS
events = list of parkrun_event_ids
dates = list of dates per event
runners = list of runner_ids with associated run history
run_data = {
    (runner_id, event_id, date): {
        'time': float,
        'age': int,
        'pb_15_weeks': float,
        'eligible': bool,
        ...
    }
}

# INITIALISE hardness estimates (e.g. with priors)
hardness = {
    (event_id, date): initial_hardness_value_from_first_year_sample(event_id)
}

# STEP 1 - Estimate Adjusted Times and Eligibility
for (runner, event, date) in run_data:
    T = run_data[(runner, event, date)]['time']
    H = hardness[(event, date)]
    adjusted_time = T / H

    # Check if adjusted time within threshold of PB (soft constraint)
    eligibility_score = compute_eligibility_score(adjusted_time, run_data[(runner, event, date)]['pb_15_weeks'])
    run_data[(runner, event, date)]['eligible'] = eligibility_score > threshold

# STEP 2 - Group eligible runs to inform hardness updates
for event in events:
    for date in dates[event]:
        eligible_runs = collect_eligible_runs(event, date)
        if len(eligible_runs) < min_sample_size:
            continue  # insufficient data

        # Compute deviation from personal bests
        deviations = [
            adjusted_time(run, hardness[(event, date)]) - run['pb_15_weeks']
            for run in eligible_runs
        ]

        # STEP 3 - Optimise hardness coefficient
        best_H = optimise_hardness(
            current_H=hardness[(event, date)],
            deviations=deviations,
            runner_history=eligible_runs,
            penalty_function=pb_override_penalty,
            prior_distribution=seasonal_prior(event, date)
        )

        hardness[(event, date)] = best_H

# STEP 4 - Smoothing and Temporal Adjustment
for event in events:
    hardness_values = [hardness[(event, date)] for date in sorted(dates[event])]
    hardness_smoothed = smooth_series(hardness_values, seasonal_adjustment=True)
    update_hardness(event, hardness_smoothed)

# STEP 5 - Diagnostics and Contribution Analysis
for (runner, event, date) in run_data:
    if run_data[(runner, event, date)]['eligible']:
        contribution_score = compute_runner_contribution(runner, event, date, hardness)
        annotate_run_data(run_data[(runner, event, date)], contribution_score)

def detect_event_anomaly(event, date, eligible_runs):
    deviation_scores = [
        abs(adjusted_time(run, hardness[(event, date)]) - run['pb_15_weeks'])
        for run in eligible_runs
    ]
    if std(deviation_scores) > anomaly_threshold and median(deviation_scores) < -pb_improvement_threshold:
        flag_anomaly(event, date)

def optimise_hardness(current_H, eligible_runs, runner_history, prior_distribution, penalty_function):

    best_H = current_H
    lowest_loss = float('inf')

    # Try hardness values in a range around current_H
    for candidate_H in candidate_values_around(current_H):
        adjusted_times = []
        pb_deviations = []
        pb_overrides = 0
        anomaly_flags = []

        for run in eligible_runs:
            T = run['time']
            PB = run['pb_15_weeks']
            adjusted_time = T / candidate_H
            deviation = adjusted_time - PB
            adjusted_times.append(adjusted_time)
            pb_deviations.append(deviation)

            # Check for PB override
            if adjusted_time < PB:
                pb_overrides += 1
                anomaly_flags.append(penalty_function(adjusted_time, PB, runner_history[run['runner_id']]))

        # Aggregated loss function
        deviation_std = std(pb_deviations)
        pb_penalty = sum(anomaly_flags) * penalty_weight
        prior_penalty = prior_loss(candidate_H, prior_distribution)

        total_loss = deviation_std + pb_penalty + prior_penalty

        # Update if better
        if total_loss < lowest_loss:
            best_H = candidate_H
            lowest_loss = total_loss

    return best_H

def compute_runner_contribution(runner_id, event_id, date, hardness, run_data):
    T = run_data['time']
    PB = run_data['pb_15_weeks']
    adjusted = T / hardness
    influence_score = exp(-abs(adjusted - PB))  # Higher if close to PB
    anomaly_score = flag_if_pb_override(adjusted, PB)
    return {
        'adjusted_time': adjusted,
        'contribution_score': influence_score,
        'pb_override_flag': anomaly_score
    }
