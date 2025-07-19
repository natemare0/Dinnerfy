// This is a fixed version of Calendar.js with all API endpoints updated to use /api prefix
// Copy this content to replace the existing Calendar.js file

import React, { useState, useEffect } from 'react';
import './Calendar.css';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

// ... (keep all the existing imports and helper functions)

// In the component's code, update all fetch calls to include the /api prefix:

// 1. Fetch assignments
useEffect(() => {
  fetch(`http://localhost:5000/api/assignments?month=${activeMonth}`)
    .then(/* ... */);
}, [activeMonth, reloadAssignments]);

// 2. Fetch dinners
useEffect(() => {
  fetch('http://localhost:5000/api/dinners')
    .then(/* ... */);
}, []);

// 3. In handleRandomAssignMonth:
async function handleRandomAssignMonth() {
  // ...
  const dinnersResp = await fetch('http://localhost:5000/api/dinners');
  // ...
}

// 4. In handleRandomAssignRange:
async function handleRandomAssignRange(start, end) {
  // ...
  const dinnersResp = await fetch('http://localhost:5000/api/dinners');
  // ...
}

// 5. In handleAssignDinner:
function handleAssignDinner() {
  // ...
  fetch('http://localhost:5000/api/assignments', {
    method: 'POST',
    // ...
  });
}

// 6. In handleClearAssignments:
function handleClearAssignments() {
  // ...
  fetch(`http://localhost:5000/api/assignments?date=${dateStr}`, {
    method: 'DELETE'
  });
  // ...
}

// ... (rest of the component code remains the same)

export default CalendarComponent;
