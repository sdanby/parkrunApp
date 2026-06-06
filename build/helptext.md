

<a id="top"></a>
# Parkrun Help Manual

This is the single help source for this parkrun app. Use this to navigate through the fields, pages, methods and calculations used in this app. As you navigate through the app itself, there are multiple links to jump to the correct location in this help.

## Contents
* [Introduction](#section-introduction)
* [Concepts](#section-concepts)
* [Feedback](#section-feedback)
* [Navigation](#section-navigation)
* [Weekly Data Updates & New Courses](#section-weekly-updates)
* [Device Differences](#section-device-differences)
* [Key Vocabulary Used](#section-key-vocabulary)
* [Pages](#section-pages)
* [Selection Items and Buttons](#section-selection-items)
* [Table Columns](#section-table-columns)
* [Steve Danby](#section-steve-danby)


<a id="section-introduction"></a>

## Introduction

["I"](#section-steve-danby) built this app because I wanted access to deeper parkrun statistics and a better way to compare courses, participants and clubs against each other. There is a huge amount of parkrun data available, but very few tools that let you explore it properly. This app is my attempt to change that.

To make it happen, I had to learn a lot: how to build web apps, how to use modern AI tools, and how to apply some of the quantitative techniques I picked up years ago as an investment quant analyst. I am **not** a UI expert (you will notice), and I am **not** a great coder (hence the AI support), but I wanted to see whether this concept could work.

There are many improvements possible, but the main question is simple:  
**Does this app give you something genuinely different — something worth taking to the next level - whatever that may be?**  
Or is it just another parkrun app?

Your feedback will help decide that.



<a id="section-concepts"></a>

## Key Concepts of This App

This app is designed to give you a deeper, clearer understanding of parkrun events without needing to be good at maths or statistics. Everything is built to feel fast, simple and connected, even though there is a huge amount of data behind the scenes.

These are **four** core ideas that make this app different from other parkrun tools.

---

### 1. Fast, fluent access to rich event statistics  

Most parkrun apps show basic results and/or simple analysis on a page by page basis.  
This app shows **multiple** inter connecting data points — and it does it effortlessly.

The [Event Analysis](#page-event-analysis) page brings together a wide range of statistics across all your local events. You can switch between items such as:

- number of participants  
- volunteers  
- tourists  
- PBs  
- club runners  
- course difficulty  
- and more  

All of this updates immediately when you change the **Type**, **Calc**, **Period**, or **Agg** controls (see: [Selection Items and Buttons](#section-selection-items)).

The goal is simple:  
**You get powerful insights without needing to understand complex maths.**

---

### 2. Everything is connected — events, courses, participants, clubs and lists  
See: [Event Page](#page-single-event), [Course](#page-course), [Participant](#page-participant), [Club](#page-club), [Lists](#page-lists)

Where other apps make you jump around manually, this app is built so that everything links together.

From any page, you can click straight into:

- the event  
- the course history  
- a participant’s full running profile  
- club statistics  
- top‑1000 lists  

This makes it easy to compare:

- how a course behaves over time  
- how a runner performs across different events  
- how clubs differ in participation  
- how your local events change seasonally  

You never lose your place, and you never have to start again.  
**One click takes you deeper. Another click brings you back.**

---

### 3. New types of analysis you won’t find in other apps  
See: [Course Adj](#control-course-adj), [Other Adj](#control-other-adj), [Hardness Adj](#control-hardness-adj)

This app introduces several new concepts that help you understand parkrun in a more meaningful way:

- **Course Hardness** — how tough a course was on a specific day  
- **Seasonality** — how weather and time of year affect results  
- **Returners** — runners coming back after a break  
- **Recent Bests** — your strongest performances in the last period  
- **Super Tourists** — runners who visit many different events  
- **Participant Rankings** — comparing runners across different planes  
- **Key Course Participants** — who shapes the character of each event  
- **Club Metrics** — deeper insights into club behaviour  

These features help you see patterns that normally stay hidden.  
You do not need to understand the calculations — the app does the hard work.

---

### 4. A level playing field: comparing runners fairly across different courses  
See: [Course Adj](#control-course-adj), [Other Adj](#control-other-adj), [Participant Profile](#section-participant-profile)

Every parkrun course is different. Some are flat and fast. Some are muddy, hilly or twisty. Comparing raw times between courses is unfair.

This app solves that.

It uses:

- **Course Hardness** (how tough the event was)  
- **Course Adjustments** (seasonal and event‑specific)  
- **Age & Sex Adjustments** (optional)  

…to create a **fair comparison** between runners.

This means you can:

- compare your performance at different courses  
- compare yourself with friends who run elsewhere  
- see your true best performances  
- understand whether a slow time was due to the course, not your fitness  

This is shown clearly in the **Participant Profile** and across the **Lists** page.

The idea is simple:  
**You get a fair, honest picture of your running — not distorted by course difficulty.**

---

<a id="section-feedback"></a>

## Feedback

Your feedback is essential, especially for the first group of hand‑picked users testing this app. The goal is to understand what works, what doesn’t, and what could be improved before taking the app any further.

There is a dedicated page called [Log Error / Suggestion](#page-feedback-log) where you can record:

### 1. Errors, bugs or issues
Please report anything that looks wrong, including:
- navigation glitches  
- broken links  
- data inconsistencies  
- unexpected behaviour  
- missing or incorrect results  

Even small issues help improve the overall experience.

### 2. Suggestions and ideas
This app is still evolving, so your ideas matter.  
Please share suggestions such as:
- ways to make the app simpler or clearer  
- better ways to display information  
- new metrics or comparisons you would find useful  
- improvements to layout, navigation or workflow  

The aim is to build something genuinely helpful for the parkrun community.  
Your feedback is a key part of shaping what this app becomes.


(Explain how users can provide feedback, what types of feedback are useful, and where it goes.)

---

<a id="section-navigation"></a>
## Navigation

(Explain how to move between pages, how links behave, how drill-down works, etc.)

---

<a id="section-weekly-updates"></a>
## Weekly Data Updates & New Courses

The app is designed to stay up to date with the latest parkrun activity. Each week, new event results, course changes and participant updates are added so that your analysis always reflects the most recent information.

### Weekly Data Updates
The app refreshes its data shortly after each parkrun weekend. This includes:

- new event results  
- updated participant histories  
- changes in club participation  
- new PBs, returners and recent bests  
- updated course difficulty and seasonal patterns  

These updates ensure that pages such as [Event Analysis](#page-event-analysis), [Participant](#page-participant) and [Lists](#page-lists) always show the most current picture.

### New Courses
When parkrun launches a new event, the app automatically incorporates it into:

- the full course list  
- course‑level statistics  
- participant histories  
- club and tourist metrics  

New courses may take a few weeks to build up enough data for deeper analysis (such as **Course Hardness** or **Seasonality**), but they will appear immediately for navigation and basic statistics.

The goal is simple:  
**You always have access to the latest parkrun landscape, without needing to do anything manually.**

---

<a id="section-device-differences"></a>

## Device Differences

(Describe differences between desktop, tablet, mobile layouts, gestures, scrolling, etc.)

---

<a id="section-key-vocabulary"></a>

## Key Vocabulary Used

(Define the specific terminology used throughout the app — this complements the Glossary.)


This section lists the key terms used throughout the app. Understanding these will help you interpret the tables, charts and comparisons more easily.

All terms are listed in alphabetical order.

| Term | Alias | Description |
|---|---|---|
| **Actual** | | The underlying raw number before any adjustments or comparisons. |
| **Actual%** | | The percentage that the actual number represents relative to a chosen total. |
| **Agg** | Aggregation | Methods used to summarise data across multiple events, such as Average, Max, Min, Range or Growth. |
| **Age** | | The average estimated age of participants at the current event. |
| **All Events** | | Includes every recorded event for the selected course. |
| **Annual** | | Groups data by calendar year. |

| **Average** | Avg | The mean value across the selected period. |
| **Calc** | | Methods applied to data types to produce relative or comparative results (e.g., percentages, deviations). |
| **Cell Agg** | | How each individual cell in a table is summarised (e.g., single value vs averaged). |
| **Clubbers** | | Number of participants associated with a running club at the current event. |
| **Combined Hardness** | | A combined measure of Seasonal Hardness and Event Hardness. |
| **Courses** | | The parkrun course associated with an event location. Note: Event refers to a specific date; Course refers to the location. |
| **Eligible Times** | | Number of participants who ran within their expected time window based on their last 15-week record. |
| **Event Hardness** | | The event-specific difficulty factor based on conditions that are more consistent and measurable. |
| **Event Number** | | The sequential number of the event for a particular course. |
| **First Timers** | | Participants running their first ever parkrun or their first time at this course. |
| **Growth** | Grth | How much a value has increased or decreased over time. |
| **Last 50 Events** | | Uses only the most recent 50 events for analysis. |
| **Maximum** | Max | The highest value in the selected period. |
| **Minimum** | Min | The lowest value in the selected period. |
| **Mnth Seasonality** | | Monthly seasonal patterns affecting course performance. |
| **Participants** | | Parkrunners who run, jog or walk at the current event. |
| **PBs** | Personal Bests | Number of participants achieving their fastest time at this course at the current event. |
| **Period** | | The time window used for analysis (e.g., recent events, annual, monthly, quarterly). |
| **Qtr Seasonality** | | Quarterly seasonal patterns affecting course performance. |
| **Range** | Rng | The difference between the maximum and minimum values. |
| **Recent Bests** | | Number of participants achieving their fastest time in the last 15-week period at this course. |
| **Recent Events** | | Focuses on the most recent set of events (e.g., last 15 weeks). |
| **Regulars** | Regs | Participants who meet a threshold for attending this course frequently. |
| **Returners** | | Participants returning to the course after a period of absence. |
| **Seasonal Hardness** | | The difficulty associated with seasonal conditions (e.g., winter mud, summer heat). |
| **Since Lockdown** | | Includes all events from the first post-lockdown restart onwards. |
| **Super Tourist** | | Participants who visit a large number of different parkrun courses. |
| **Times** | | The average finish time of participants at the current event. |
| **Tourists** | | Participants running at a course other than their most frequent home course. |
| **Type** | Filter | The sub-group or metric variant to display (e.g., Volunteers, PBs, Clubbers). |
| **Unknowns** | | Participants whose category cannot be determined from available data. |
| **Volunteers** | | Number of people who volunteered at the current event rather than running. |

---

<a id="section-pages"></a>

## Pages

(Overview of all major pages: Event Analysis, Single Event, Course, Participant, Lists, etc.)


<a id="page-event-analysis"></a>

### Event Analysis Page

* The **Event Analysis** page is a multi-purpose analysis of your local parkruns providing you with up to date and historical stats 
* The main table is arrange by **event date** and **course**; the intersection cell links to the [**event page**](#page-single-event).
* Any column can be sorted. Click on a cell to drill down to an event and click on a course to see more detail on that.
The opening table shows participants in each event. But use the ‘Type’ select (top corner) to change the metrics:
Event Number, Course hardness factors, Volunteers, Tourists, Regulars, PBs, Clubbers, Eligibles and Unknowns.
Want more stats? Change the ‘Calc’ recalculate the metrics from actuals to relative to total all participants, relative to the course history, deviation from average
The ‘Agg’ allows the user to switch the aggregation column and row from average to total, maximum, minimum, range and growth
Not satisfied with the most recent data use the ‘Period’ selection to go back in time, event to when each course event originally started.
Go one step further and use the ‘Period’ selection to show Annual. Monthly and Quarterly trends.


<a id="section-event-stats-comparison"></a>

### Event Statistics Comparison Chart

This plot compares selected event statistics across dates.
Use legend selection and zoom controls to focus on trends, outliers and cross-event differences.


<a id="page-single-event"></a>

### Event Page 

Single Event is the drill-down view for one event/date and is best used together with Event Analysis.
Use Event Analysis first, then inspect details in Single Event with the same intent for **Calc** and **Type**.


<a id="page-course"></a>

### Course Page

Course provides course-level information and views for each parkrun location.
Use this page to understand route context before comparing performance trends.


<a id="page-participant"></a>

### Participant Page

Participant shows run history and progression for individual athletes.
Use this page to review consistency, milestones and performance changes over time.


<a id="section-participant-profile"></a>

### Participant Profile 

Participant Profile summarises best performances and rank/date/time combinations.
Use this panel to quickly compare adjusted and unadjusted best results.


<a id="section-participant-time-by-date"></a>

### Time by Date Chart

Time by Date shows progression of times over event dates.
Use this plot to inspect trajectory, compare event contexts and identify best windows.


<a id="page-club"></a>

### Club Page

Club groups participants by club affiliation for side-by-side comparison.
Use this page to explore participation patterns across clubs.


<a id="page-lists"></a>

### Lists Page

Lists provides predefined collections and focused subsets of data.
Use this page when you want quick access to common filtered views.


<a id="page-feedback-log"></a>

### Log Error / Suggestion Page

---


<a id="section-selection-items"></a>

## Selection Items and Buttons

(Explain dropdowns, toggles, selectors, filters, and how they interact.)


The following list are the help associated with the different selections, labels and column headers throughout the app

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

---

<a id="section-table-columns"></a>
## Table Columns

(Explain each column type, how they are calculated, and how they change with settings.)


This section defines the key terms used in the help manual and the app. Understanding these terms will help you make the most of the features available.

**Event** - A single parkrun occurrence on a specific date at a specific location.
**Course** - The route taken for a parkrun event, which may have specific characteristics.
**Participant** - A participant in parkrun events, identified by their athlete code.
**Club** - A group of participants who are associated together, often by location or affiliation.
**Time** - The recorded time for a participant to complete the course in an event.
**Age Grade** - A percentage score that compares an athlete's performance to the world record for their age and gender.

---

<a id="glossary"></a>

## Glossary of Terms

---

<a id="section-steve-danby"></a>

## Steve Danby

Steve Danby has had a varied and unconventional career. After graduating from Leeds University in 1986 with a degree in Computational Science — specialising in **Artificial Intelligence** long before it became mainstream — he spent his working life in London across Banking and Investment.

His roles have included:

- developer  
- systems analyst  
- business analyst  
- quantitative and risk analyst  
- strategist  
- fund manager  
- investment technology director  
- project and programme manager
- currently: AI developer - what goes around comes around  

Throughout all of these, he has remained fascinated by technology, data more recently the evolving world of AI - yawn

Outside of work, Steve is an avid fitness enthusiast and an intermittent heavy socialiser — often managing to be both in the same day. His curiosity, energy and willingness to learn new things are what ultimately led to the creation of this app.
