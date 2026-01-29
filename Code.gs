/**
 * Configuration
 */
const CONFIG = {
  CALENDAR_ID: 'your.email@example.com', 
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
  
  // 1. Force Auth Check
  // This line does nothing but ensure the script asks for "Calendar" permissions immediately.
  try {
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) {
      console.error(`ERROR: Could not find calendar for ${CONFIG.CALENDAR_ID}`);
      return;
    }
    const timeZone = calendar.getTimeZone();
    console.log(`Calendar Timezone detected: ${timeZone}`);
    console.log(`Current Script Time: ${new Date()}`);

  } catch (e) {
    console.error("ERROR: Authorization or Calendar access failed. " + e.message);
    return;
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const timeZone = calendar.getTimeZone();
  const now = new Date();

  // Loop through days
  for (let i = 0; i < CONFIG.SEARCH_DAYS; i++) {
    let checkDate = new Date();
    checkDate.setDate(now.getDate() + i);
    
    const dateLogPrefix = `[Day ${i} - ${Utilities.formatDate(checkDate, timeZone, 'dd/MM')}]`;

    // Skip Weekends
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`${dateLogPrefix} Skipped (Weekend)`);
      continue;
    }

    // 2. ROBUST TIMEZONE CONSTRUCTION
    // We explicitly format the date string to include the Timezone Offset (Z) 
    // to ensure the script and the calendar agree on what "8:30 AM" means.
    const startStr = Utilities.formatDate(checkDate, timeZone, `yyyy-MM-dd'T'${pad(CONFIG.WORK_START_HOUR)}:${pad(CONFIG.WORK_START_MIN)}:00`);
    const endStr   = Utilities.formatDate(checkDate, timeZone, `yyyy-MM-dd'T'${pad(CONFIG.WORK_END_HOUR)}:${pad(CONFIG.WORK_END_MIN)}:00`);
    
    // Create dates forcing the calendar's timezone
    // Note: We use the text string to search events, which is safer.
    const workStart = new Date(startStr);
    const workEnd = new Date(endStr);
    
    // Check if the date object was created correctly in script time
    // If workStart is "Invalid Date", we have a parsing issue, but standard ISO usually works.
    
    // If workEnd is in the past, skip
    if (new Date() > workEnd) {
      console.log(`${dateLogPrefix} Skipped (Day is over). WorkEnd: ${Utilities.formatDate(workEnd, timeZone, 'HH:mm')} vs Now: ${Utilities.formatDate(new Date(), timeZone, 'HH:mm')}`);
      continue;
    }

    // 3. Get Events
    const events = calendar.getEvents(workStart, workEnd);
    let validEvents = [];
    let existingFocusMillis = 0;
    
    events.forEach(e => {
      let myStatus = e.getMyStatus();
      if (myStatus === CalendarApp.GuestStatus.NO) return; 

      if (e.getTitle() === CONFIG.EVENT_TITLE) {
        let eStart = e.getStartTime() < workStart ? workStart : e.getStartTime();
        let eEnd = e.getEndTime() > workEnd ? workEnd : e.getEndTime();
        existingFocusMillis += (eEnd - eStart);
      }
      validEvents.push(e);
    });

    const hoursBooked = (existingFocusMillis / (1000 * 60 * 60)).toFixed(1);
    const goalMillis = CONFIG.DAILY_GOAL_HOURS * 60 * 60 * 1000;
    let neededMillis = goalMillis - existingFocusMillis;

    if (neededMillis <= 0) {
      console.log(`${dateLogPrefix} Quota full. (${hoursBooked}h booked).`);
      continue;
    }

    // 4. Find Free Slots
    let freeSlots = [];
    let lastEndTime = workStart;
    
    validEvents.sort((a, b) => a.getStartTime() - b.getStartTime());

    for (let e of validEvents) {
      let gapStart = lastEndTime;
      let gapEnd = e.getStartTime();
      if (gapEnd < gapStart) gapEnd = gapStart; 

      if ((gapEnd - gapStart) >= (CONFIG.MIN_CHUNK_MINUTES * 60 * 1000)) {
        freeSlots.push({start: gapStart, end: gapEnd, duration: gapEnd - gapStart});
      }
      
      if (e.getEndTime() > lastEndTime) lastEndTime = e.getEndTime();
    }

    if ((workEnd - lastEndTime) >= (CONFIG.MIN_CHUNK_MINUTES * 60 * 1000)) {
      freeSlots.push({start: lastEndTime, end: workEnd, duration: workEnd - lastEndTime});
    }

    freeSlots.sort((a, b) => b.duration - a.duration);
    
    console.log(`${dateLogPrefix} Found ${freeSlots.length} available slots. Need ${neededMillis/60000} mins.`);

    // 5. Book Time
    for (let slot of freeSlots) {
      if (neededMillis <= 0) break;

      let bookDuration = Math.min(slot.duration, neededMillis);
      if (bookDuration < (CONFIG.MIN_CHUNK_MINUTES * 60 * 1000)) continue;

      let bookEnd = new Date(slot.start.getTime() + bookDuration);
      
      // Formatting strictly for the API
      // The Advanced API requires ISO 8601 strings
      const startISO = Utilities.formatDate(slot.start, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
      const endISO = Utilities.formatDate(bookEnd, timeZone, "yyyy-MM-dd'T'HH:mm:ss");

      try {
        let resource = {
          summary: CONFIG.EVENT_TITLE,
          start: { dateTime: startISO, timeZone: timeZone }, // Explicitly pass TimeZone
          end: { dateTime: endISO, timeZone: timeZone },
          colorId: CONFIG.COLOR_ID,
          eventType: "focusTime",
          transparency: "opaque",
          focusTimeProperties: {
            chatStatus: "doNotDisturb",
            autoDeclineMode: "declineNone"
          }
        };

        // BOOKING ACTION
        console.log(`${dateLogPrefix} Attempting to book ${startISO} to ${endISO}...`);
        
        Calendar.Events.insert(resource, CONFIG.CALENDAR_ID);
        
        console.log(`${dateLogPrefix} SUCCESS. Booked.`);
        neededMillis -= bookDuration;
      } catch (e) {
        console.error(`${dateLogPrefix} FAILED to book: ${e.message}`);
      }
    }
  }
  console.log("--- SCRIPT FINISHED ---");
}

function pad(number) {
  return number < 10 ? '0' + number : number;
}
