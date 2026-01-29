# 🛡️ Deep Work Defender

A Google Apps Script that automatically scans your calendar, calculates your remaining free time, and backfills **Focus Time** blocks to defend your calendar from back-to-back overload and actually get some work done!

Unlike basic time-blockers, this script is math-aware: it calculates how much Focus Time you *already* have for a specific day and only books the difference needed to reach your daily quota (e.g., 5 hours).

## ✨ Features

* **Gap Analysis:** Counts existing focus time and only books what is missing to reach your daily cap.
* **Conflict Aware:** Respects your working hours and existing meetings. It treats "Invited" and "Maybe" events as busy, but ignores "Declined" events.
* **Native Focus Mode:** Creates official Google Calendar "Focus Time" events (includes the 🎧 icon and "Do Not Disturb" status).
* **Rolling Window:** Designed to run automatically (e.g., every morning) to backfill slots that open up due to cancellations.
* **Timezone Safe:** Works correctly across different global timezones.

## 🛠️ Installation

### 1. Create the Script
1.  Go to [script.google.com](https://script.google.com/).
2.  Click **"New Project"**.
3.  Name the project (e.g., `Deep-Work-Defender`).
4.  Copy the code from `Code.gs` in this repository and paste it into the script editor (replacing any default code).

### 2. Enable Advanced Calendar API (Required)
*This allows the script to create the special "Focus Time" events with the purple color.*

1.  In the left sidebar, click the **+** button next to **Services**.
2.  Select **Google Calendar API** from the list.
3.  Click **Add**.

### 3. Set the Timezone (Critical)
*If you skip this, the script might run on US time and miss your working hours.*

1.  Click the **Project Settings** (Gear icon ⚙️) in the sidebar.
2.  Check the box **"Show 'appsscript.json' manifest file in editor"**.
3.  Go back to the **Editor** and click on the new `appsscript.json` file.
4.  Find the line `"timeZone": "America/New_York"` (or similar).
5.  Change it to your local timezone, for example:
    * `"Australia/Brisbane"`
    * `"Europe/London"`
    * `"America/Los_Angeles"`
6.  Save the file.

## ⚙️ Configuration

At the top of the script (`Code.gs`), edit the `CONFIG` object to match your preferences:

```javascript
const CONFIG = {
  CALENDAR_ID: 'your.email@example.com', // <--- PUT YOUR EMAIL HERE
  EVENT_TITLE: "Focus time",             // Name of the event on your calendar
  DAILY_GOAL_HOURS: 5,                   // How many hours of focus time do you want per day?
  MIN_CHUNK_MINUTES: 60,                 // Minimum size of a focus block (e.g. 1 hour)
  SEARCH_DAYS: 14,                       // How many days ahead to schedule
  WORK_START_HOUR: 8,                    // Start of work day (24h format, e.g. 8 for 8am)
  WORK_START_MIN: 30,                    // Minutes (e.g. 30 for 8:30am)
  WORK_END_HOUR: 17,                     // End of work day (17 = 5pm)
  WORK_END_MIN: 0,
  COLOR_ID: '3'                          // See "Color Reference" below
};
```

# Color Reference

Change COLOR_ID to pick your event color:

- 1: Lavender
- 2: Sage
- 3: Grape (Purple) - Default
- 4: Flamingo
- 5: Banana
- 11: Tomato (Red)

## 🤖 Automation (How to run it automatically)

To have this run every morning:

1. In the Apps Script sidebar, click on Triggers (Clock icon ⏰).
2. Click + Add Trigger (bottom right).
3. Configure the settings:
  - Function to run: bookFocusTime
  - Event source: Time-driven
  - Type of time based trigger: Day timer
  - Time of day: 6am to 7am (or before your workday starts).
4. Click Save.
