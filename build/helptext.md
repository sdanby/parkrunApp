

<a id="top"></a>
# Parkrun Help Manual

This is the single help source for Event Analysis and Single Event. Use links in the text to jump to any section.
This text will have to change


<a id="glossary"></a>
## Glossary of Terms

This section defines the key terms used in the help manual and the app. Understanding these terms will help you make the most of the features available.

**Event** - A single parkrun occurrence on a specific date at a specific location.
**Course** - The route taken for a parkrun event, which may have specific characteristics.
**Participant** - A participant in parkrun events, identified by their athlete code.
**Club** - A group of participants who are associated together, often by location or affiliation.
**Time** - The recorded time for a participant to complete the course in an event.
**Age Grade** - A percentage score that compares an athlete's performance to the world record for their age and gender.



<a id="page-event-analysis"></a>
## Event Analysis

Event Analysis compares events over time and supports table and plot views.
Start with **Calc**, then set **Type**, **Period** and **Agg**.



<a id="section-event-stats-comparison"></a>
## Event Statistics Comparison

This plot compares selected event statistics across dates.
Use legend selection and zoom controls to focus on trends, outliers and cross-event differences.



<a id="page-single-event"></a>
## Single Event

Single Event is the drill-down view for one event/date and is best used together with Event Analysis.
Use Event Analysis first, then inspect details in Single Event with the same intent for **Calc** and **Type**.



<a id="page-course"></a>
## Course

Course provides course-level information and views for each parkrun location.
Use this page to understand route context before comparing performance trends.



<a id="page-participant"></a>
## Participant

Participant shows run history and progression for individual athletes.
Use this page to review consistency, milestones and performance changes over time.



<a id="section-participant-profile"></a>
## Participant Profile

Participant Profile summarises best performances and rank/date/time combinations.
Use this panel to quickly compare adjusted and unadjusted best results.



<a id="section-participant-time-by-date"></a>
## Time by Date

Time by Date shows progression of times over event dates.
Use this plot to inspect trajectory, compare event contexts and identify best windows.



<a id="page-club"></a>
## Club

Club groups participants by club affiliation for side-by-side comparison.
Use this page to explore participation patterns across clubs.



<a id="page-lists"></a>
## Lists

Lists provides predefined collections and focused subsets of data.
Use this page when you want quick access to common filtered views.



<a id="control-type"></a>
### Calc

Calc controls the metric family shown in the analysis.
Use it first because it determines how values are interpreted in other controls.



<a id="control-filter"></a>
### Type

Type selects the subgroup or metric variant.
It works with Calc to decide what each cell means.



<a id="control-period"></a>
### Period

Period controls the time window or aggregation period.
Changing Period can switch between granular events and grouped periods.



<a id="control-agg"></a>
### Agg

Agg defines how values are summarised across selected events or periods.
Average is a common default, while Range and Growth are better for trend interpretation.



<a id="control-cell-agg"></a>
### Cell Agg

Cell Agg controls how each matrix cell value is formed.
Use this when you want to switch between single-value and averaged cell behaviour.



<a id="control-time-adj"></a>
### Time Adj

Time Adj applies optional adjustments for time-based analysis.
Use this only when comparing pace/time values across different conditions.



<a id="control-table-view"></a>
### Table View

Table View enables the user to select different column sets, i.e. Basic (most important), Detailed (more columns) and All Time Adjustments (how times adjust according to analysis).



<a id="control-athlete-code"></a>
### Athlete Code

Athlete Code shows the unique identifier for the selected participant.
Use it to confirm you are viewing the intended runner when switching between pages and links.



<a id="control-estimated-age"></a>
### Estimated Age

Estimated Age shows the participant's current age estimate used for context in performance interpretation.
Use it to quickly understand age-related context when reviewing run history and adjustments.



<a id="control-total-runs"></a>
### Total Runs

Total Runs shows the total number of runs recorded for the selected participant.
Use this value as quick context for how large the participant history is before interpreting trends or adjustments.



<a id="control-recent-club"></a>
### Recent Club

Recent Club shows the latest known club affiliation for the selected participant.
Use it to confirm current club context before comparing participant runs or opening club-level pages.



<a id="control-freq-course"></a>
### Freq Course

Freq Course shows the participant's most frequent course over the last 1 year.
It is derived from the row with the highest Event Count in that 1-year window.
If multiple courses tie on Event Count, the most recent course is used.
Use it as a quick shortcut to the course page most associated with the participant's recent running pattern.



<a id="control-course-adj"></a>
### Course Adj

Course Adj controls whether course-condition factors are applied to the displayed results.
Use no adjustment (default) when you want the raw recorded values.
Use seasonal adjustments when you want to account for broad seasonal effects across the course.
Use full event adjustments when you want the strongest correction for event-level difficulty on that specific date.
For consistency, keep this setting fixed while comparing rows in the same table.



<a id="control-other-adj"></a>
### Other Adj

Other Adj controls participant-level adjustment type applied in the table.
Use no adjustment (default) to keep the non-course-adjusted baseline.
Use age adjustments to normalize for age differences.
Use sex adjustments to normalize for sex differences.
Use age & sex adjustment to apply both factors together.
When comparing columns, keep Other Adj fixed so differences reflect the data rather than a setting change.



<a id="control-list-select"></a>
### List Selection

List selection controls which top-1000 leaderboard is loaded on the Lists page.
Use Fastest Athletes - All Time or Fastest Athletes - Over last 1 Year to rank athletes by best adjusted performance for the chosen Course Adj and Other Adj settings.
Use Highest Total Runs, Highest Local Runs, or Highest Local Runs - Over last 1 Year to rank athletes by participation counts instead.
The row still shows one representative performance for each athlete, while the selected list mode decides how the top 1000 are chosen.
Keep List selection fixed when comparing rows, and use the table headers if you want to re-sort the loaded results client-side.



<a id="control-adjustment-filter"></a>
### Filtered By Adjustments

Filtered By Adjustments controls whether Course Adj and Other Adj change which MV family supplies the representative row.
When ticked, the selected Course Adj and Other Adj combination chooses the adjusted MV for the current history or 1-year list mode.
When unticked, the Lists page ignores Course Adj and Other Adj for MV selection and uses the base unadjusted MV for the selected history or 1-year mode.
You can change this independently after choosing a list, even though each list also sets a default tick or untick state.



<a id="control-participant-filter"></a>
### Participants

Participants controls the minimum participation threshold applied to the Lists page.
Use all participants to show the full eligible leaderboard.
Use Participants >50 total-runs to restrict the list to athletes with broader overall parkrun history.
Use Participants > 50 local-runs to focus on runners with strong local participation.
Use Participants > 10 local_run_1y to focus on athletes active locally over the last year.
This filter works together with List selection, Course Adj and Other Adj, so keep those fixed when comparing how thresholds change the leaderboard.



<a id="control-hardness-adj"></a>
### Hardness Adj

Hardness Adj shows the combined hardness indicator for the selected event and settings.
Use it as context when interpreting adjusted time comparisons across events.
Higher hardness values generally indicate tougher conditions relative to the baseline.
Keep in mind that hardness is an explanatory indicator and should be read together with course and other adjustment choices.
Use the same Course Adj and Other Adj settings while comparing events so hardness context stays consistent.
Hardness Adj does not replace raw time interpretation; it is a companion metric to explain why adjusted columns may differ.
