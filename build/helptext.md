

<a id="top"></a>
# Parkrun Help Manual

This is the single help source for this parkrun app. Use this to navigate through the fields, pages, methods and calculations used in this app. As you navigate through the app itself, there are multiple links to jump to the correct location in this help.

## Contents
* [Introduction](#section-introduction)
* [Getting Started](#section-getting-started)
* [Concepts](#section-concepts)
* [Feedback](#section-feedback)
* [Navigation](#section-navigation)
* [Weekly Data Updates & New Courses](#section-weekly-updates)
* [Device Differences](#section-device-differences)
* [Glossary of Terms](#glossary)
* [Pages](#section-pages)
* [Steve Danby](#section-steve-danby)


<a id="section-introduction"></a>

## Introduction

["I"](#section-steve-danby) built this app because I wanted access to deeper parkrun statistics and a better way to compare courses, participants and clubs against each other. There is a huge amount of parkrun data available, but very few tools that let you explore it properly. This app is my attempt to change that.

To make it happen, I had to learn a lot: how to build web apps, how to use modern AI tools, and how to apply some of the quantitative techniques I picked up years ago as an investment quant analyst. I am **not** a UI expert (you will notice), and I am **not** a great coder (hence the AI support), but I wanted to see whether this concept could work.

There are many improvements possible, but the main question is simple:  
**Does this app give you something genuinely different — something worth taking to the next level - whatever that may be?**  
Or is it just another parkrun app?

Your feedback will help decide that.

<a id="section-getting-started"></a>

## Getting Started

To reach this stage you will have had to go through the login security and hopefully set yourself up with a password or used google security feature:

<img src="/help-images/login-dialogbox.png" alt="Login dialog box" height="200" />

Next you will have been asked to asscoiate yourself with the parkrun athlete code and default course. 
Neither of these are mandatory but they will make navigation features easier when using the app:

<img src="/help-images/confirm-profile.png" alt="Confirm your profile" height="200" />

On the **Home** page navigation is through the burger bar in the top left-hand corner and each page, help is covered in detail: [Pages](#section-pages)

<img src="/help-images/burger-menu.png" alt="Burger Menu" height="200" />

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
- club members  
- course difficulty  
- and more  

All of this updates immediately when you change the **Type**, **Calc**, **Period**, or **Agg** controls (see: [Glossary of Terms](#glossary)).

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
- **Returners** — participants coming back after a break  
- **Recent Bests** — your strongest performances in the last period  
- **Super Tourists** — participants who visit many different events  
- **Participant Rankings** — comparing participant across different planes  
- **Key Course Participants** — who shapes the character of each event  
- **Club Metrics** — deeper insights into club behaviour  

These features help you see patterns that normally stay hidden.  
You do not need to understand the calculations — the app does the hard work.

---

### 4. A level playing field: comparing participants fairly across different courses  
See: [Course Adj](#control-course-adj), [Other Adj](#control-other-adj), [Participant Profile](#section-participant-profile)

Every parkrun course is different. Some are flat and fast. Some are muddy, hilly or twisty. Comparing raw times between courses is unfair.

This app solves that.

It uses:

- **[Course Hardness](#section-course-hardness)** (how tough the event was)  
- **Course Adjustments** (seasonal and event‑specific)  
- **Age & Sex Adjustments** (optional)  

…to create a **fair comparison** between participants.

This means you can:

- compare your performance at different courses  
- compare yourself with friends who run elsewhere  
- see your true best performances  
- understand whether a slow time was due to the course, not your fitness  

This is shown clearly in the **Participant Profile** and across the **Lists** page.

The idea is simple:  
**You get a fair, honest picture of your running — not distorted by course difficulty.**

---

<a id="section-course-hardness"></a>
### 5. Course Hardness Model

Course Hardness is one of the core ideas behind this app. It provides a way to understand how difficult a course was on a specific day, and how that difficulty compares across different courses and different times of the year. The model has two components:

1. **Seasonal Hardness**  
2. **Event Hardness**

These are then combined to form **Combined Hardness**, which can be used to adjust participant times fairly.

---

#### Seasonal Hardness

Seasonal Hardness measures how tough a course was **relative to its own recent history**.

The app looks at:

- participants who regularly attend the course  
- their finish times over a **15‑week window** (a period where participants are generally consistent)  
- how their times change from event to event  

To keep the comparison fair, the model filters out participants whose time is far outside their normal range (for example, if they were taking it easy that day).

By comparing these consistent participants across recent events, the app can estimate whether the course was:

- faster than usual  
- slower than usual  
- or behaving as expected  

Seasonal Hardness typically reflects **weather**, **ground conditions**, **seasonal variation**, and other repeating factors.

---

#### Event Hardness

Event Hardness compares the course to **other courses**, not just itself.

This uses:

- tourists  
- local participants who have run at other courses  
- returning participants with comparable history elsewhere  

Again, filtering removes participants who did not perform within their normal range.

Their times are first adjusted by the **Seasonal Hardness** (so we compare like‑for‑like conditions).  
Then the model looks at how their adjusted times differ across courses.

This produces a **cross‑course differential**, showing how much harder or easier this course was compared to others on the same day.

---

#### Combined Hardness

Combined Hardness is simply:

**Seasonal Hardness + Event Hardness**

This gives a single value representing how difficult the course was **on that specific event**, relative to:

- the easiest courses  
- in the easiest conditions  
- at the easiest time of year  

A Combined Hardness of **0.0%** means:

- the course is flat or fast  
- conditions were ideal  
- participants performed at their most favourable level  

Higher values indicate tougher conditions or inherently harder courses.

---

#### Event Adjustment (Adjusted Time)

Combined Hardness can be applied directly to a participant’s time to produce an **Event Adjusted Time**.

This adjusted time estimates:

- what the participant might have run  
- on a neutral, flat course  
- in ideal conditions  

It allows fairer comparisons between:

- different courses  
- different dates  
- different seasonal conditions  

This is the foundation for comparing participants on a **level playing field** across the entire parkrun landscape.


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

<a id="glossary"></a>

## Glossary of Terms

This section lists the short labels, columns, controls and metric names used throughout the app. The entries are intentionally brief so they can act as link targets from the UI. Where the app uses a short form in a table or button, it is shown in brackets.

The existing `control-*` anchors used by the app are defined here so help jumps land in one place.

<a id="term-actual-deviation"></a>
### #Actual Deviation  
<a id="calc-actual-deviation"></a>

Shows the **difference** between today’s value and the **average for the selected Period**, in absolute units.

Example:  
**Combined Hardness − Average Combined Hardness (over Period)**  
- **0** means today matches the average  
- **positive (blue)** means harder than average  
- **negative (red)** means easier than average  

This is useful when you want to see the **size of the difference**, not just the percentage.

<a id="term-percent-deviation"></a>
### %Deviation  
<a id="calc-percent-deviation"></a>

Shows how today’s value compares to the **average for the selected Period**.

Formula:  
**(Today ÷ Period Average) − 1**, expressed as a percentage.

Example:  
**1st Timers / Average 1st Timers (over Period)**  
- **0%** means today is exactly average  
- **positive (blue)** means above average  
- **negative (red)** means below average  

This helps you spot **trends and anomalies** across the Event Analysis table.

<a id="term-percent-total"></a>
### %Total

Shows a selected type as a share of the total population for that row, period or event. It is useful when the raw counts are less important than the proportion they represent.

<a id="term-first-club-run"></a>
### 1st club run (Lst club run)

Marks the first date, and where shown the last date, that a participant is recorded for a club-specific history. These fields help show the span of an athlete's relationship with that club.

<a id="term-first-timers"></a>
### 1st Timers (First Timers)

Participants completing the course for the first time — either their first ever parkrun or their first time at this specific course.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="calc-actual"></a>
<a id="term-actual"></a>
### Actual 

Shows the **absolute value** of the selected Type.  
Examples include:

- number of participants  
- number of volunteers  
- number of tourists  
- number of PBs  

Use this when you want the **raw counts** without any comparison or scaling.

<a id="term-actual-percent"></a>
### Actual %  
<a id="calc-actual-percent"></a>

Shows the selected Type as a **percentage of participants** at that event.

Example:  
**Volunteers / Participants %**  
This shows what proportion of the event was supported by volunteers.

<a id="term-ae-adj"></a>
### AE Adj

Short label for age-and-event adjusted time or score fields. It indicates that both event conditions and age correction have been applied.

<a id="term-aes-adj"></a>
### AES Adj

Short label for age-sex-event adjusted values. It is typically the most adjusted variant shown when comparing performances on a like-for-like basis.

<a id="term-age"></a>
### Age

Represents the **average estimated age** of participants at the selected event.  
Age is an **event‑level metric**, not a participant count, and therefore only supports **Calc = Actual** and **Agg = Average**.

Age is selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-age-adj"></a>
### Age Adj (Age Adj.)

Indicates that an age-based normalisation has been applied. This lets performances or counts be compared more fairly across age groups.

<a id="term-age-sex-adj"></a>
### Age and Sex Adj.

Indicates that both age and sex adjustments are applied together. It is used when you want the strongest participant-level normalisation without adding course-condition adjustments.

<a id="term-age-grade"></a>
### Age grade (Age grd)

An age-grading percentage that compares a performance to the best known standard for that athlete's age and sex. Higher values indicate stronger relative performances.

<a id="term-age-group"></a>
### Age group (Age grp)

The participant's age category label. It is used for sorting, grouping and interpretation across participant, event and course pages.

<a id="control-agg"></a>
### Aggregation (Agg)

Agg controls **how values are summarised** on the [Event Analysis](#page-event-analysis) page.  
It determines how the data is combined across:

- the **top horizontal grey header** (across all courses for a given date)  
- the **left‑hand second column** (across all selected Periods for a given course)

The available aggregation options depend on the combination of **Type** and **Calc** selected:

- [Type](#control-type)  
- [Calc](#control-calc)

Agg does not change the underlying data — it changes **how multiple values are combined** to produce a summary.

The available aggregation methods are:

- [Average](#agg-average)  
- [Total](#agg-total)  
- [Maximum](#agg-maximum)  
- [Minimum](#agg-minimum)  
- [Range](#agg-range)  
- [Growth](#agg-growth)

<a id="term-all-events"></a>
### All Events

Uses the full recorded history for the selected course or metric. Choose it when you want maximum history rather than a recent-window view.

<a id="term-all-time-adjustments"></a>
### All Time Adjustments

A table view that exposes multiple adjusted-time variants side by side. It is mainly used on event and participant-style pages when you want to inspect how each adjustment changes the result.

<a id="term-annual"></a>
### Annual

Groups data by year rather than by single event. Use it when you want broad long-run trend comparisons instead of week-by-week movement.

<a id="term-as-adj"></a>
### AS Adj

Compact label used where space is tight for a combined age and sex adjustment field. It is a shorthand display label rather than a separate concept.

<a id="control-athlete-code"></a>
### Athlete code

Athlete Code is the unique identifier used to find a participant across pages and tables. Use it to confirm you are viewing the intended runner when names are similar or when you move between linked pages.

<a id="term-average"></a>
<a id="agg-average"></a>
### Average (Avg)

Average provides:

- the **average value across all courses** for the same day (top grey header)  
- the **average value across all selected Periods** for a course (left‑hand column)

Example:  
Average participants across all courses on a given Saturday, or average PBs across the last 15 events.

Use this when you want a **central value** that smooths out variation.

<a id="term-basic"></a>
### Basic

The compact table view that focuses on the most important columns. Use it when you want a quicker overview with less horizontal scrolling.

<a id="term-best-time"></a>
### Best Time

The strongest recorded raw finish time in the selected context. On Top 250 or participant-style tables it is usually the athlete's best qualifying time in that slice.

<a id="control-calc"></a>
### Calc

Calc controls **how the selected Type is interpreted** on the [Event Analysis](#page-event-analysis) page.  
It allows you to switch between absolute values, relative percentages, and deviation‑based comparisons so you can analyse events from different perspectives.

Calc does not change the underlying data — it changes **how the data is expressed**, helping you see patterns across events, courses and time periods.

The available options are:

- [Actual](#term-actual)  
- [Actual %](#term-actual-percent)  
- [%Total](#term-percent-total)  
- [%Deviation](#term-percent-deviation)  
- [#Actual Deviation](#term-actual-deviation)

<a id="control-cell-agg"></a>
### Cell Agg

Cell Agg controls how each matrix cell value is formed when a grouped view contains multiple underlying events. Use it when you want to switch between single-value and averaged cell behaviour.

<a id="term-club"></a>
### Club

The running club associated with a participant or a club-focused grouping used elsewhere in the app. Club links are often clickable and act as a drill-down path into Club pages.

<a id="term-club-runs"></a>
### Club Runs (Club runs 1y)

Counts how many times a participant has appeared for a club in the selected history window. The `1y` variant limits that count to the last year.

<a id="term-clubbers"></a>
### Clubbers

Participants who are associated with a running club at the event. This shows how many club‑affiliated participants took part.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-comb-tot"></a>
### Comb tot

A compact column label used where space is limited for a combined total. In context it usually represents a total count compiled across multiple qualifying event types or histories.

<a id="term-combined-hardness"></a>
### Combined Hardness

Combined Hardness is the sum of Seasonal Hardness and Event Hardness. It provides a single value representing how difficult the course was on that specific event, relative to the easiest courses in the best conditions.  
For a full explanation, see the [Course Hardness Model](#section-course-hardness).


<a id="term-course"></a>
### Course

The parkrun location or route, distinct from an individual dated event. Many tables let you drill from a course label into deeper course-level history.

<a id="term-course-number"></a>
### Course #

Short label used where a course-related event count or appearance count needs to fit in a narrow column. It usually refers to the number of times something happened at that course.

<a id="control-course-adj"></a>
### Course adj

Course Adj controls whether course-condition factors are applied to the displayed results. Use no adjustment when you want the raw recorded values, seasonal adjustment when you want to allow for broad seasonal effects, and full event adjustment when you want the strongest correction for the exact event conditions on that date.

<a id="term-current-club"></a>
### Current Club

The latest known club associated with a participant. It gives current affiliation context and is often used as a navigation link into club analysis.

<a id="term-detail"></a>
### Detail (Detailed)

The expanded table view that shows more columns than Basic. Use it when you need more explanatory metrics and are happy to scroll horizontally.

<a id="term-distinct-events"></a>
### Distinct events

Counts unique events rather than total runs. It is useful when you want to know breadth of attendance instead of repeat participation at the same event.

<a id="term-eligible-runs"></a>
### Eligible runs / Eligible Times

Participants whose finish times fall within their normal expected time window based on their recent 15‑week history.  
Eligible Times are more likely to contribute to the **Course Hardness Model**, because they represent consistent performance.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-es-adj"></a>
### ES Adj

Compact label for a sex-and-event adjusted value where table space is limited. It indicates a more adjusted comparison than raw or single-factor fields.

<a id="control-estimated-age"></a>
### Estimated Age

Estimated Age shows the participant's current age estimate used for context in performance interpretation and age-based calculations. It is supporting information rather than a standalone performance metric.

<a id="term-ev-adj"></a>
### Ev adj

Short label for an event-adjusted value, most often an event-adjusted time. It applies the event-specific hardness correction without adding other participant-level adjustments.

<a id="term-event-date"></a>
<a id="control-event-date"></a>
### Event Date (Ev Date)

The specific calendar date for a single event instance. It distinguishes one occurrence of a course from the course itself.

<a id="term-event-hardness"></a>
### Event Hardness

Event Hardness compares the course to other courses by analysing tourists and local participants who have run elsewhere. After adjusting for Seasonal Hardness, it shows how much harder or easier this course was relative to others on the same day.  
For a full explanation, see the [Course Hardness Model](#section-course-hardness).



<a id="term-event-number"></a>
<a id="control-event-number"></a>
### Event Number (Event #, Event # 1Y)

Event Number is the **sequential count of how many times a course has held an event**. For example, if a course has been operating for several years, its Event Number will be higher than a newly launched course.

It is an **event‑level value**, meaning it describes the event itself rather than the participants. It does not depend on who took part — it simply reflects the position of that event in the course’s history.

The one‑year variant (**Event # 1Y**) applies the same idea but within the last‑year window used on certain tables.

Event Number is selected via the **Type** control on the [Event Analysis](#page-event-analysis) page.

<a id="term-event-total"></a>
### Event Total

The full participant total for a single event or summary row. It is typically used as a headline count that sets the scale for other metrics in the same view.

<a id="control-freq-course"></a>
### Freq Course

Freq Course shows the participant's most frequent course over the last year. It is derived from the course with the highest event count in that window, and if multiple courses tie the most recent one is used.

<a id="term-freq"></a>
### Freq (Freq 1y)

Compact label for frequency or count-in-window metrics. The `1y` form limits the count to the most recent year.

<a id="term-full-event-adj"></a>
### Full event Adj

The strongest course-condition adjustment option, applying event-level correction instead of only seasonal correction. Use it when you want to compare performances after allowing for the exact event conditions.

<a id="term-growth"></a>
<a id="agg-growth"></a>
### Growth

Growth measures the **linear trend** across the selected Period.  
It shows whether the metric is increasing or decreasing over time.

Example:  
Growth in participants over the last 15 events, or growth in volunteers across the last year.

Growth is only calculated when the Period contains **multiple events** and is meaningful for time‑based trends.

Use this to understand **direction of change** rather than level.

<a id="term-hardness-adj"></a>
### Hardness adj

Refers to hardness-based adjustment context used when times or comparisons are normalised for course toughness. It is usually explanatory rather than a separate leaderboard target.

<a id="control-hardness-adj"></a>
### Hardness Adj

Hardness Adj shows the combined hardness context for the selected event and adjustment settings. Use it as explanatory context when interpreting adjusted time comparisons across events, not as a replacement for the raw time itself.

<a id="term-hist-rank"></a>
### Hist Rank

Historic ranking for a participant or value in the selected comparison framework. It contrasts with current rank to show how standing changes depending on the reference period.

<a id="term-last-50-events"></a>
### Last 50 Events

Limits the analysis window to the latest 50 events. Use it when recent form matters more than full history.

<a id="term-last-volunt"></a>
### Last Volunt

Shows the last recorded volunteering date in the selected context. It gives recency information for volunteer activity.

<a id="term-local-runs"></a>
### Local Runs

Counts runs at a defined local set of courses or the selected local course context. It is often used in lists and participant summaries to distinguish local engagement from overall participation.

<a id="term-maximum"></a>
<a id="agg-maximum"></a>
### Maximum (max)

Maximum identifies the **highest value**:

- across all courses for a given day  
- across all selected Periods for a course

Cells that contain the maximum value for a course are highlighted with a **green background**.

Example:  
The course with the highest number of 1st Timers on a given day.

Use this to spot **peaks** or standout events.

<a id="term-members"></a>
### Members (Members 1y)

Counts club members or current members in club-focused tables. The `1y` version restricts the count to recent one-year activity.

<a id="term-minimum"></a>
<a id="agg-minimum"></a>
### Minimum

Minimum identifies the **lowest value**:

- across all courses for a given day  
- across all selected Periods for a course

Cells that contain the minimum value for a course are highlighted with a **red background**.

Example:  
The course with the lowest number of PBs on a given day.

Use this to spot **dips** or unusually low activity.

<a id="term-month-seasonality"></a>
### Mnth seasonality

Monthly grouping of seasonal patterns. It helps show whether a course behaves differently in different months of the year.

<a id="term-order"></a>
### Order (Order 1y, Ord)

Sort order or ranking order label used in compact tables. The one-year form applies the same ordering idea within the last-year window.

<a id="control-other-adj"></a>
### Other adj

Other Adj controls the participant-level adjustment type applied in the table. Use no adjustment for the baseline view, age adjustment to normalise for age differences, sex adjustment to normalise for sex differences, and age-and-sex adjustment when you want both factors applied together.

<a id="control-list-select"></a>
### List Selection

List Selection controls which top-style leaderboard is loaded on the Lists page. Use performance-led lists when you want to rank athletes by their best adjusted result, and participation-led lists when you want to rank by total or local activity instead.

<a id="control-adjustment-filter"></a>
### Filtered By Adjustments

Filtered By Adjustments controls whether Course Adj and Other Adj also change which adjusted MV family supplies the representative leaderboard row. When it is turned on, the selected adjustment combination determines the underlying list source as well as the displayed context.

<a id="term-other-events"></a>
### Other events

Used where the app needs to distinguish the selected course or event from all other appearances elsewhere. It provides off-course or outside-slice context.

<a id="term-participant"></a>
### Participant (Participt)

A participant is **any person who takes part in a parkrun event and completes the course**, whether they run, jog or walk. The term is used throughout the app to describe the individuals whose actions, results and event involvement form the basis of most participant‑based metrics.

The short form **Participt** appears in narrow table headers where space is limited.

This metric is selected via the **Type** control on the [Event Analysis](#page-event-analysis) page.


<a id="control-participant-filter"></a>
### Participants Filter

Participants can mean the count of participants in a row, or the minimum-participation threshold control used on Lists pages depending on context. On Lists pages it is used to restrict the leaderboard to participants with broader total or local history before comparing them.

<a id="term-pbs"></a>
### PBs

Participants who achieved their fastest time at this course during the selected event. PBs help indicate how fast or favourable the event conditions were.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="control-period"></a>
### Period

Period controls the time window or aggregation period used in the analysis. Changing it can switch between granular events, all-history views and grouped Annual, Monthly or Quarterly comparisons.

<a id="term-pos"></a>
### Pos

Short label for finishing or ranking position. It appears in compact event-style tables where space is limited.

<a id="term-quarter-seasonality"></a>
### Qtr seasonality

Quarterly grouping of seasonal behaviour. Use it when monthly changes are too noisy and you want broader seasonal blocks.

<a id="term-range"></a>
<a id="agg-range"></a>
### Range

Range is calculated by finding:

- the **minimum and maximum** values for the selected Period  
- across all courses  
- and expressing the difference between them

Example:  
Range of participants across the last 15 events, or range of Combined Hardness across all courses.

Use this to understand **variability** and how spread out the values are.

<a id="term-rank"></a>
### Rank

An ordering position within the current comparison set. It is used across participants, clubs and courses where the app needs an explicit ranking.

<a id="term-rank-type"></a>
### Rank type

Indicates the ranking basis or ranking family being used. It helps explain why two rank columns may differ for the same row.

<a id="term-recent-bests"></a>
### Recent Bests

Participants who achieved their best time within the last 15‑week period at this course. This highlights current form rather than lifetime performance.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="control-recent-club"></a>
### Recent Club

Recent Club shows the latest known club affiliation for the selected participant. Use it to confirm current club context before comparing participant runs or opening club-level pages.

<a id="term-recent-event-number"></a>
### Recent Ev #

Compact label for the recent-event count or identifier used in narrow tables. It gives recency context without using a full phrase.

<a id="term-recent-events"></a>
### Recent Events

Uses only the latest portion of the available history. It is the standard short-window view across several pages.

<a id="term-reg-course"></a>
### Reg Course

Short label for a participant's regular or most-associated course. It is used where a table needs a compact course-affiliation field.

<a id="term-regulars"></a>
### Regulars

Participants who have attended the course **more than 15 times within the last year**. This identifies the core local community who regularly support the event.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-returners"></a>
### Returners

Participants who return to the course after being absent for **more than 15 weeks**. This highlights re‑engagement and returning participation patterns.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-runs-1y"></a>
### Runs 1Y

Run count limited to the most recent one-year window. Use it when recent activity matters more than total career volume.

<a id="term-seasonal-adj"></a>
### Seasonal Adj. (Seas Adj.)

Applies the broader seasonal correction to course performance without using the full event-specific adjustment. It is useful when you want a lighter-touch course-condition correction.

<a id="term-seasonal-hardness"></a>
### Seasonal Hardness

Seasonal Hardness measures how tough a course was compared to its own recent history. It is based on consistent participants over a 15‑week window and reflects repeating factors such as weather, ground conditions and seasonal variation.  
For a full explanation, see the [Course Hardness Model](#section-course-hardness).



<a id="term-sex-adj"></a>
### Sex Adj

Shows or applies a sex-based adjustment. It is used when comparing performances after normalising for sex differences.

<a id="term-since-lockdown"></a>
### Since Lockdown

Uses all events from the post-lockdown restart onward. It is helpful when pre- and post-lockdown data should not be mixed.

<a id="term-single-value"></a>
### Single Value

A cell or summary mode that shows one direct value rather than an average or derived combination. It is commonly used when grouped periods still need a representative single reading.

<a id="term-super-tourists"></a>
### Super Tourists

Participants who have attended **more than 15 different courses within the last year**. This identifies highly mobile participants with broad course experience.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.


<a id="control-table-view"></a>
### Table View

Table View controls which column set is visible on the current page. Typical options are Basic for the key columns, Detailed for a wider field set, and specialist views such as All Time Adjustments where the page supports them.

<a id="control-time-adj"></a>
### Time Adj

Time Adj applies optional adjustments for time-based analysis. Use it when comparing pace or finish-time style fields across different conditions so that like-for-like comparisons are easier to make.

<a id="term-times"></a>
### Times (Time)

Represents the **average finish time** of participants at the selected event.  
Times are an **event‑level metric**, meaning they describe the overall event rather than individual participant counts. Because they are averages, they only support **Calc = Actual** and **Agg = Average**.

Times are selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-total"></a>
<a id="agg-total"></a>
### Total

Total provides:

- the **total across all courses** for a day  
- the **total across all selected Periods** for a course

Example:  
Total PBs across all courses on a given day, or total volunteers across the selected Period window.

Use this when you want to understand **scale** rather than averages.

<a id="control-total-runs"></a>
### Total runs (Tot. runs)

Total Runs shows the total number of recorded runs for a participant or table row. Use it as quick context for how large the underlying history is before interpreting trends, ranks or adjusted bests.

<a id="term-tourists"></a>
### Tourists

Participants who normally attend a different course to the one selected.  
The app does not know a participant’s official “home” course, so it infers it from the participant’s **most frequently attended course**. Anyone attending a different course is counted as a Tourist.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.


<a id="control-type"></a>
## Type

Type controls **what metric** is displayed in the main analysis tables on the [Event Analysis](#page-event-analysis) page. It determines the subject of each cell before any calculations, adjustments or aggregations are applied.

The Type menu contains two kinds of options:

1. **Participant‑based metrics** — counts of people and what they did at the event  
2. **Event‑level metrics** — values describing the event itself (e.g., hardness, average time)

Understanding this distinction helps explain why some Types support all **Calc** options while others only support **Average**.

---

### Participant‑based Types  
These are based on **individual participants** and their actions at the event.  
They count how many people fall into each category.

Each item links to its glossary entry:

- [Participants](#term-participant)  
- [Tourists](#term-other-events)  
- [Super Tourists](#term-super-tourists)  
- [1st Timers](#term-first-timers)  
- [Clubbers](#term-clubbers)  
- [PBs](#term-pbs)  
- [Recent Bests](#term-recent-bests)  
- [Regulars](#term-regulars)  
- [Returners](#term-returners)  
- [Eligible Times](#term-eligible-runs)  
- [Unknowns](#term-unknowns)  

These Types represent **counts of people**, so they work naturally with all **Calc** options such as:

- **Actual**  
- **Actual%**  
- **%Total**  
- **%Deviation**  
- **#Actual Deviation**

Use these when you want to understand the **composition** of an event — who turned up, who achieved what, and how the mix compares to other events.

- [Volunteers](#term-volunteers) 
- **Volunteers** counts a *different group* of people (not participants)   

---

### Event‑level Types  
These describe the **event itself**, not individual participants.

- [Event Number](#term-event-number)  
- [Seasonal Hardness](#term-seasonal-hardness)  
- [Event Hardness](#term-event-hardness)  
- [Combined Hardness](#term-combined-hardness)  
- [Times](#term-times)  
- [Age](#term-age)

These values behave differently:

- **Event Number** and the **Hardness** metrics are fixed values for that event  
- **Times** and **Age** are **average-only** metrics and therefore only support:  
  - **Calc = Actual**  
  - **Agg = Average**

They do **not** support percentage or deviation calculations because they are not counts.

Use these Types when you want to understand the **conditions** or **context** of an event rather than the behaviour of participants.

---

### Summary

- **Participant‑based Types** → counts of people → support all Calc options  
- **Event‑level Types** → fixed event values → limited Calc options  
- **Times** and **Age** → **Average only**  
- **Volunteers** → counts helpers, not active participants 
- **Hardness metrics** → describe course difficulty, not participation  

Type is usually the **first control** to set when exploring an event, because it defines what the numbers in the table actually represent.

<a id="term-unknowns"></a>
### Unknowns

Participants who completed the course but did not register a time (for example, forgot their barcode). These are included in participation counts but excluded from time‑based analysis.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-volunteers"></a>
### Volunteers

Counts the number of people who volunteered at the event. Volunteers are a separate group from participants and are not included in participant‑based metrics.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

---

<a id="section-pages"></a>

## Pages & other key components

This section provides a starting guide to the different pages and components available in this app. 
They are accessible by the top left-hand burger bar and often a back button is provides which takes you back to the previous page in exacty the same position, with the same sorts and selection from when you left that page.

<img src="/help-images/back-button.png" alt="Back button" width="40" />

<a id="page-event-analysis"></a>

### Event Analysis Page

#### Purpose Description

Event Analysis is the main cross-event analysis page for local parkruns. It is designed to compare courses and event dates quickly across a wide range of statistics such as participants, PBs, tourists, volunteers, hardness and other derived measures.

#### Navigation

This page is usually entered from the main burger menu. From here you can drill down by clicking a course/date cell to open the [Event Page](#page-single-event), and you can also click course names where available to move into course-level detail.

#### Label and Selection list

- `Type`: changes the metric being displayed, such as Participants, Event Number, Course Hardness, Volunteers, Tourists, Regulars, PBs, Clubbers, Eligibles and Unknowns.
- `Calc`: changes how the chosen metric is interpreted, for example Actual, %Total or deviation-style views.
- `Period`: changes the time window or grouping, including recent events, full history, Annual, Monthly and Quarterly views.
- `Agg`: changes how rows and columns are summarised, such as Average, Total, Maximum, Minimum, Range and Growth.
- `Cell Agg`: where shown, changes how grouped cells are summarised.

#### Buttons

- Column header clicks re-sort the table.
- Drill-down clicks on table cells open the next relevant page.
- Standard page navigation and back navigation return you to the earlier page state where possible.

#### Tables, Plots and Previews

- Main matrix/table: arranged by event date and course, with sortable columns and drill-down cells.
- Grouped analysis views: available when Period changes from individual events to broader time buckets.


<a id="section-event-stats-comparison"></a>

### Event Statistics Comparison Chart

#### Purpose Description

This chart gives a visual comparison of the selected Event Analysis metric across dates and courses. It is intended to make trends, spikes and outliers easier to spot than in the main table alone.

#### Navigation

It sits alongside the Event Analysis page and is interpreted together with the same selections. Users typically review the table first and then use the chart to confirm trend direction or highlight unusual events.

#### Label and Selection list

- Inherits the current Event Analysis selections, especially `Type`, `Calc`, `Period` and `Agg`.
- Legend labels identify the displayed series.

#### Buttons

- Legend selection shows or hides individual plotted series.
- Zoom and pan controls, where enabled by the chart component, help focus on a specific time range.

#### Tables, Plots and Previews

- Comparison plot: shows the chosen event statistic across dates.
- Visual preview of outliers: makes unusually high or low events easier to spot before drilling further.


<a id="page-single-event"></a>

### Event Page 

#### Purpose Description

Event Page is the drill-down page for a single dated parkrun event. It is used to inspect one event in detail, including participant rows, adjusted times and event-specific context.

#### Navigation

This page is most commonly opened from [Event Analysis](#page-event-analysis). Use the back button to return to the previous summary page in the same state, or follow athlete, course and club links to continue drilling down.

#### Label and Selection list

- `Course Adj`: changes whether raw, seasonal or full event adjustment is applied.
- `Other Adj`: changes whether no adjustment, age, sex or age-and-sex adjustment is applied.
- `Table View`: changes the visible event columns.
- Event headline labels such as `Event Date`, `Event Number` and `Event Total` provide context for the selected day.

#### Buttons

- Back navigation returns to the previous page and state.
- Sortable column headers reorder the participant table.
- Linked values can open participant, course or club detail where available.

#### Tables, Plots and Previews

- Main participant table: lists participants and key metrics for the selected event.
- Adjusted-time views: show how rankings or times change under different adjustment settings.
- Event summary labels: provide quick context on turnout and event identity.


<a id="page-course"></a>

### Course Page

#### Purpose Description

Course Page brings together the history and characteristics of a single parkrun course. It is used to understand how that location behaves over time and how participants perform on it.

#### Navigation

This page is normally reached from Event Analysis, Event Page, Participant Page or club/list drill-down links. From here you can move into specific events or participants connected with the course.

#### Label and Selection list

- `Table View`: switches between compact and more detailed course tables.
- Course-specific labels identify the course and its summary metrics.
- Top 250 and similar sections may use headings driven by the course layout config.

#### Buttons

- Sortable table headers reorder course-level summaries and Top 250 lists.
- Linked rows or names navigate to event or participant detail.
- Back navigation returns to the prior context.

#### Tables, Plots and Previews

- Course summary tables: show key metrics for the selected course.
- Top participant tables: highlight leading or most notable performances on that course.
- Any supporting visuals on the page give quick context before deeper drill-down.


<a id="page-participant"></a>

### Participant Page

#### Purpose Description

Participant Page shows the run history, progression and profile of an individual athlete. It is used to compare adjusted and unadjusted performances, check consistency and review milestone patterns.

#### Navigation

This page is usually reached from event, course, club or list tables by clicking a participant. From here you can move into related courses, clubs and dated events for that athlete.

#### Label and Selection list

- `Course Adj`: changes the course-condition adjustment applied to displayed results.
- `Other Adj`: changes the participant-level adjustment, such as age, sex or age-and-sex.
- `Table View`: changes the visible participant-history columns.
- Supporting labels include `Athlete Code`, `Estimated Age`, `Total Runs`, `Recent Club` and `Freq Course`.

#### Buttons

- Sortable headers reorder run-history and summary tables.
- Linked course, club and event values open the next level of detail.
- Back navigation returns to the prior page state.

#### Tables, Plots and Previews

- Participant history table: shows the athlete's runs and key fields over time.
- Profile summary areas: give quick access to best performances and rankings.
- Time progression visuals help show changes in form across dates.


<a id="section-participant-profile"></a>

### Participant Profile 

#### Purpose Description

Participant Profile is a summary panel within the Participant page. It condenses the runner's standout performances, ranking context and representative dates into a smaller summary view.

#### Navigation

It is part of the broader Participant page rather than a standalone destination. Users typically read it before moving down into the full run-history table or time-by-date chart.

#### Label and Selection list

- Inherits the Participant page adjustment settings.
- Uses labels such as best time, rank, date and adjusted-time variants to summarise performance.

#### Buttons

- Usually acts as a read-only summary area, with any available links taking the user to the related event or course.

#### Tables, Plots and Previews

- Summary preview panel: shows best-result combinations at a glance.
- Quick comparison fields: help contrast adjusted and unadjusted achievements without reading the full history table.


<a id="section-participant-time-by-date"></a>

### Time by Date Chart

#### Purpose Description

Time by Date Chart visualises how an athlete's times change across event dates. It is used to spot improvement, decline, consistency and standout windows of form.

#### Navigation

It is part of the Participant page and should be read together with the participant summary and history table. Users often inspect a visual pattern here and then cross-check the exact rows below.

#### Label and Selection list

- Inherits the current Participant page adjustment settings.
- Axis and legend labels identify event dates and the selected time measure.

#### Buttons

- Chart interactions, where enabled, help inspect individual areas of the plot.
- Standard page links still allow drill-down to the underlying event rows.

#### Tables, Plots and Previews

- Time progression plot: shows the participant's trend across dates.
- Visual performance windows: make best periods or unusual results easier to spot.


<a id="page-club"></a>

### Club Page

#### Purpose Description

Club Page groups and analyses participants through their club affiliation. It is used to understand membership patterns, event activity and the relative profile of a club's members.

#### Navigation

This page is usually opened by clicking a club name from participant, event or list-related tables. From here you can drill into members, current members, events and linked participants.

#### Label and Selection list

- Club headline labels identify the current or recent club being analysed.
- `Table View` or club-specific mode selection may change whether you are looking at members, current members or events.
- Supporting labels identify counts such as members and events.

#### Buttons

- Sortable headers reorder club member and event tables.
- Club-linked participant or course rows open deeper detail pages.
- Back navigation returns to the source page.

#### Tables, Plots and Previews

- Member tables: compare members associated with the club.
- Event tables: show the club's presence across events.
- Summary labels give quick context before reading the larger tables.


<a id="page-lists"></a>

### Lists Page

#### Purpose Description

Lists Page provides predefined top-style leaderboards and filtered collections of athletes. It is used when you want quick access to ranked results without building a custom analysis first.

#### Navigation

This page is usually entered directly from the main navigation. From the loaded leaderboard you can drill into participant, course, club or event detail depending on which columns are clicked.

#### Label and Selection list

- `List Selection`: chooses which leaderboard family is loaded.
- `Filtered By Adjustments`: controls whether adjustment settings change the underlying leaderboard source.
- `Participants`: applies minimum-history thresholds.
- `Course Adj` and `Other Adj`: alter the adjustment context used for the list.

#### Buttons

- Header clicks re-sort the loaded list client-side.
- Linked participant, club, course or event values open the related detail page.
- Back navigation returns to the previously viewed page if the list was reached via drill-down.

#### Tables, Plots and Previews

- Main leaderboard table: shows the selected top 1000 or filtered list.
- Representative performance columns: give a quick preview of why each athlete appears in the chosen list.


<a id="page-feedback-log"></a>

### Log Error / Suggestion Page

#### Purpose Description

Log Error / Suggestion Page is the place for users to record bugs, data issues and improvement ideas. It supports structured feedback while the app is still being refined.

#### Navigation

This page is reached from the main menu. After submitting feedback, users typically return to the page they were testing or reviewing.

#### Label and Selection list

- Form labels identify the type of feedback being logged.
- Any category or severity selections help route feedback into more useful buckets.

#### Buttons

- Submission controls send the current error report or suggestion.
- Standard navigation controls let the user leave the page without submitting.

#### Tables, Plots and Previews

- Primary feedback form: acts as the main input area rather than a data table.
- Any confirmation or preview content is there to help the user review what will be submitted.

---
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
