/**
 * Deep Work Defender
 * Verbose Logging Version
 */

const CONFIG = {
  CALENDAR_ID: 'your.email@example.com', // <--- UPDATE THIS
  EVENT_TITLE: "Focus time",
  DAILY_GOAL_HOURS: 5,
  MIN_CHUNK_MINUTES: 60, 
  SEARCH_DAYS: 14,       
  WORK_START_HOUR: 8,
  WORK_START_MIN: 30,
  WORK_END_HOUR: 17,     
  WORK_END_MIN: 0,
  COLOR_ID: '3' // Purple
};

function bookFocusTime() {
  console.log("--- SCRIPT STARTED ---");
  
  let calendar;
  try {
    calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) throw new Error("Calendar not found");
  } catch (e) {
    console.error(`ERROR: Could not access calendar. ${e.message}`);
    return;
  }

  const timeZone = calendar.getTimeZone();
  console.log(`Timezone: ${timeZone}`);
  const now = new Date();

  // Loop through days
  for (let i = 0; i < CONFIG.SEARCH_DAYS; i++) {
    let checkDate = new Date();
    checkDate.setDate(now.getDate() + i);
    
    const dateLog = `[Day ${i} - ${Utilities.formatDate(checkDate, timeZone, 'dd/MM')}]`;

    // Skip Weekends
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`${dateLog} Skipped (Weekend)`);
      continue;
    }

    // Construct Start/End times
    const startStr = Utilities.formatDate(checkDate, timeZone, `yyyy-MM-dd'T'${pad(CONFIG.WORK_START_HOUR)}:${pad(CONFIG.WORK_START_MIN)}:00`);
    const endStr   = Utilities.formatDate(checkDate, timeZone, `yyyy-MM-dd'T'${pad(CONFIG.WORK_END_HOUR)}:${pad(CONFIG.WORK_END_MIN)}:00`);
    
    const workStart = new Date(startStr);
    const workEnd = new Date(endStr);
    
    // If workEnd is in the past, skip
    if (new Date() > workEnd) {
      console.log(`${dateLog} Skipped (Day ended)`);
      continue;
    }

    // FETCH EVENTS
    let eventsItems = [];
    try {
      const response = Calendar.Events.list(CONFIG.CALENDAR_ID, {
        timeMin: workStart.toISOString(),
        timeMax: workEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      eventsItems = response.items || [];
    } catch (e) {
      console.error(`${dateLog} Error fetching events: ${e.message}`);
      continue;
    }

    let validEvents = [];
    let existingFocusMillis = 0;
    
    // Filter Events
    eventsItems.forEach(item => {
      // Ignore Transparent (Free) Events
      if (item.transparency === 'transparent') return; 

      // Ignore Declined Events
      if (item.attendees) {
        const self = item.attendees.find(a => a.self === true);
        if (self && self.responseStatus === 'declined') return;
      }

      const eStartRaw = item.start.dateTime || item.start.date;
      const eEndRaw = item.end.dateTime || item.end.date;
      const eStartObj = new Date(eStartRaw);
      const eEndObj = new Date(eEndRaw);

      // Check Existing Focus Time
      if (item.summary === CONFIG.EVENT_TITLE) {
        let overlapStart = eStartObj < workStart ? workStart : eStartObj;
        let overlapEnd = eEndObj > workEnd ? workEnd : eEndObj;
        if (overlapEnd > overlapStart) {
           existingFocusMillis += (overlapEnd - overlapStart);
        }
      }
      
      validEvents.push({ start: eStartObj, end: eEndObj });
    });

    // Calculate Quota
    const goalMillis = CONFIG.DAILY_GOAL_HOURS * 60 * 60 * 1000;
    let neededMillis = goalMillis - existingFocusMillis;
    const existingHours = (existingFocusMillis / (1000 * 60 * 60)).toFixed(1);

    if (neededMillis <= 0) {
      console.log(`${dateLog} Quota full (${existingHours}h existing).`);
      continue;
    }

    // Gap Analysis
    let freeSlots = [];
    let lastEndTime = workStart;
    
    validEvents.sort((a, b) => a.start - b.start);

    for (let e of validEvents) {
      let gapStart = lastEndTime;
      let gapEnd = e.start;
      if (gapEnd < gapStart) gapEnd = gapStart; 

      if ((gapEnd - gapStart) >= (CONFIG.MIN_CHUNK_MINUTES * 60 * 1000)) {
        freeSlots.push({start: gapStart, end: gapEnd, duration: gapEnd - gapStart});
      }
      
      if (e.end > lastEndTime) lastEndTime = e.end;
    }

    // Final gap
    if ((workEnd - lastEndTime) >= (CONFIG.MIN_CHUNK_MINUTES * 60 * 1000)) {
      freeSlots.push({start: lastEndTime, end: workEnd, duration: workEnd - lastEndTime});
    }

    freeSlots.sort((a, b) => b.duration - a.duration);

    // LOGGING THE ANALYSIS
    console.log(`${dateLog} Existing: ${existingHours}h. Need: ${(neededMillis/60000).toFixed(0)}m. Found ${freeSlots.length} slots.`);

    // Book Time
    for (let slot of freeSlots) {
      if (neededMillis <= 0) break;

      let bookDuration = Math.min(slot.duration, neededMillis);
      if (bookDuration < (CONFIG.MIN_CHUNK_MINUTES * 60 * 1000)) continue;

      let bookEnd = new Date(slot.start.getTime() + bookDuration);
      
      const startISO = Utilities.formatDate(slot.start, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
      const endISO = Utilities.formatDate(bookEnd, timeZone, "yyyy-MM-dd'T'HH:mm:ss");

      try {
        let resource = {
          summary: CONFIG.EVENT_TITLE,
          start: { dateTime: startISO, timeZone: timeZone },
          end: { dateTime: endISO, timeZone: timeZone },
          colorId: CONFIG.COLOR_ID,
          eventType: "focusTime",
          transparency: "opaque",
          focusTimeProperties: {
            chatStatus: "doNotDisturb",
            autoDeclineMode: "declineNone"
          }
        };

        Calendar.Events.insert(resource, CONFIG.CALENDAR_ID);
        console.log(`${dateLog} >> BOOKED: ${startISO.slice(11,16)} - ${endISO.slice(11,16)}`);
        neededMillis -= bookDuration;
      } catch (e) {
        console.error(`${dateLog} Error booking: ${e.message}`);
      }
    }
  }
  console.log("--- SCRIPT FINISHED ---");
}

function pad(number) {
  return number < 10 ? '0' + number : number;
}
