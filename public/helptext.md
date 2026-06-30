

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
<a id="section-event-adjustment"></a>
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

The **first date** on which the participant completed a parkrun **while
representing this club**.  
This helps identify long‑standing club members and the length of their club
association.

<a id="term-first-timers"></a>
### 1st Timers (First Timers)

Participants completing the course for the **first time** — either their **first ever parkrun** or their **first appearance at this specific course**.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **1st Timers** column also appears on the  
[Course Page](#page-course),  
showing how many participants were first‑timers at each event in the course’s history.  
This provides useful context when reviewing course trends, event composition, and participant flow over time.


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
### AE (Age & Event) Adj

AE Adj combines:

- the **age adjustment** (see [Age](#term-age))  
- the **event‑hardness adjustment** (see [Ev Adj](#term-ev-adj))

This produces a time that is normalised for both the participant’s age and  
the specific difficulty of the event.

AE Adj always **reduces the original Time** and is often one of the most  
informative adjusted metrics.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

The participant’s best **Age & Event‑adjusted** time.  
This adjusts for both **course difficulty** and **participant age**, providing a
more comparable performance measure across age groups.

<a id="term-aes-adj"></a>
### AES (Age & Event & Sex) Adj

AES Adj applies **all three major corrections**:

- **Age** adjustment  
- **Event‑hardness** adjustment  
- **Sex** adjustment  

(see [Age](#term-age), [Ev Adj](#term-ev-adj), [Sex Adj](#term-sex-adj))

This produces the **most fully normalised** adjusted time in the app.

AES Adj always **reduces the original Time** and is the adjustment most  
commonly used for high‑quality ranking comparisons.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

The participant’s best **Age, Event & Sex‑adjusted** time.  
This is the most fully normalised performance metric, adjusting for:
- event difficulty  
- participant age  
- participant sex  
It enables the fairest comparison across all participants.

<a id="term-age"></a>
### Age

Represents the **average estimated age** of participants at the selected event.  
Age is an **event‑level metric**, not a participant count, and therefore only supports **Calc = Actual** and **Agg = Average**.

Age is selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="term-age-adj"></a>
### Age Adj.

Age Adj applies the **age‑based correction** to a participant’s  
[Time](#term-time), using the participant’s **estimated age**  
(see [Age](#term-age)) and the performance curve implied by  
[Age grade](#term-age-grade).

This adjustment normalises performance across different ages by  
estimating what the participant’s time would look like if they were  
at a standard reference age. It allows fairer comparison between  
younger and older runners.

Age Adj always **reduces the original Time**, producing an  
age‑normalised value that can be compared across participants  
regardless of age.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="term-age-sex-adj"></a>
### Age and Sex Adj.

Indicates that both age and sex adjustments are applied together. It is used when you want the strongest participant-level normalisation without adding course-condition adjustments.

<a id="term-age-grade"></a>
### Age grade

Age grade is a **percentage score** that compares a participant’s finish time to the **world record time** for their age group.  
It provides a way to compare performances **fairly across ages and sexes**.

The calculation is:

   WR Time  
────────────────      × 100  
Participant Time

Where:

- **WR Time** is the world‑record performance for the participant’s age group  
- **Participant Time** is the individual’s recorded finish time (see [Time](#term-time))

**Interpreting Age grade**

Higher percentages indicate stronger performances:

- **80–100%** → typically strong club‑level or county‑level athletes  
- **60–79%** → strong runners with competitive ability  
- **30–40%** → typical for walkers, joggers, and newer participants  
- **Below 30%** → gentle participation or early‑stage fitness

Age grade allows meaningful comparison between:

- younger and older runners  
- males and females  (compared to female world records)
- different courses and conditions (when combined with adjustments)

**Enhanced Age grade in this application**

This app improves the standard parkrun age‑grade calculation by:

1. **Estimating the participant’s actual age**  
   Using their age‑group history and event patterns  
   (see [Age](#term-age))

2. **Applying the implicit world‑record time**  
   Derived from historical data for that estimated age

3. **Producing a more precise age‑adjusted time**  
   Which feeds into metrics such as **Age Adj**, **AS Adj**, and **AES Adj**

This results in a **more accurate and consistent** age‑grade interpretation than the basic parkrun calculation, especially for participants whose age group spans multiple years.

**Summary**

- Age grade = WR Time ÷ Participant Time × 100  
- Allows fair comparison across ages and sexes  
- Typical ranges: 30–40% (walkers/joggers), 80–100% (elite/club level)  
- This app enhances the metric using **estimated age** and **implicit WR times**  
- Closely linked to [Time](#term-time) and [Age](#term-age)


<a id="term-age-group"></a>
### Age group (Age grp)

The participant’s **age category label**, used throughout the app for sorting, grouping and interpreting results across participant, event and course pages.

Age groups distinguish between:

- younger participants and older participants  
- **female** and **male** categories  
- standard parkrun age‑band classifications (e.g., JM10, SW25–29, VM50–54)

These categories help observers understand the demographic profile of an event and allow meaningful comparisons within and across age‑based groups.

In this app, additional logic is used to **estimate a participant’s age** from their age‑group history.  
This enables much more precise calculations for:

- **age‑adjusted times**  
- **age‑adjusted rankings**  
- combined adjustments such as **Age Adj**, **AS Adj**, and **AES Adj**

For more detail on how estimated ages are used in adjustments, see  
[Age](#term-age).

The participant’s **current age group**, as defined by parkrun (e.g., VM45‑49,
SW30‑34).  
This is used for age‑based comparisons and adjusted‑time calculations.

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
<a id="period-all-events"></a>
### All Events

Loads the **entire history** of each course.  
Useful for:

- long‑term averages  
- historic highs and lows  
- full‑range trend analysis

<a id="term-all-time-adjustments"></a>
### All Time Adjustments

All Time Adjustments is a specialised **Table View** that displays multiple adjusted‑time variants side by side.  
It is mainly used on **Event** and **Participant** pages when you want to compare how each adjustment method affects the resulting time.

This view includes the following columns:

- **Seasonal Adjustment**  
  [Seas Adj](#term-seasonal-hardness)  
  Shows the time after applying only the **Seasonal Hardness** correction.

- **Event Adjustment**  
  [Ev Adj](#term-ev-adj)  
  Shows the time after applying the **full event‑level hardness** correction.

- **Age Adjustment**  
  [Age Adj](#term-age-adj)  
  Shows the time normalised for participant age.

- **Sex Adjustment**  
  [Sex Adj](#term-sex-adj)  
  Shows the time normalised for participant sex.

- **Age + Event Adjustment**  
  [AE Adj](#term-ae-adj)  
  Applies both **age** and **event hardness** adjustments.

- **Event + Sex Adjustment**  
  [ES Adj](#term-es-adj)  
  Applies **sex** and **event hardness** adjustments.

- **Age + Sex Adjustment**  
  [AS Adj](#term-as-adj)  
  Applies both **age** and **sex** adjustments.

- **Age + Sex + Event Adjustment**  
  [AES Adj](#term-aes-adj)  
  The strongest combined adjustment, applying **age**, **sex**, and **event hardness** together.

These columns allow you to see, at a glance, how each adjustment method changes the underlying time and how different correction factors interact.

All Time Adjustments is selected via the [Table View](#control-table-view) control.


<a id="term-annual"></a>
### Annual

Groups data by year rather than by single event. Use it when you want broad long-run trend comparisons instead of week-by-week movement.

<a id="term-as-adj"></a>
### AS (Age & Sex) Adj.

Age and Sex Adj applies both:

- the **age‑based correction** (see [Age](#term-age))  
- the **sex‑based correction** (see [Sex Adj](#term-sex-adj))

This produces a time that is normalised for both age and sex simultaneously.

It always **reduces the original Time** and provides a fairer comparison  
across mixed‑age, mixed‑sex groups.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

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

Cell Agg controls **how each individual cell** in the [Event Analysis](#page-event-analysis) table is formed when a grouped view contains **multiple underlying events**.  
It determines how those multiple values are combined into a single displayed number.

Cell Agg works together with:

- [Period](#control-period) — which may group events into years, quarters or months  
- [Agg](#control-agg) — which summarises across courses or across periods  
- [Type](#control-type) — which determines the metric being analysed

Use Cell Agg when you want to switch between **single‑value** behaviour and **aggregated** behaviour inside each cell.

**When Cell Agg Applies**

Cell Agg only affects the table when the selected **Period** groups multiple events into a single cell, such as:

- [Annual](#term-annual)  
- [Qtr Seasonality](#term-quarter-seasonality)  
- [Mnth Seasonality](#term-month-seasonality)

For non‑grouped periods (e.g., Recent Events, Last 50 Events), each cell already represents a single event, so Cell Agg defaults to **single value**.

**Available Cell Aggregation Methods**

Cell Agg supports the following methods:

- **Single value** (default when only one event is present)  
- **Average**  
- **Maximum**  
- **Minimum**

These methods determine how the underlying events inside each grouped cell are summarised.

**Examples**

**Annual + Average (Cell Agg)**  
Shows the **average participants per year** for each course.

**Qtr Seasonality + Maximum (Cell Agg)**  
Shows the **highest PB count** recorded in each quarter.

**Mnth Seasonality + Minimum (Cell Agg)**  
Shows the **lowest Combined Hardness** recorded in each month.

<a id="term-club"></a>
### Club (Clubs)

The running club associated with a participant, or a club‑focused grouping used elsewhere in the app.  
Club names often appear as clickable links and act as a drill‑down path into the  
[Club page](#page-club), where the club is explored in much greater depth.

The Club page provides detailed information such as:

- club membership across events  
- participant performance summaries  
- club‑level rankings and statistics  
- historical trends and attendance patterns

Whenever a club name appears in tables or participant profiles, it can be selected to view the full club‑level analysis.

A **Clubs** column also appears on the  
[Course Page](#page-course),  
showing the **number of participants who were members of a club** at each event in the course’s history.  
This provides useful context on event composition, visitor patterns, and the presence of club‑affiliated runners over time.

<a id="term-club-runs"></a>
### Club Runs (Club runs 1y)

The **total number of times** the participant has run **while representing this
club** across their entire parkrun history.  
This counts all events where the participant’s recorded club matches the club
shown on the page.

<a id="term-club-runs-1y"></a>
### Club runs 1Y
The number of times the participant has run **for this club** within the **most
recent one‑year window**.  
Useful for understanding **current engagement** with the club rather than
historical totals.

<a id="term-clubbers"></a>
### Clubbers

Participants who are associated with a running club at the event. This shows how many club‑affiliated participants took part.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

<a id="control-column-sort-help"></a>
### Column Sort / Help Icon

Most pages that display tables include a **Column Sort / Help** toggle icon at the top of the page.  
This icon switches between two modes:

1. **Column Sort mode**  
2. **Column Help mode**

The current mode is shown by the icon:

- **Column Sort**  
  <img src="/help-images/columnSort.png" alt="Column Sort Icon" height="60" />

- **Column Help**  
  <img src="/help-images/columnHelp.png" alt="Column Help Icon" height="60" />

**Column Sort Mode (default)**

When the icon is in **Column Sort** mode, clicking a column header will **sort the table** by that column.

- Clicking once sorts **ascending**  
- Clicking again sorts **descending**  
- A small arrow appears in the column header to show the current sort direction

This mode is used when you want to quickly reorder the table by:

- Event Date  
- Participants  
- PBs  
- Hardness  
- Age‑adjusted times  
- or any other sortable column

You can still **hover over a column header for more than 2 seconds** to display the help tooltip for that column.

**Column Help Mode**

When the icon is clicked, it switches to **Column Help** mode:

<img src="/help-images/columnHelp.png" alt="Column Help Icon" height="60" />

In this mode, clicking a column header will **show the help for that column**, instead of sorting it.

This is useful when you want to understand:

- what a column means  
- how it is calculated  
- how it interacts with [Type](#control-type), [Calc](#control-calc), [Period](#control-period), [Agg](#control-agg), or adjustments  
- how it relates to other columns in the table

Sorting is **disabled** until you toggle the icon back to **Column Sort** mode.

**Summary**

- **Column Sort mode** → clicking a column sorts the table  
- **Column Help mode** → clicking a column shows its help entry  
- Hovering for **2+ seconds** always shows the column help tooltip  
- The icon toggles between modes and appears on most table‑based pages

This control makes it easy to switch between **sorting** and **learning**, depending on what you need at the moment.

<a id="term-comb-tot"></a>
### Comb Tot (Combined Total)

Comb Tot is the **combined total** of a participant’s:

- **Course #** — the number of times they have run this course  
  (see [Course #](#term-course-number))  
- **Volunts** — the number of times they have volunteered at this course  
  (see [Volunteers](#term-volunteers))

Formula:  
**Comb Tot = Course # + Volunts**

This metric highlights the participants who have contributed the most to the  
course through both **running** and **volunteering**.

On the  
[Course Page](#page-course),  
the Top250 table is **initially sorted by Comb Tot**, meaning the participants  
with the highest combined contribution appear at the top.  
These are typically the most engaged, long‑standing members of the course  
community.


<a id="term-combined-hardness"></a>
### Combined Hardness

Combined Hardness is the sum of Seasonal Hardness and Event Hardness. It provides a single value representing how difficult the course was on that specific event, relative to the easiest courses in the best conditions.  
For a full explanation, see the [Course Hardness Model](#section-course-hardness).


<a id="term-course"></a>
<a id="control-course"></a>
### Course (Selection Control)

The **course** is the parkrun location or route, distinct from an individual dated
event. Many tables let you drill from a course label into deeper course‑level
history.

The Course control allows you to select which course is being displayed on the
current page.  
It appears on pages such as the **Event Page** and **Event Analysis**.

The course label serves two functions:

1. **Navigation to the Course Page**  
   Clicking the course name takes you directly to the  
   [Course Page](#page-course), where you can view full course history,
   statistics and related links.

2. **Manual course selection**  
   Holding the cursor over the course name for more than two seconds opens a
   course‑selection box.  
   You can type the name of any course, and matching courses will appear in the
   list.  
   Selecting a course loads that course **for the same event date currently being
   displayed**.

A course represents the **physical location** where the event takes place.  
Courses may change their route or layout during the year, and these changes are
reflected in the event data shown throughout the app.

The **Course** field also appears as a **column** in many tables.  
In this context it acts as a **hotlink** to the underlying  
[Course Page](#page-course), allowing quick navigation from event‑,
participant‑, or list‑based tables directly into the course’s full history.

The course associated with the club’s participation.  
On the Club Page, this column lists the **courses most regularly attended by
members of the club**.  
Clicking a course name takes you to the [Course Page](#page-course) for full
history and statistics.

<a id="term-course-number"></a>
### Course '#'

A short label used where a **course‑specific run count** needs to fit in a narrow
table column.  
It represents the **number of times a participant has run this specific course**.

This is similar to **Total runs**,  
but **Total runs** counts *all* parkruns across *all* courses,  
while **Course #** counts only the runs completed at **this** course.

Course # is one of the two components used in  
[Comb Tot](#term-comb-tot),  
which combines:

- **Course #** (runs at this course)  
- **Volunts** (volunteer roles at this course)

Together, these help identify the participants most engaged with the course
through both running and volunteering.


<a id="control-course-adj"></a>
### Course Adj

Course Adj controls whether the selected metric is shown using **raw**, **seasonally adjusted**, or **fully event‑adjusted** values.

It determines how much of the **Course Hardness Model** is applied:

- **Raw**  
  No adjustment. Shows the recorded value exactly as it appears in the results.

- **Seasonal Adjustment**  
  Applies only the [Seasonal Hardness](#term-seasonal-hardness) correction.  
  This accounts for typical seasonal effects such as weather and ground conditions.

- **Full Event Adjustment**  
  Applies the complete [Event Hardness](#term-event-hardness) correction, which includes both seasonal and cross‑course comparisons.  
  This produces the most accurate estimate of how the event compares to others on the same day.

Use Course Adj when you want to compare events **fairly across different course conditions**, especially when analysing times, PBs, or participant performance.

Course Adj affects the values shown in the table and in the [All Time Adjustments](#term-all-time-adjustments) view.

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="term-current-club"></a>
### Current Club

The latest known club associated with a participant. It gives current affiliation context and is often used as a navigation link into club analysis.

The participant’s **current registered club**.  
Some participants change clubs over time; their historical club representation
can be seen by reviewing their  
[Participant Page](#page-participant),  
which shows club affiliation at each event.

<a id="term-date"></a>
### Date (Ev Date)

Date is the **calendar date** of the event.  
For almost all parkrun events this is a **Saturday**, with the only regular  
exceptions being the **Christmas Day** and **New Year’s Day** special events.

A **course + date** combination defines a **unique event**.  
Even if two courses share the same date, each event is treated independently.

Date is used throughout the app to:

- identify the specific event being analysed  
- link to the [Event Page](#page-event) for that date  
- determine the participant’s **age on the day**  
  (see [Age](#term-age))  
- support one‑year views and rolling‑window metrics such as:  
  - Eligible Times  
  - Local Runs  
  - Other events  
  - Recent Bests  

Date is one of the **core identifiers** for all event‑level calculations.

Date is also used on the  
[Participant Page](#page-participant),  
where it helps track a participant’s event history, recency of attendance,  
and the time‑based windows used for metrics such as **Runs in 1Y**,  
**Recent Events**, **Returners**, and **Recent Bests**.

<a id="term-detail"></a>
### Detail (Detailed)

The **expanded table view** that shows more columns than Basic.  

In Detailed view, additional participant‑level information is displayed, including:

- **New PB!** — highlights when the participant achieved a new personal best  
- **First Timer!** — indicates the participant’s first recorded run at that course  
- **Current PB** — shows the participant’s existing personal best for that course  
  (see [PB](#term-pb))

These extra indicators help you understand participant progress, course familiarity, and performance context directly within the table.

Detailed view is especially useful when analysing:

- participant improvement over time  
- course‑specific performance patterns  
- how PBs and First Timers contribute to event dynamics  
- deeper participant‑level metrics that are not shown in Basic view

<a id="term-distinct-events"></a>
### Distinct events

Counts the number of **unique events** a participant has completed, rather than the
total number of runs.  
It measures **breadth of attendance** — how widely a participant has travelled or
how many different events they have taken part in.

Distinct events is particularly useful for understanding:

- how many **different courses** a participant has run in the **last year**  
- how varied their parkrun history is  
- whether they tend to stay local or explore multiple locations  
- tourist‑style behaviour when combined with metrics such as  
  [Tourist](#term-tourist) and [Super Tourist](#term-super-tourist)

This metric appears on the  
[Participant Page](#page-participant)  
and in participant‑focused tables such as Top250, helping you see the **range**
of events a participant has attended, not just how often they run.

<a id="term-eligible-runs"></a>
### Eligible runs / Eligible Times

Participants whose finish times fall within their **normal expected time window**,  
based on their recent **15‑week performance history**.

Eligible Times represent **consistent, reliable performances**, and are therefore  
more likely to contribute to the **Course Hardness Model**, which depends on  
stable participant behaviour to estimate event difficulty accurately.

Eligible Times are selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

They are also used on the  
[Event Page](#page-event),  
where they help identify which participants contributed meaningful data to the  
event’s hardness calculation and which performances fall outside their expected range.

A count of **Eligible Times** also appears on the  
[Course Page](#page-course),  
showing how many participants met the eligibility criteria at each event in the  
course’s history. This provides useful context when reviewing course trends,  
data quality, and the stability of participant performance over time.

<a id="term-es-adj"></a>
### ES (Event & Sex) Adj

ES Adj applies:

- the **event‑hardness correction** (see [Ev Adj](#term-ev-adj))  
- the **sex‑based correction** (see [Sex Adj](#term-sex-adj))

This produces a time that is normalised for both event difficulty and sex.

ES Adj always **reduces the original Time**.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="term-estimated-age"></a>
### Estimated Age

Estimated Age represents the app’s **best estimate** of a participant’s current age.  
It is used for **context** in performance interpretation and for all  
**age‑based calculations**, rather than being a standalone performance metric.

This value is **not taken directly from parkrun data**.  
Instead, it is **inferred** by combining:

- the participant’s **Age grade** history  
  (see [Age grade](#term-age-grade))  
- their recorded **Age group** categories over time  
  (see [Age group](#term-age-group))

By analysing how these two signals evolve across multiple parkruns, the app  
deduces a consistent age estimate.  
The more events a participant completes, the **more accurate** this estimate becomes.

Estimated Age is used directly in the  
**Age Adjustment** calculation  
(see [Age Adj](#term-age-adj)),  
which normalises performance across different ages to allow fairer comparison  
between participants.

<a id="term-ev-adj"></a>
### Ev (Event) Adj

Event Adj applies the **full combined hardness correction** for the specific event  
(see [Combined Hardness](#term-combined-hardness)).

It adjusts the participant’s [Time](#term-time) based on the actual conditions of that  
event — weather, ground conditions, attendance mix, and other event‑level factors.

Event Adj produces a more precise correction than Seasonal Adj and always  
**reduces the original Time**.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

The participant’s **best event‑adjusted time**, which normalises performance for
course difficulty and event conditions.  
This allows fairer comparison between participants who run different courses.

<a id="term-event-count"></a>
### Event cnt
The number of **event days** on which **at least one member of the club**
participated at this course.  
Even if multiple club members ran on the same date, the event counts **once**.

This measures **how often the club has appeared at the course**, not how many
total runs were made.

<a id="term-event-count-1y"></a>
### Event cnt 1Y
The same as **Event cnt**, but limited to the **most recent one‑year window**.  
Shows how frequently the club has attended the course **recently**.

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

Event Number is the **sequential count of how many times a course has held an event**.  
For example, if a course has been operating for several years, its Event Number will be higher than a newly launched course.

It is an **event‑level value**, meaning it describes the event itself rather than the participants.  
It does not depend on who took part — it simply reflects the position of that event in the course’s history.

The one‑year variant (**Event # 1Y**) applies the same idea but within the last‑year window used on certain tables.

Event Number is selected via the **Type** control on the [Event Analysis](#page-event-analysis) page.

You can move to the **previous or next event** for the same course using the  
[Event Step Controls](#event-step-controls), which provide quick navigation through the event sequence on the [Event page](#page-single-event)

<a id="term-event-total"></a>
### Event Total

The full participant total for a single event or summary row. It is typically used as a headline count that sets the scale for other metrics in the same view.

<a id="section-expand-reduce"></a>
### Expand and Reduce (Graph Size Controls)

Some charts in the app, including the **Event Statistics Comparison** plot, include two additional controls:

- **Expand**  
  <img src="/help-images/expandButton.png" alt="Expand Button" height="40" />

- **Reduce**  
  <img src="/help-images/reduceButton.png" alt="Reduce Button" height="40" />

These buttons control the **display size** of the chart.

**Expand**
Enlarges the chart to fill more of the screen.  
This is especially useful on **laptop and desktop** devices where there is more horizontal space and you want to see more detail or compare multiple lines clearly.

**Reduce**
Shrinks the chart back to its **standard (smallest) size**.  
Use this when you want to return to the normal layout or when working on smaller screens.

These controls do not change the underlying data — they simply adjust the **visual space** available for the chart.

<a id="control-freq-course"></a>
<a id="control-freq-course-1y"></a>
### Freq Course

Freq Course shows the participant's most frequent course over the last year. It is derived from the course with the highest event count in that window, and if multiple courses tie the most recent one is used.

The **total number of runs** completed at the course **by all members of the
club**, across all time.  
Unlike Event cnt, this counts **every run**, not just event days.

**Freq 1Y**
The same as **Freq**, but limited to the **last one year**.  
Shows how many runs club members have completed at the course **recently**.

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
<a id="control-hardness-adj"></a>
### Hardness

Hardness provides the **hardness‑based adjustment context** for the selected event.  
It shows the **Combined Hardness** value that applies to that event under the current adjustment settings.

Hardness is **explanatory**, not a standalone metric or leaderboard target.  
It helps you interpret adjusted times by showing how tough the course was on that day.

The displayed hardness score is derived from the  
[Combined Hardness](#term-combined-hardness) model, which includes:

- **Seasonal Hardness** — how the course compared to its own recent history  
- **Event Hardness** — how the course compared to other courses on the same day  

Together, these form the **Combined Hardness** value used in:

- [Course Adj](#control-course-adj)  
- [Time Adj](#control-time-adj)  
- [All Time Adjustments](#term-all-time-adjustments)

Use Hardness Adj as context when comparing **event‑adjusted**, **age‑adjusted**, or **age‑sex‑adjusted** times across different courses or dates.  
It explains *why* an adjusted time is higher or lower, but it does not replace the raw time itself.


<a id="control-hardness-adj"></a>
### Hardness Adj

Hardness Adj shows the combined hardness context for the selected event and adjustment settings. Use it as explanatory context when interpreting adjusted time comparisons across events, not as a replacement for the raw time itself.

<a id="term-hist-rank"></a>
### Hist Rank

Hist Rank is the **highest rank a participant has ever achieved** within the
selected comparison framework (see [Rank](#term-rank)).

A participant receives a **weekly rank score**, calculated from their relative
performance based on parkrun time or adjusted‑time measures  
(e.g., Event‑adjusted, Age‑adjusted, Age‑Sex‑adjusted).

Hist Rank records the **best of all these weekly ranks**, providing a clear view
of the participant’s strongest position across their entire history.

<a id="period-last-50"></a>
### Last 50 Events

Loads the last 50 events for each course.  
Useful when you want a **longer but still modern** view of course behaviour.

<a id="term-last-event"></a>
### Last Event

The **most recent date** on which the participant completed a parkrun at  
**this specific course**.

Last Event helps show how recently the participant has been active at the  
location and is often used alongside:

- **Course #** — total runs at this course  
  (see [Course #](#term-course-number))  
- **Comb Tot** — combined runs and volunteer roles at this course  
  (see [Comb Tot](#term-comb-tot))

This field appears in participant‑focused tables such as **Top250** on the  
[Course Page](#page-course), providing quick context on how current or  
historical a participant’s engagement with the course is.


<a id="term-last-volunt"></a>
### Last Volunt

Shows the last recorded volunteering date in the selected context. It gives recency information for volunteer activity.

<a id="term-local-runs"></a>
### Local Runs

Counts how many times a participant has run at the **defined local course** (or set of local courses) within the **previous one‑year period**.  
It is often used in lists and participant summaries to distinguish **local engagement** from overall participation.

A value of **1** means the participant has run at the selected local course **once** in the last year.  
Higher values indicate stronger local presence and more frequent participation at that course.

Local Runs helps identify:

- regular attendees at the selected course  
- occasional visitors versus consistent locals  
- patterns of course loyalty and local running behaviour  
- context for interpreting PBs, Regulars, Returners, and Other events

This metric is used across participant‑focused pages to provide a clearer picture of how active a participant is **locally**, independent of their broader parkrun activity.

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
<a id="term-members-1y"></a>
### Members (Members 1y)

Counts club members or current members in club-focused tables. The `1y` version restricts the count to recent one-year activity.

The number of **distinct participants** from the club who have run at this
course across all time.  
This shows how widely the club’s membership has engaged with the course.

**Members 1Y**
The number of **distinct club participants** who have run at the course in the
**last year**.  
Useful for understanding current club engagement.

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
<a id="term-order-1y"></a>
### Order (Order 1y, Ord)

Sort order or ranking order label used in compact tables. The one-year form applies the same ordering idea within the last-year window.

The **ranking** of the course based on **Event cnt**.  
This provides a popularity ordering of courses for the club, with **1** being
the course most frequently attended (by event days).

**Order 1Y**
The same as **Order**, but based on **Event cnt 1Y**.  
Shows the club’s **recent** course‑attendance popularity.

<a id="control-other-adj"></a>
### Other Adj

Other Adj controls whether **participant‑level adjustments** are applied to the selected metric.  
These adjustments normalise differences between participants before the values are summarised.

The available options are:

- **No Adjustment**  
  Shows raw participant values with no normalisation.

- **Age Adjustment**  
  Applies the [Age Adj](#term-age-adj) correction, normalising performances for age differences.

- **Sex Adjustment**  
  Applies the [Sex Adj](#term-sex-adj) correction, normalising performances for sex‑based physiological differences.

- **Age‑and‑Sex Adjustment**  
  Applies both [Age Adj](#term-age-adj) and [Sex Adj](#term-sex-adj) together.  
  This produces the strongest participant‑level normalisation without applying course‑condition adjustments.

Other Adj is used when you want to compare participants **fairly across age groups and sexes**, or when analysing adjusted times in the [All Time Adjustments](#term-all-time-adjustments) table.

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="control-list-select"></a>
### List Selection

List Selection controls which top-style leaderboard is loaded on the Lists page. Use performance-led lists when you want to rank athletes by their best adjusted result, and participation-led lists when you want to rank by total or local activity instead.

<a id="control-adjustment-filter"></a>
### Filtered By Adjustments

Filtered By Adjustments controls whether Course Adj and Other Adj also change which adjusted MV family supplies the representative leaderboard row. When it is turned on, the selected adjustment combination determines the underlying list source as well as the displayed context.

<a id="term-other-events"></a>
### Other events

Used where the app needs to distinguish the **selected course or event** from all other appearances elsewhere.  
It provides **off‑course** or **outside‑slice** context when analysing a participant’s running history.

Other events represents the **number of different courses** a participant has run at within the **previous one‑year window**.

- A value of **1** means the participant has run at **only one course** during this period.  
- Higher values indicate a broader running footprint across multiple courses.

This metric helps identify:

- single‑course regulars  
- occasional tourists  
- highly travelled runners who appear across many courses  
- context for interpreting PBs, First Timers, Regulars, and Returners

It is used on participant‑focused pages to provide a clearer picture of how varied a participant’s running activity has been outside the currently selected course.

<a id="term-participant"></a>
### Participant (Participt)

A participant is **any person who takes part in a parkrun event and completes the course**,  
whether they run, jog or walk. The term is used throughout the app to describe the  
individuals whose actions, results and event involvement form the basis of most  
participant‑based metrics.

The short form **Participt** appears in narrow table headers where space is limited.

This metric is selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **Participants** column also appears on the  
[Course Page](#page-course),  
showing the **number of participants per event** across the course’s history.  
This provides essential context when reviewing event size, attendance trends,  
and long‑term participation patterns.

The participant (runner) associated with the club.  
Participants shown on the Club Page are those who have **represented the club at
parkrun events over time**.  
Clicking the participant name takes you to their  
[Participant Page](#page-participant) for full history and performance detail.

<a id="control-participant-filter"></a>
### Participants Filter

Participants can mean the count of participants in a row, or the minimum-participation threshold control used on Lists pages depending on context. On Lists pages it is used to restrict the leaderboard to participants with broader total or local history before comparing them.

<a id="term-pbs"></a>
### PBs

Participants who achieved their **fastest time at this course** during the selected event.  
PBs help indicate how **fast**, **favourable**, or **competitive** the event conditions were.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **PBs** column also appears on the  
[Course Page](#page-course),  
showing how many participants achieved a course PB at each event in the course’s history.  
This provides useful context when reviewing course trends, seasonal effects, and event‑level performance patterns.

<a id="control-period"></a>
### Period

Period controls **how much data is loaded** into the [Event Analysis](#page-event-analysis) page and **how that data is grouped** for trend analysis.  
It affects both the values shown in the table and how the [Agg](#control-agg) calculations are applied.

There are **two types** of Period options:

1. **Data‑loading periods** — control how many events are included  
2. **Trend‑analysis periods** — group all available data into annual, quarterly or monthly summaries

Period interacts with:

- [Type](#control-type) — what metric is being analysed  
- [Calc](#control-calc) — how the metric is expressed  
- [Agg](#control-agg) — how values are summarised  
- [Cell Agg](#control-cell-agg) — how grouped periods are represented

---

**1. Data‑Loading Periods** 
These options determine **how many events** are included in the analysis.  
More data means richer trends but slower‑moving averages.

The options are:

- [Recent Events](#period-recent-events)  
- [Last 50 Events](#period-last-50)  
- [Since Lockdown](#period-since-lockdown)  
- [All Events](#period-all-events)

---

**2. Trend‑Analysis Periods** 

These options use **all available data**, but instead of loading events individually, they **group** them into larger time blocks.

The options are:

- **Annual**  
- **Qtr Seasonality**  
- **Mnth Seasonality**

These are used to detect **seasonal patterns**, **year‑on‑year changes**, and **long‑term behaviour**.

Grouping is controlled by:

- [Cell Agg](#control-cell-agg) — how each year/quarter/month is summarised  
- [Agg](#control-agg) — how grouped values are aggregated across courses or periods

<a id="period-annual"></a>
<a id="term-annual"></a>
**Annual**

Groups all events by **calendar year**.
Annual is a Period option that groups **all event data for a course by calendar year**.  
Each year is summarised using the selected [Cell Agg](#control-cell-agg) method (for example, Average), so you can compare year‑on‑year behaviour.

Annual is selected via the Period control on the [Event Analysis](#page-event-analysis) page.

Example:  
If **Cell Agg = Average**, then:

- **Average Participants per Year**  
- **Average PBs per Year**  
- **Average Combined Hardness per Year**

This is ideal for **year‑on‑year comparisons**.

---

<a id="period-quarterly"></a>
<a id="term-quarter-seasonality"></a>
**Qtr Seasonality**

Qtr Seasonality is a Period option that groups **all event data for a course into the four quarters of the year** (Q1, Q2, Q3, Q4).  
Each quarter is summarised using the selected [Cell Agg](#control-cell-agg) method, allowing you to identify seasonal patterns across the year.

Qtr Seasonality is selected via the Period control on the [Event Analysis](#page-event-analysis) page.

Useful for identifying:

- seasonal weather effects  
- course behaviour across spring/summer/autumn/winter  
- quarterly participation patterns

---

<a id="period-monthly"></a>
<a id="term-month-seasonality"></a>
**Mnth Seasonality**

Groups all events by **month** (Jan–Dec).
Mnth Seasonality is a Period option that groups **all event data for a course by month** (Jan–Dec).  
Each month is summarised using the selected [Cell Agg](#control-cell-agg) method, making it easy to spot recurring monthly trends such as winter slowdowns or summer improvements.

Mnth Seasonality is selected via the Period control on the [Event Analysis](#page-event-analysis) page.

Useful for detecting:

- monthly seasonal patterns  
- recurring course behaviour (e.g., muddy winters, fast summers)  
- monthly PB cycles

<a id="section-plot-controls"></a>
### Plot Controls

<img src="/help-images/plotControls.png" alt="Plot Controls" height="50" />

Plot Controls appear on several charts throughout the app, including Event Statistics Comparison, Participant Profile, and Course History.

They allow you to navigate and reshape the chart view without changing the underlying data.

The controls include:

- **Date + / −**  
  Move the visible date window forward or backward.

- **← / →**  
  Pan the chart left or right.

- **Time + / −**  
  Expand or contract the time axis.

- **↑ / ↓**  
  Adjust the vertical scale of the chart.

- **pan‑out**  
  Zoom out to show a wider range of events. This is back to the default view. Useful when you want to restart a zoom into an area of the graph/plot

- **cumulative**  
  Switch between daily values and cumulative totals.

These controls make it easy to explore long‑term trends, zoom into specific periods, or compare multiple metrics on the same chart.


<a id="term-pos"></a>
### Pos

Short label for **finishing position** in the event.  
Pos shows the participant’s **rank for that specific event day**, based solely on their recorded finish time.

Only participants who have an officially recorded time appear in the table.  
Participants who took part but **did not record a time** are not shown in the results table and are counted as  
[Unknowns](#term-unknowns).

Pos appears in compact event‑style tables where space is limited, and is used when reviewing individual participant results or event‑level summaries.
d.

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

Rank is an **ordering position** that compares a participant’s performance within a defined comparison set.  
It is used across participants, clubs and courses whenever the app needs an explicit, normalised ranking.

Rank is based on several factors:

- the participant’s **Time** (see [Time](#term-time))  
- the **event** where the time was recorded (see [Event](#page-event))  
- the participant’s **age** at the time of the performance (see [Age](#term-age))  
- the participant’s **sex** (see [Sex](#term-sex))  

For each category, the Rank column uses the participant’s **best time within the last 1 year**.  
This “best recent time” is then compared against the appropriate  
[Ranked Time Reference](#term-ranked-time-reference)  
to produce a **rank score**.

Because rank scores are maintained over time, the app can show:

- how a participant is **trending** (see *Time by Date* plot)  
- how they compare within their age group, sex group, or adjustment category  
- their standing on the [Participant Profile](#page-participant-profile)

**Rank Score Tile (as shown on Event and Participant pages)**

On Event and Participant pages, Rank is displayed using a **Rank Score tile** (e.g *<img src="/help-images/rankScore.png" alt="Rank Score Tile" width="60" />*).  
This tile contains three key elements:

1. **Large number (centre)**  
   This is the participant’s **current rank score**, calculated using their best recent performance and the relevant Ranked Time Reference.

2. **Top‑right code**  
   This shows the **type of rank** being displayed.  
   For example:  
   - '*'  -> Original Time (see [Time](#term-times))
   - **AE** → Age + Event adjusted (see [AE Adj](#term-ae-adj))  
   - **AES** → Age + Event + Sex adjusted (see [AES Adj](#term-aes-adj))  
   - **ES** → Event + Sex adjusted (see [ES Adj](#term-es-adj))  

   The code indicates which adjustment category produced the participant’s **best ranking**.

3. **Bottom value (e.g., +9)**  
   This shows how the **current rank compares to the participant’s best historical rank** (see [Hist Rank](#term-hist-rank)).  
   - A **positive value** (e.g., +9) means the participant has achieved an **exceptional run**, improving their rank by that amount compared to their previous all‑time best.  
   - A **negative value** would indicate a drop relative to their historical peak.

This tile provides a quick visual summary of **current performance**, **adjustment category**, and **historical improvement**.

**AES Rank (Age–Event–Sex Rank)**

The **AES Rank** (see [AES Adj](#term-aes-adj)) shows how a participant performs after applying:

- age adjustment  
- event‑hardness adjustment  
- sex adjustment  

AES Rank is particularly useful for understanding how an athlete maintains their competitive standing **even as their raw event time changes with age**.

<a id="term-time-rank"></a>
### Time Rank

Time Rank shows the participant's placing when the event field is ordered by
their recorded **raw time** for that day.

It is the most direct comparison column in the **Event Ranks** table view and
answers the question: *where did this run place before any adjustment was applied?*

It is also tied to the [Ranked Time Reference](#term-ranked-time-reference),
which explains how best times are converted into the rank-score framework used
across the app.

Use it on the [Event Page](#page-single-event) or [Participant Page](#page-participant)
when you want to compare raw finishing quality against the adjusted rank columns.

<a id="term-ev-rank"></a>
### Ev Rank

Ev Rank shows the participant's placing after applying
[Event Adj](#term-ev-adj).

This rank adjusts for event hardness, so it is useful when the raw field was
shaped by unusually fast or slow conditions on the day.

See [Ranked Time Reference](#term-ranked-time-reference) for how the adjusted
time distribution is converted into rank scores.

<a id="term-es-rank"></a>
### ES Rank

ES Rank shows the participant's placing after applying the combined
[Event Adj](#term-ev-adj) and [Sex Adj](#term-sex-adj).

Use this when you want the event comparison to reflect both course conditions
and the sex-based adjustment.

See [Ranked Time Reference](#term-ranked-time-reference) for the reference
curves that underpin this ranking basis.

<a id="term-ae-rank"></a>
### AE Rank

AE Rank shows the participant's placing after applying the combined
[Age Adjustment](#term-age-adj) and [Event Adj](#term-ev-adj).

This is useful for comparing performances across age groups while still
normalising the difficulty of the specific event.

See [Ranked Time Reference](#term-ranked-time-reference) for how these adjusted
best times are mapped into rank groups.

<a id="term-aes-rank"></a>
### AES Rank

AES Rank shows the participant's placing after applying
[Age Adjustment](#term-age-adj), [Event Adj](#term-ev-adj), and
[Sex Adj](#term-sex-adj).

It is the most fully normalised event-ranking column and is often the best
choice when you want the fairest like-for-like comparison within the field.

See [Ranked Time Reference](#term-ranked-time-reference) for the full
time-to-rank conversion method used behind this column.

**Hist Rank**

[Hist Rank](#term-hist-rank) compares the participant’s **current rank** against their **best historical rank** across all categories.  
It allows participants to see whether they are improving, maintaining, or declining relative to their personal peak.

The participant’s **best ranking** under the selected adjustment method  
(e.g., Actual, Event‑adjusted, Age‑adjusted).  
Rank values are **clickable** and take you directly to the underlying event in
the participant’s run‑history table.

<a id="term-rank-type"></a>
### Rank type

Indicates the ranking basis or ranking family being used. It helps explain why two rank columns may differ for the same row.

<a id="term-ranked-time-reference"></a>
### Ranked Time Reference

The **Ranked Time Reference** is the mathematical framework used to convert an
athlete’s **best time** into a **rank score** between **100** and **0**.

It is built from the full distribution of best performances across all tracked
parkrun athletes, and it underpins the ranking logic used in [Rank](#term-rank),
[Time Rank](#term-time-rank), [Ev Rank](#term-ev-rank),
[ES Rank](#term-es-rank), [AE Rank](#term-ae-rank), and
[AES Rank](#term-aes-rank).

**1. Start with Best Time**

For each athlete, the system takes their **best recorded time** in the relevant
ranking basis.

That may be:

- raw **Time**
- best **Event-adjusted** time
- best **Event + Sex** adjusted time
- best **Age + Event** adjusted time
- best **Age + Event + Sex** adjusted time

Let:

- `Ti` = best time in seconds for athlete `i`

All athletes are then sorted from fastest to slowest.

**2. Total Athlete Count**

Let:

- `N` = total number of athletes with a valid best time in that ranking basis

For a large live ranking table this may be on the order of hundreds of
thousands of athletes.

**3. Rank Groups**

The ordered athlete list is divided into **101 rank groups**, corresponding to
rank scores:

`100, 99, 98, ... , 0`

Rank **100** is the fastest group and rank **0** is the slowest.

**4. Block Size Calculation**

<img src="/help-images/rankReference.png" alt="Rank Reference" height="300" />

**5. Group Sizes**

Rank groups are then assigned using multiples of `ab`.

For rank score `R`, where:

- `R = 101 - k`

the group size is:

- `GroupSize(R) = k * ab`

So:

- Rank `100` contains `1 * ab` athletes
- Rank `99` contains `2 * ab` athletes
- Rank `98` contains `3 * ab` athletes
- ...
- Rank `0` contains `101 * ab` athletes

This creates a **curve-shaped distribution** in which very few athletes reach
rank 100 and many more fall into the lower bands.

**6. Time Boundaries for Each Rank**

For each rank group, the system records:

- the **fastest time** in that group
- the **slowest time** in that group

These become the time boundaries for that rank band:

- `LowerBound(R)` = fastest time in the group
- `UpperBound(R)` = slowest time in the group

Together, these boundaries define the **Ranked Time Reference** table used by
the app.

**7. Applying Rank to Future Athletes**

When a new best time `T` is evaluated:

- the system finds the rank group whose time range contains `T`
- it assigns the corresponding rank score

This allows the app to apply a consistent ranking framework across raw and
adjusted performance types.

**Summary**

- sort all athletes by best time
- compute `ab = N / 5151`
- create 101 groups where group `k` contains `k * ab` athletes
- assign rank score `101 - k`
- store the minimum and maximum time for each group
- use those time ranges to convert future performances into rank scores

**Types of Ranked Time References**

Separate reference curves are maintained for the main ranking bases:

- **Time** reference, based on raw finish times
- **Event** reference, based on [Ev Adj](#term-ev-adj)
- **ES** reference, based on [ES Adj](#term-es-adj)
- **AE** reference, based on [AE Adj](#term-ae-adj)
- **AES** reference, based on [AES Adj](#term-aes-adj)

Each participant’s best recent performance is compared against the appropriate
reference curve to produce the rank score used in ranking tiles, Event Rank
columns, history comparisons, and participant-profile summaries.

<a id="term-recent-bests"></a>
### Recent Bests

Participants who achieved their **best time within the last 15‑week period** at this course.  
This highlights **current form**, short‑term improvement, and how well participants are performing relative to their recent history rather than their lifetime PB.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **Recent Bests** column also appears on the  
[Course Page](#page-course),  
showing how many participants achieved a recent‑form improvement at each event in the course’s history.  
This provides useful context when reviewing course trends, seasonal effects, and how favourable or fast an event was relative to recent conditions.

<a id="control-recent-club"></a>
### Recent Club

Recent Club shows the latest known club affiliation for the selected participant. Use it to confirm current club context before comparing participant runs or opening club-level pages.

<a id="term-recent-ev"></a>
### Recent Ev '#'

A compact label used in narrow tables for the **recent‑event count**.  
It provides quick recency context without needing a full descriptive phrase.

Recent Ev shows **how many times the participant has run this course in the
previous one‑year window**.  
It reflects **course‑specific activity**, not total parkruns across all locations.

This metric helps identify:

- how active the participant has been at this course recently  
- whether they are a current regular or an occasional visitor  
- short‑term engagement patterns that feed into metrics such as  
  [Returners](#term-returners), [Eligible Times](#term-eligible-runs),  
  and [Recent Bests](#term-recent-bests)

Recent Ev appears on the  
[Participant Page](#page-participant)  
and in participant‑focused tables such as Top250, providing a

<a id="period-recent-events"></a>
### Recent Events

Loads a short, recent window of events (typically around 15 weeks).  
Useful for spotting **current trends**, such as:

- recent increases in participants  
- seasonal changes  
- short‑term fluctuations in PBs or 1st Timers

<a id="term-reg-course"></a>
### Reg Course

Short label for a participant's regular or most-associated course. It is used where a table needs a compact course-affiliation field.

<a id="term-regulars"></a>
### Regulars

Participants who have attended the course **more than 15 times within the last year**.  
This identifies the core local community who consistently support and return to the event.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **Regulars** column also appears on the  
[Course Page](#page-course),  
showing how many participants met the Regulars threshold at each event in the course’s history.  
This helps highlight long‑term engagement, local loyalty, and the stability of the event’s core community over time.

<a id="term-returners"></a>
### Returners

Participants who return to the course after being absent for **more than 15 weeks**.  
This highlights re‑engagement, renewed participation, and longer‑term attendance patterns.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **Returners** column also appears on the  
[Course Page](#page-course),  
showing how many participants met the Returners threshold at each event in the course’s history.  
This provides useful context when reviewing course trends, community re‑engagement, and how participation ebbs and flows over time.

<a id="term-runs-1y"></a>
### Runs 1Y (Runs in 1Y)

Run count limited to the **most recent one‑year window**.  
Use it when **recent activity** matters more than total career volume.

Runs 1Y measures **how many times a participant has run locally** within the  
last year — specifically across the **set of courses included in this app’s  
local‑course universe**.

This metric helps identify:

- how active a participant has been **recently**  
- whether they are currently engaged with their local events  
- short‑term patterns that feed into metrics such as  
  [Returners](#term-returners), [Local Runs](#term-local-runs),  
  and [Recent Bests](#term-recent-bests)

Runs 1Y appears on the  
[Participant Page](#page-participant)  
and in participant‑focused tables such as Top250, providing a clear view of  
recent running volume across local courses.


<a id="term-seasonal-adj"></a>
### Seasonal Adj. (Seas Adj.)

Seasonal Adj applies the **seasonal hardness correction** to a participant’s  
[Time](#term-time), based on the long‑term seasonal pattern of the course  
(see [Seasonal Hardness](#term-seasonal-hardness)).

It provides a **lighter‑touch correction** than full event adjustment, accounting for  
broad seasonal effects (e.g., winter mud, summer speed) without using event‑specific data.

Seasonal Adj always **reduces the original Time**, producing a season‑normalised value.

Used in ranking calculations (see [Rank](#term-rank)).

<a id="term-seasonal-hardness"></a>
### Seasonal Hardness

Seasonal Hardness measures how tough a course was compared to its own recent history. It is based on consistent participants over a 15‑week window and reflects repeating factors such as weather, ground conditions and seasonal variation.  
For a full explanation, see the [Course Hardness Model](#section-course-hardness).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="term-sex-adj"></a>
### Sex Adj

Sex Adj adjusts a participant’s [Time](#term-time) based on their **sex**, using  
the sex‑based performance differential derived from age‑grading data  
(see [Age grade](#term-age-grade)).

Female participants receive a correction that normalises performance relative  
to male world‑record standards.

Sex Adj always **reduces the original Time**.

Used in ranking calculations (see [Rank](#term-rank)).

see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="term-since-lockdown"></a>
<a id="period-since-lockdown"></a>
### Since Lockdown

Loads all events from the post‑lockdown restart onwards.  
Useful when comparing **modern course behaviour** without mixing pre‑ and post‑lockdown patterns.

<a id="term-single-value"></a>
### Single Value

A cell or summary mode that shows one direct value rather than an average or derived combination. It is commonly used when grouped periods still need a representative single reading.

<a id="term-super-tourists"></a>
### Super Tourists

Participants who have attended **more than 15 different courses within the last year**.  
This identifies highly mobile runners with broad course experience and a strong touring profile.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A **Super Tourists** count also appears on the  
[Course Page](#page-course),  
showing how many such participants attended each event in the course’s history.  
This provides useful context when reviewing event composition, visitor patterns, and how widely travelled the field was on a given date.

<a id="control-table-view"></a>
### Table View

Table View controls **which set of columns** is visible on the current page.  
It allows you to switch between **compact**, **detailed**, or **specialised** layouts  
depending on how much information you want to see.

**Available Table Views**

The exact options depend on the page, but the most common are:

**Basic**
See: [Basic](#term-basic)  
A compact layout showing the **most important columns**.  
Ideal for quick scanning or mobile devices.

**Detailed**
See: [Detail](#term-detail)  
A wider layout showing **all standard columns** for the page you are on.  
This includes additional context such as club counts, hardness metrics,  
participant‑based fields, or course‑level aggregates.

**All Time Adjustments**
See: [All Time Adjustments](#term-all-time-adjustments)  
A specialised view (where supported) that displays **multiple adjusted‑time  
variants side by side**, such as event‑adjusted, age‑adjusted, and  
age‑sex‑adjusted times.

**Event Ranks**
See: [Time Rank](#term-time-rank), [Ev Rank](#term-ev-rank),
[ES Rank](#term-es-rank), [AE Rank](#term-ae-rank), [AES Rank](#term-aes-rank),
[Ranked Time Reference](#term-ranked-time-reference)

A specialised view on the [Event Page](#page-single-event) and
[Participant Page](#page-participant) that keeps the core event columns visible
and adds five **event-specific rank columns** side by side.

Use this view when you want to compare how a run ranks under raw,
event-adjusted, sex-adjusted, age-adjusted, and fully adjusted frameworks
without switching between multiple adjustment controls.

**Table View on the Course Page**

The **Course Page** also includes the Table View control, but with a  
**reduced set of options**:

- **Basic**  
- **Detailed**

The **Detailed** layout on the Course Page is **different** from the Event Page  
version. It shows **course‑level metrics** such as:

- seasonal hardness  
- event counts  
- course aggregates  
- participant‑type counts (e.g., Regulars, Returners, Super Tourists)

The **All Time Adjustments** view is **not available** on the Course Page.

**Table View on the Participants Page**

The **Participants Page** also uses the Table View control.  
Here, the **Detailed** option shows a **different set of participant‑focused  
columns**, tailored to individual history and performance, such as:

- Event total  
- Event #  
- Runs in 1Y  
- Eligible runs  
- Recent event count  
- Distinct events  
- Tourist / Super Tourist flags  
- Returner status  
- And other participant‑specific metrics

This layout is designed to give a deeper view of a participant’s running  
profile across all courses.

**How Table View Works**

Changing the Table View does **not** change the underlying data —  
it only changes **which columns are visible**.

Examples:

- Switching from **Basic → Detailed** on the Event Page reveals additional  
  fields such as Combined Hardness, Clubbers, Returners, Recent Bests,  
  Eligible Times, and more.

- Switching to **All Time Adjustments** replaces the standard event columns  
  with a set of **adjusted‑time comparison columns**, useful for  
  performance analysis.

**Summary**

Table View determines **how much information** is shown on the page:

- **Basic** → essential columns  
- **Detailed** → full event, course, or participant detail  
- **All Time Adjustments** → specialised adjusted‑time comparison  
  *(Event Page only)*

It works seamlessly with the other controls to give you the right level of  
detail for your analysis.

---

<a id="control-time-adj"></a>
### Time Adj

Time Adj controls how the **average time** is adjusted on the [Event Analysis](#page-event-analysis) page.  
It is normally **greyed out** and unavailable.  
Time Adj only becomes active when the selected [Type](#control-type) is **Times** (see: [Times](#term-times)).

When enabled, Time Adj offers four adjustment options:

1. **No Adjustment**  
2. **Hardness Adjusted**  
3. **Age Adjusted**  
4. **Hardness and Age Adjusted**

Each adjustment modifies the **average time** by applying the relevant correction factors to each participant’s time before averaging.

**No Adjustment**

Shows the **raw average time** for the event with no corrections applied.

**Hardness Adjusted**

Reduces the average time by applying the event’s **Combined Hardness**  
(see: [Combined Hardness](#term-combined-hardness)).

This adjustment estimates what the average time would have been on a **neutral, flat course in ideal conditions**.

**Age Adjusted**

Reduces the average time by applying **age‑based normalisation**  
(see: [Age Adj](#term-age-adj)).

This estimates what the average time would look like if all participants were compared on an **age‑neutral basis**.

**Hardness and Age Adjusted**

Applies **both**:

- the **Combined Hardness** correction  
- the **Age Adjustment** correction  

This produces the most normalised version of the average time.

It estimates what the average time would have been if:

- the course had neutral difficulty  
- conditions were ideal  
- all participants were compared on an age‑neutral basis

This is the strongest adjustment and is useful when comparing events across **different courses**, **different dates**, and **different participant age mixes**.

**How the Adjusted Average Time Is Calculated**

For each participant:

1. Start with their recorded time  
2. Apply the **hardness correction** (if selected)  
3. Apply the **age correction** (if selected)  
4. Combine all adjusted times  
5. Take the **average**  

This ensures the displayed value reflects the **adjusted performance**, not the raw recorded time.

**Summary**

Time Adj only applies when analysing **Times** and provides four ways to interpret the average time:

- **No Adjustment** → raw average  
- **Hardness Adjusted** → corrected for course difficulty  
- **Age Adjusted** → corrected for age differences  
- **Hardness and Age Adjusted** → corrected for both factors  

These adjustments help you compare average times **fairly** across different courses, conditions and participant groups.

---

<a id="term-times"></a>
### Times (Time) (Best Time)

Times represents the **average finish time** of participants at the selected event.  
It is an **event‑level metric**, meaning it describes the overall event rather than individual participant results.

Because Times is an average, it only supports:

- **Calc = Actual**  
- **Agg = Average**

Times is selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

**Distinguishing Times from the participant **Time** column**

To avoid confusion, note that **Times** (event‑level) is different from the **Time** column shown in participant‑level tables.

- **Time (participant)**  
  This is the **individual finish time** recorded for each participant at that event.  
  It is the official **gun time** published on the parkrun website.

- **Times (event average)**  
  This is the **average** of all valid participant finish times for that event.

**Handling invalid or corrupted times (e.g., 59:59)**

Occasionally, parkrun events experience technical failures where **all times are null or corrupted**.  
In these rare cases, parkrun assigns a placeholder time of **59:59** to all participants.

The app **automatically ignores** these placeholder values because:

- they do not represent real performance  
- they would distort the event average  
- they are not meaningful for comparisons or adjustments

Only **valid recorded times** are included when calculating the event‑level **Times** metric.

**Best Time**
The **fastest time** the participant has ever achieved on **any course**.  
This is a personal‑best indicator and is included in the Club Page to provide
context on the participant’s performance capability.

**Summary**

- **Times** → event‑level average finish time  
- **Time** → individual participant finish time  
- 59:59 placeholder times → **ignored**  
- Times only supports **Actual** and **Average**  
- Selected via **Type** on Event Analysis

<a id="section-time-adj-event-page"></a>
### Time Adjustment comparison with Event Page

When **Course Adj** (see [Course Adj](#control-course-adj)) and/or  
**Other Adj** (see [Other Adj](#control-other-adj)) are selected,  
the Event Page displays an **additional column** next to the  
[Time](#term-time) column.

This column shows the **adjusted time**, based on the combination of  
the selected Course Adj and Other Adj settings.  
It appears visually as shown in *adjustmentColumn.png*.

The adjustment applied is determined by the following matrix:

| **Course Adj ↓**      | **No Other Adj** | **Age Adj** | **Sex Adj** | **Age & Sex Adj** |
|-----------------------|------------------|--------------|-------------|--------------------|
| **No adjustment**     | — (no column)    | Age          | Sex         | AS                 |
| **Seasonal Adj**      | Seasonal         | —            | —           | —                  |
| **Event Adj**         | Ev               | AE           | ES          | AES                |

**Interpretation:**

- If **no adjustment** is selected for both controls, **no extra column** is shown.  
- If only **Course Adj** is selected, the column shows the course‑based adjustment  
  (Seasonal or Event).  
- If only **Other Adj** is selected, the column shows the participant‑based  
  adjustment (Age, Sex, or AS).  
- If **both** are selected, the app applies the **combined adjustment**, such as  
  **AE**, **ES**, or **AES**.

Each adjustment reduces the original Time according to the factors involved  
(seasonal hardness, event hardness, age, sex).  
These adjusted times are also used in ranking  
(see [Rank](#term-rank)).


<a id="term-total"></a>
<a id="agg-total"></a>
### Total

Total provides:

- the **total across all courses** for a day  
- the **total across all selected Periods** for a course

Example:  
Total PBs across all courses on a given day, or total volunteers across the selected Period window.

Use this when you want to understand **scale** rather than averages.

---

<a id="control-total-runs"></a>
### Total runs (Tot. runs)

Total Runs shows the **total number of recorded parkrun events** completed by a participant across their entire running history.

This value reflects the participant’s **full parkrun journey**, not just the events included within this app’s selected local‑course set.  
As a result:

- Some, or even many, of the participant’s total runs may fall **outside** the courses tracked by this app  
  (see *This App’s course selection*).  
  For these runs, no additional event‑level data or statistics are available.

- In other cases, a participant’s total runs may fall **entirely within** the local courses, meaning all runs can be fully analysed.

A value of **1** indicates the participant’s **very first recorded parkrun**, which also corresponds to  
[First Timer](#term-first-timer) status.

Total Runs is used throughout participant summaries and profile pages to provide context on:

- overall experience level  
- long‑term participation  
- how much of their running history is represented within the app’s local dataset  
- comparison between local engagement and total parkrun activity

The total number of parkruns the participant has completed in the **last year**,
across **all courses and all clubs**.  
This provides a measure of the participant’s **recent running volume**.

<a id="term-tourists"></a>
### Tourists

Participants who normally attend a different course to the one selected.  
The app does not know a participant’s official “home” course, so it infers it from the participant’s **most frequently attended course**. Anyone attending a different course is counted as a Tourist.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

---

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

#### Summary

- **Participant‑based Types** → counts of people → support all Calc options  
- **Event‑level Types** → fixed event values → limited Calc options  
- **Times** and **Age** → **Average only**  
- **Volunteers** → counts helpers, not active participants 
- **Hardness metrics** → describe course difficulty, not participation  

Type is usually the **first control** to set when exploring an event, because it defines what the numbers in the table actually represent.

---

<a id="term-unknowns"></a>
### Unknowns

Participants who completed the course but did **not** register a time  
(for example, forgot their barcode or were unscannable).  
Unknowns are included in **participation counts** but excluded from all  
**time‑based analysis**.

Selected via the **Type** control on the  
[Event Analysis](#page-event-analysis) page.

A count of **Unknowns** also appears on the  
[Course Page](#page-course),  
showing how many unregistered or unscannable finishers were present at  
each event in the course’s history.  
This provides useful context when reviewing event composition,  
operational issues, and data completeness.

<a id="term-volunteers"></a>
### Volunteers (Volunts)

Counts the number of people who volunteered at the event.  
Volunteers are a separate group from participants and are not included in participant‑based metrics.  
Selected via the Type control on the [Event Analysis](#page-event-analysis) page.

A **Volunteers** column also appears on the  
[Course Page](#page-course),  
showing the **number of volunteers for each event** held at that course.  
This provides useful context when reviewing course history, event conditions, and operational patterns over time.


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

#### Event Statistics Comparison (Plot)

The Event Analysis page includes a Plot button:

<img src="/help-images/plotButton.png" alt="Plot Button" height="50" />

Selecting this button opens the **[Event Statistics Comparison](#section-event-stats-comparison)** chart.  
This chart allows you to visualise up to **five** different metrics at the same time, each shown as a separate legend entry. The lines on the chart update instantly whenever you change:

- the selected **Type**
- the **Calc** option
- the **Period**
- the **Agg** method
- any adjustment settings (Course Adj, Other Adj, Time Adj)

This makes it easy to compare trends such as participants, PBs, tourists, volunteers, or hardness across the selected events.


<a id="section-event-stats-comparison"></a>

### Event Statistics Comparison Chart

<img src="/help-images/eventStatsComp.png" alt="Event Status Comp Chart" height="300" />

**Purpose Description**

This chart gives a visual comparison of the selected Event Analysis metric across dates and courses. It is intended to make trends, spikes and outliers easier to spot than in the main table alone.

The Event Statistics Comparison chart allows you to compare up to **five** different metrics at the same time.  
You can select any combination of Types (for example: Participants, PBs, Tourists, Volunteers, Combined Hardness), and each selected item appears as a separate **legend entry** on the chart.

The chart updates automatically whenever you change:

- the selected **Type**  
- the **Calc** option  
- the **Period**  
- the **Agg** method  
- or any of the adjustment controls (such as Course Adj or Time Adj)

This makes it easy to explore how different metrics behave over time and how they relate to each other.

**Navigation**

It sits alongside the Event Analysis page and is interpreted together with the same selections. Users typically review the table first and then use the chart to confirm trend direction or highlight unusual events.

**Label and Selection list**

- Inherits the current Event Analysis selections, especially `Type`, `Calc`, `Period` and `Agg`.
- Legend labels identify the displayed series.

**Buttons**

- Legend selection shows or hides individual plotted series.
- Zoom and pan controls, where enabled by the chart component, help focus on a specific time range.

**Tables, Plots and Previews**

- Comparison plot: shows the chosen event statistic across dates.
- Visual preview of outliers: makes unusually high or low events easier to spot before drilling further.

**Plot Controls**  
See: [Plot Controls](#section-plot-controls)


The chart uses a shared set of plot controls that appear on several pages throughout the app.  
These controls allow you to:

- move the **date window** forward or backward  
- zoom **in** or **out**  
- switch between **daily** and **cumulative** views  
- adjust the **time axis**  
- pan the chart horizontally or vertically  

These controls make it easy to explore long histories, zoom into specific periods, or compare trends across multiple courses.

**Switching Between Table and Plot Views**

When the Event Statistics Comparison chart is displayed, an additional button appears:

<img src="/help-images/tableButton.png" alt="Table Button" height="50" />

Selecting this button returns you to the main **Event Analysis table**.  
This makes it easy to switch back and forth between the numerical table and the visual chart without losing your place or selections

**Expand/reduce chart**

is used on laptop/desktop to make a chart bigger: [Expand](#section-expand-reduce)

<a id="page-single-event"></a>

### Event Page 

#### Purpose Description

Event Page is the drill-down page for a single dated parkrun event. It is used to inspect one event in detail, including participant rows, adjusted times and event-specific context.

#### Navigation

This page is most commonly opened from [Event Analysis](#page-event-analysis). Use the back button to return to the previous summary page in the same state, or follow athlete, course and club links to continue drilling down.

#### Label and Selection list

The Event Analysis page includes several selection controls that change how the table and charts behave.  
Each control affects the interpretation of the selected metric and how the data is displayed.

#### Course Selection

At the top of the Event page, the course name is shown as a clickable label.  
This label provides two useful behaviours:

1. **Click to open the Course page**  
   Selecting the course name takes you directly to the [Course](#page-course) page for that event.  
   This allows quick access to full course history, statistics and related navigation.

2. **Hold to change the course**  
   If you **hover the cursor over the course name for more than two seconds**, a course‑selection box appears.  
   You can begin typing the name of any course, and matching courses will appear in the list.  
   Selecting a course loads that course **for the same event date currently being displayed**.

This makes it easy to switch between courses when comparing events on the same day, or when stepping through events using the Event Step controls.

- **Course Adj**  
  [Course Adj](#control-course-adj) changes whether **raw**, **seasonal**, or **full event** adjustment is applied to the selected metric.  
  Use this to compare events fairly across different course conditions.

- **Other Adj**  
  [Other Adj](#control-other-adj) changes whether **no adjustment**, **age adjustment**, **sex adjustment**, or **age‑and‑sex adjustment** is applied.  
  This normalises participant‑level differences before summarising the data.

- **Table View**  
  [Table View](#term-basic) changes which event columns are visible.  
  Use **Basic** for a compact view, **Detailed** for the wider standard table,
  **All Time Adjustments** for adjusted times, or **Event Ranks** to compare
  raw and adjusted event placing side by side.

- **Event Headline Labels**  
  Headline labels such as:  
  - [Event Date (Ev Date)](#control-event-date)  
  - [Event Number (Event #)](#control-event-number)  
  - [Hardness](#section-course-hardness)  

  These provide context for the selected day and help interpret the values shown in the table and charts.

  see [Time Adjustment comparison within Event Page](#section-time-adj-event-page)

<a id="event-step-controls"></a>
#### Event Step Controls

The Event page includes a step control:

<img src="/help-images/eventStep.png" alt="Event Step Controls" height="50" />

This control allows you to move **backward** or **forward** through the sequence of events for the course currently being displayed.

- The **left arrow** steps to the **previous event**  
- The **right arrow** steps to the **next event**

This provides a fast and convenient way to navigate through a course’s event history without returning to the main Event Analysis table or Course page.

It is especially useful when reviewing:

- changes in participants over time  
- how course conditions evolved  
- PB streaks or seasonal patterns  
- volunteer or club activity across successive events  

The Event Step control keeps you within the same course context, making it easy to explore events in chronological order.

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

Course Page brings together the history and characteristics of a single parkrun course.  
It is used to understand how that location behaves over time and how participants  
perform on it.

#### Navigation

This page is normally reached from Event Analysis, Event Page, Participant Page or  
club/list drill‑down links. From here you can move into specific events or  
participants connected with the course.

#### Label and Selection list

- `Table View`: switches between compact and more detailed course tables.  
- Course‑specific labels identify the course and its summary metrics.  
- Top 250 and similar sections may use headings driven by the course layout config.

#### Buttons

- Sortable table headers reorder course‑level summaries and Top 250 lists.  
- Linked rows or names navigate to event or participant detail.  
- Back navigation returns to the prior context.  
- Additional buttons (such as **Top250**, **Plot Parts**, **Plot Hardness**,  
  and **Plot Groups**) provide deeper drill‑downs into course‑level statistics  
  and long‑term behaviour.

#### Tables, Plots and Previews

- Course summary tables: show key metrics for the selected course.  
- Top participant tables: highlight leading or most notable performances on that course.  
- Any supporting visuals on the page give quick context before deeper drill‑down.

#### Top250

The **Top250** button displays a table of the **Top 250 participants** in the  
course’s history.  
Participants are initially ranked by their **combined total** of:

- **Total runs** at the course  
- **Total volunteer roles** at the course

This table provides a rich set of participant‑level columns, including:

- **Last run date** on the course  
- **Last volunteer date** on the course  
- **Club** (with link to the [Club Page](#page-club))  
- **Rank** (linked to the participant’s ranking profile)  
- **Best time** at the course  
- **Adjusted times**, where applicable (e.g., event‑adjusted, age‑adjusted, age‑sex‑adjusted)

The Top250 view is designed to surface the most engaged, most experienced,  
and most notable participants associated with the course, giving a deeper  
understanding of the course community and its long‑term patterns.

#### Expand

Throughout the plotting experience, the [Expand Button](#section-expand-reduce) can be used to  
view charts in a larger, more detailed format. 

<a id="plotCourseStatsComp"></a>
### Plot Parts

The **Plot Parts** button displays the **Course Statistics Comparison** chart.  
This visual shows:

- the **monthly aggregate participation** for the selected course  
- compared against the **aggregate participation across the entire local course universe**  
- alongside the **previous year’s monthly participation**  
- with **maximum** and **minimum** values across the universe for additional context

This chart helps illustrate how the course’s attendance trends compare to  
local norms and how participation evolves seasonally and year‑to‑year.

*Example:*  
<img src="/help-images/courseStatsComp.png" alt="Course Stats Comparison" height="250" />

<a id="plotCourseStatsCompHard"></a>
### Plot Hardness

The **Plot Hardness** button provides a visual breakdown of the course’s  
**hardness profile**, showing:

- **historic hardness by month**  
- **last year’s hardness by month**  
- the contribution from **seasonality**  
- the contribution from **event difficulty**

This plot helps explain how the course’s difficulty changes over time and  
how the **Event Hardness Model** interprets the underlying conditions.

More detail on hardness can be found in the  
[Course Hardness Model](#section-course-hardness).

*Example:*  
<img src="/help-images/courseStatsCompHard.png" alt="Course Stats Hardness" height="250" />

<a id="plotCourseStatsCompGroups"></a>
### Plot Groups

The **Plot Groups** button generates a detailed monthly breakdown of  
participant composition.  
This plot may take up to **30 seconds** to produce; it can be skipped by  
clicking through the button sequence if needed.

For each month, two **bar stacks** are shown:

1. **Participant Type Stack**  
   - 1st Timers  
   - Tourists  
   - Returners  
   - Regulars  
   - and other participant‑type categories

2. **Demographic Stack**  
   - Female / Male split  
   - Age‑group distribution

Additional controls:

- **Index**: toggles between absolute counts and **100% ratio mode**  
- **Type Group**: isolates individual bar stacks for focused analysis

This plot provides a rich view of how the course’s participant mix changes  
over time.

*Example:*  
<img src="/help-images/courseStatsCompGroup.png" alt="Course Stats Group" height="250" />
 
<a id="page-participant"></a>

### Participant Page

#### Purpose Description

Participant Page shows the run history, progression and profile of an individual athlete. It is used to compare adjusted and unadjusted performances, check consistency and review milestone patterns.

#### Navigation

This page is usually reached from event, course, club or list tables by clicking a participant. From here you can move into related courses, clubs and dated events for that athlete.

#### Label and Selection list

- `Course Adj`: changes the course-condition adjustment applied to displayed results.
- `Other Adj`: changes the participant-level adjustment, such as age, sex or age-and-sex.
- `Table View`: changes the visible participant-history columns and includes
  `Basic`, `Detailed`, `All Time Adjustments`, and `Event Ranks`.
- Supporting labels include `Athlete Code`, `Estimated Age`, `Total Runs`, `Recent Club` and `Freq Course`.

#### Buttons

- Sortable headers reorder run-history and summary tables.
- `Ranks` opens the **Curved Rank Time Reference** dialog showing rank cut-offs for the selected rank type and snapshot date.
- Linked course, club and event values open the next level of detail.
- Back navigation returns to the prior page state.

#### Tables, Plots and Previews

- Participant history table: shows the athlete's runs and key fields over time.
- Profile summary areas: give quick access to best performances and rankings.
- Time progression visuals help show changes in form across dates.

<a id="section-curved-rank-time-reference"></a>

### Curved Rank Time Reference

See: [Ranked Time Reference](#term-ranked-time-reference)

The **Curved Rank Time Reference** dialog is opened from the **Ranks** button on the
[Participant Page](#page-participant).

It shows the **rank cut-off table** used to map raw or adjusted times into curved
rank scores for a selected reference snapshot.

**What the table shows**

- `Rank`: the curved rank group, shown from highest to lowest.
- `Min time`: the fastest time inside that rank group.
- `Max time`: the slowest time still inside that rank group.
- `Low bound`: the lower score boundary for that group.
- `High bound`: the upper score boundary for that group.
- `Rank cnt`: the number of source rows assigned to the group in that snapshot.

**Selectors**

- `Rank type` switches between **Best Time**, **Event Adj (E)**,
  **Event & Sex Adj (ES)**, **Age & Event Adj (AE)**, and
  **Age & Event & Sex Adj (AES)**.
- `Date Snap` switches between the available discrete
  `curve_rank_reference_version` snapshots, shown most recent first.

Use this dialog when you want to inspect the cut-off bands behind the curved rank
scores shown on participant history, profile, and event-rank views.

---

<a id="section-participant-profile"></a>

### Participant Profile 

#### Purpose Description

Participant Profile is a summary panel within the Participant Page.  
It condenses the runner’s standout performances, ranking context, and  
representative dates into a compact snapshot.  
It provides a high‑level view of how the participant performs across  
different adjusted‑time measures before the user explores the full  
run‑history table or time‑by‑date chart.

#### Navigation

Participant Profile is part of the broader Participant Page rather than a  
standalone destination.  
Users typically read it first to understand the participant’s overall  
performance shape, then scroll down for detailed results.

#### Label and Selection list

- Inherits the **adjustment settings** selected on the Participant Page.  
- Uses labels such as **best time**, **rank**, **date**, and  
  **adjusted‑time variants** to summarise performance.  
- Shows both **1‑year** and **all‑time** perspectives.

#### Buttons

- The profile is generally **read‑only**.  
- Any links present (e.g., dates or course names) take the user directly to  
  the related **Event Page** or **Course Page**.

#### Tables, Plots and Previews

- **Summary preview panel**: shows best‑result combinations at a glance.  
- **Quick comparison fields**: contrast adjusted and unadjusted achievements  
  without needing to read the full history table.

#### Ranking Rows

The Participant Profile contains **two ranking rows**, each comparing the  
participant across multiple adjusted‑time measures.

#### **1. One‑Year Rankings (1Y)**  
The first row shows how the participant ranks **over the past year** across:

- **Actual** time  
- **Event‑adjusted** time  
- **Event & Sex‑adjusted** time  
- **Event & Age‑adjusted** time  
- **Event, Age & Sex‑adjusted** time  
- **Local run count** in the same one‑year window

This row answers:  
**“How strong is this participant right now?”**

#### **2. All‑Time Rankings (All)**  
The second row shows how the participant ranks **across their entire recorded  
history**, using the same set of adjusted‑time variants:

- **Actual**  
- **Event‑adjusted**  
- **Event & Sex‑adjusted**  
- **Event & Age‑adjusted**  
- **Event, Age & Sex‑adjusted**  
- **Total runs** across all time

Example:
<img src="/help-images/profile.png" alt="Profile" height="200" />

This row answers:  
**“How strong is this participant across their full parkrun career?”**

All rank scores shown in the Participant Profile are **clickable**.  
Selecting any rank value takes you directly to the **specific event** in the
participant’s full event‑history table.  
This allows you to jump straight to the underlying performance — including the
event date, course, raw time, and all adjusted‑time variants — without manually
scrolling through the history.

### Course Distribution Pie Chart

The Participant Profile also includes a **pie chart** showing how the  
participant’s runs are distributed across different courses.

- The **five most significant courses** (by run count) are shown individually.  
- **Other local courses** are grouped together into a single segment.  
- **Non‑local runs** (outside the app’s local‑course universe) are shown as a  
  separate segment.

This provides a clear visual summary of:

- where the participant runs most often  
- how varied their course history is  
- how much of their running is local vs non‑local

### Summary

Participant Profile gives a concise, high‑value overview of a participant’s:

- best performances  
- adjusted‑time strengths  
- recent vs long‑term ranking  
- course‑usage patterns  

It acts as a **snapshot** of the participant’s running identity before  
diving into the detailed tables below.

<a id="section-time-by-date"></a>
<a id="section-participant-time-by-date">
### Time by Date

The **Time by Date** chart is found on the Participant Page and appears directly
after the [Participant Profile](#section-participant-profile).  
It is selected by pressing the chart‑mode button until it displays **Plot**.

This chart is one of the **central analytical tools** in the entire app.  
For each participant, it provides a complete visual history of performance across:

- **Time**  
- **Date**  
- **Course**  
- **Adjusted‑time ranking**

It allows you to see long‑term trends, course‑specific patterns, and how the
participant’s performance evolves under different adjustment settings.

#### What the Chart Shows

Each event is represented by a **single point**, plotted by:

- **Date** (horizontal axis)  
- **Time** (left vertical axis)

Example:
<img src="/help-images/timeAndDate.png" alt="Profile" height="500" />

Points are **colour‑coded by course**, with a legend showing all courses the
participant has run.  
Clicking a course name in the legend filters the chart to **only that course**,
making it easy to analyse course‑specific performance.

A secondary vertical axis shows **Curve Rank**, allowing you to see how the
participant’s ranking changes over time when ranking data is displayed.

#### Show Buttons

The chart display is controlled by three toggle buttons:

#### **Eligible → Best → All**
Controls which events are shown:

- **Eligible**  
  Shows only events that qualify as *Eligible Runs*  
  (see [Eligible Runs](#term-eligible-runs))  
  — used for course‑ranking calculations.

- **Best**  
  Shows only the participant’s **best runs within a 3‑month window**, helping
  highlight peak performance periods.

- **All** *(default)*  
  Shows **every recorded run** for the participant.

#### **Rank Only → Both Series → Events Only**
Controls whether ranking data is displayed:

- **Rank Only**  
  Shows only the participant’s **ranking history** (adjusted‑time rank curve).

- **Both Series**  
  Shows **both** the event‑time points **and** the ranking curve.

- **Events Only**  
  Shows only the **event‑time points**, without ranking.

These modes allow you to switch between pure time analysis, pure ranking
analysis, or a combined view.

#### **Expand**
On laptops and desktops, **Expand** opens the chart in a larger view for easier
inspection of dense or long‑range data.

#### Date and Time Controls

The chart includes interactive controls:

- **Date + / Date −**  
  Zoom or pan the date range.

- **Time + / Time −**  
  Zoom the time axis to focus on faster or slower periods.

- **Pan‑out**  
  Resets the view to a broader range.

These controls make it easy to explore long histories or zoom in on specific
periods of interest.

see [Plot Controls](#section-plot-controls)

#### Adjustment Controls

The chart responds instantly to the **Course Adj** and **Other Adj** settings:

- Selecting **Event Adjustment** applies event‑hardness corrections to all times.  
- Selecting **Age Adjustment** additionally adjusts for the participant’s age.  
- Selecting **Sex Adjustment** applies sex‑normalisation where relevant.

When adjustments are applied, the plotted times and ranking curve update
automatically.

These adjustments help reveal whether the participant is **improving relative to
conditions**, not just running faster or slower due to course difficulty,
weather, or seasonal effects.

#### Summary

The **Time by Date** chart provides:

- a complete visual history of the participant’s performance  
- course‑specific colour‑coded analysis  
- ranking trends over time  
- filtering by Eligible, Best, or All runs  
- interactive zoom and pan controls  
- automatic updates based on adjustment settings  

It is the most powerful tool for understanding how a participant’s running has
evolved across different courses, conditions, and time periods.

---

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

#### Table Buttons

The Club Page contains several tables, and the **table buttons** control which
table is currently displayed.  
These buttons allow you to switch between **historic membership**, **current
membership**, and **course‑popularity** views.

The available buttons are:

-> **Current & Historic Membership** (default)
Shows the **full membership history** for the club, including all participants
who have ever represented the club at parkrun.  
This is the starting table when the Club Page loads.

-> **Current members**
Displays the **Current Membership** table.  
This table shows only those participants who are **currently registered** as
members of the club.

-> **Event**
Displays the **Club Popularity** table.  
This table summarises how often the club attends each course, using metrics such
as:
- Event cnt  
- Freq  
- Members  
- Order  
(and their 1‑year variants)

This view helps identify the **most popular courses** for the club.

**Members**
Returns the user to the **Current & Historic Membership** table.  
This acts as a quick way to navigate back to the full membership list after
viewing the other tables.

<a id="page-lists"></a>

### Lists Page

#### Purpose Description

The Lists Page provides **predefined leaderboards** of up to **1000 participants**,
ranked according to criteria chosen by the user.  
It is the quickest way to view the **fastest athletes**, the **most active
parkrunners**, or other high‑level summaries without building a custom analysis.

Lists can focus on:

- **speed** (fastest athletes)
- **participation volume** (most runs, most local runs)
- **recent performance** (1‑year windows)
- **other categories** as they are added over time

Each list is dynamically generated based on the user’s selections and can be
further refined using filters and adjustment settings.

#### Navigation

The Lists Page is normally accessed directly from the main navigation.  
From any leaderboard, you can drill into:

- **Participant Pages**
- **Course Pages**
- **Club Pages**
- **Event Pages**

by clicking the linked values in the table.

Back navigation returns you to the previous page if the list was reached via
drill‑down.

#### Label and Selection List

The Lists Page includes several key selectors that define what the leaderboard
shows:

**List Selection**
Determines the **type of leaderboard** to load.  
Examples include:

- Fastest Athletes – All Time  
- Fastest Athletes – Over Last 1 Year  
- Highest Total Runs  
- Highest Local Runs  
- Highest Local Runs – Over Last 1 Year  

This selection automatically sorts the table by the column relevant to the
chosen list.

**Participants Filter**
Applies **minimum‑history thresholds** to refine the list.  
Examples include:

- All participants  
- Participants with >50 total runs  
- Participants with >50 local runs  
- Participants with >10 local runs in the last year  

These filters help focus on **local athletes**, **experienced runners**, or
participants with meaningful history, rather than tourists or occasional visitors.

**Course Adj** and **Other Adj**
These settings apply the same adjustment logic used throughout the app:

- **Event adjustment**  
- **Age adjustment**  
- **Sex adjustment**  
- **Combinations of the above**

This allows you to view lists such as:

- Fastest athletes **adjusted for event difficulty**  
- Fastest athletes **adjusted for age and sex**  
- Fastest athletes **fully adjusted** (event + age + sex)

This makes the Lists Page a powerful tool for **fair comparison** across
participants with different ages, sexes, and course histories.

**Use adj. filters**
Controls whether the adjustment settings affect the **source list** or only the
**displayed columns**.

#### Buttons

- Clicking any **column header** re‑sorts the list client‑side.  
  This works within the **top 1000** participants who met the selection criteria.
- Clicking a **participant**, **course**, **club**, or **event** value opens the
  corresponding detail page.
- Back navigation returns to the previous context.

#### Tables, Plots and Previews

The Lists Page displays a single main table:

**Main Leaderboard Table**
Shows the top 1000 participants matching the selected criteria.  
For each participant, the table provides a **rich set of performance data**, such
as:

- best time  
- date of best time  
- finishing position  
- ranking under different adjustment methods  
- age group and age grade at the time  
- course and club at the time  
- recent run history  
- one‑year run totals  
- all‑time adjusted metrics for the identified event  

This gives a deep, contextual view of **why** each participant appears in the
list.

#### Summary

The Lists Page is the place to:

- view **top‑1000 leaderboards**  
- compare athletes by **speed**, **participation**, or **adjusted performance**  
- filter participants by **experience**, **locality**, or **recent activity**  
- apply **course**, **age**, and **sex** adjustments  
- drill into detailed participant, course, club, or event pages  

It provides a fast, flexible way to explore the parkrun universe from multiple
angles, without needing to build custom queries elsewhere in the app.

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
