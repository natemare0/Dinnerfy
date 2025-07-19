// This version removes the /api prefix from all frontend API calls
// since it's already handled by the backend blueprint

import React, { useState, useEffect } from 'react';
import './Calendar.css';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

// ... (rest of the imports and component code remains the same)

// In the component's code, update all fetch calls to remove the /api prefix:

// Example of updated fetch calls:
// 1. Fetch assignments
useEffect(() => {
  fetch(`http://localhost:5000/assignments?month=${activeMonth}`)
    .then(/* ... */);
}, [activeMonth, reloadAssignments]);

// 2. Fetch dinners
useEffect(() => {
  fetch('http://localhost:5000/dinners')
    .then(/* ... */);
}, []);

// 3. Handle assignments
function handleAssignment(date, dinnerId) {
  fetch('http://localhost:5000/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, dinner_id: dinnerId })
  })
  .then(/* ... */);
}

// 4. Clear assignments
function handleClearAssignments() {
  fetch('http://localhost:5000/assignments/clear', {
    method: 'POST'
  })
  .then(/* ... */);
}

// ... (rest of the component code remains the same)

export default CalendarComponent;
