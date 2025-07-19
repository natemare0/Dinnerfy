import React, { useState, useEffect } from 'react';
import './Calendar.css';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { API_BASE } from '../config';

function getMonthString(date) {
  // Returns YYYY-MM for a JS Date
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function getDateString(date) {
  // Returns YYYY-MM-DD for a JS Date
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function CalendarComponent() {
  const [calendarRange, setCalendarRange] = useState(null); // [startDate, endDate] or null
  const [calendarKey, setCalendarKey] = useState(0); // force remount to reset selection anchor
  const [forceSingleClick, setForceSingleClick] = useState(false); // disables range for one click

  const calendarRef = React.useRef(null);

  // Clear range if click outside calendar
  useEffect(() => {
    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        if (calendarRange) setCalendarRange(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calendarRange]);

  const [date, setDate] = useState(new Date());
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeMonth, setActiveMonth] = useState(getMonthString(new Date()));
  const [dinners, setDinners] = useState([]);
  const [selectedDinnerId, setSelectedDinnerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [reloadAssignments, setReloadAssignments] = useState(0);


  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/assignments?month=${activeMonth}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch assignments');
        return res.json();
      })
      .then(data => {
        // Map assignments by date string for quick lookup
        const map = {};
        data.forEach(a => { if(a && a.date) map[a.date] = a.dinner?.name; });
        setAssignments(map);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeMonth, reloadAssignments]);

  // Fetch dinners for dropdown
  useEffect(() => {
    fetch(`${API_BASE}/dinners`)
      .then(res => res.json())
      .then(setDinners)
      .catch(() => setDinners([]));
  }, []);

  // Called when user navigates months
  function handleActiveStartDateChange({ activeStartDate }) {
    setActiveMonth(getMonthString(activeStartDate));
  }

  // --- RANDOM ASSIGNMENT FEATURE ---
  async function handleRandomAssignMonth() {
    console.log('Starting random assignment for month:', activeMonth);
    setAssigning(true);
    setAssignError(null);
    
    try {
      // 1. Fetch latest dinners
      console.log('Fetching dinners from:', `${API_BASE}/dinners`);
      const dinnersResp = await fetch(`${API_BASE}/dinners`);
      console.log('Dinners response status:', dinnersResp.status);
      
      if (!dinnersResp.ok) {
        const errorText = await dinnersResp.text();
        console.error('Failed to fetch dinners:', errorText);
        throw new Error(`Failed to fetch dinners: ${dinnersResp.status} ${dinnersResp.statusText}`);
      }
      
      const latestDinners = await dinnersResp.json();
      console.log('Fetched dinners:', latestDinners);
      
      if (!latestDinners || !latestDinners.length) {
        throw new Error('No dinners available to assign');
      }
      
      // 2. Calculate month details
      const [year, month] = activeMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      console.log(`Generating assignments for ${year}-${month} (${daysInMonth} days)`);
      
      // 3. Shuffle dinners
      const shuffled = [...latestDinners];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // 4. Create assignments
      const assignPromises = [];
      const assignments = [];
      
      for (let d = 1; d <= daysInMonth; d++) {
        const dinner = shuffled[(d - 1) % shuffled.length];
        // Guard against malformed dinner objects (e.g., deleted after fetch)
        if (!dinner || dinner.id == null) {
          console.warn('Skipping assignment because dinner is invalid:', dinner);
          continue;
        }
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        console.log(`Assigning dinner ${dinner.id} to ${dateStr}`);
        
        const promise = fetch(`${API_BASE}/assignments`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ 
            date: dateStr, 
            dinner_id: Number(dinner.id) 
          })
        })
        .then(async res => {
          if (res.status === 404) {
            console.warn(`Dinner not found for ${dateStr}. Skipping.`);
            return null; // treat as successful skip
          }
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.error(`Failed to assign ${dateStr}:`, res.status, data);
            throw new Error(`Failed to assign ${dateStr}: ${res.status} ${res.statusText}`);
          }
          console.log(`Assigned ${dateStr}:`, data);
          return data;
        })
        .catch(err => {
          console.error(`Error assigning ${dateStr}:`, err);
          throw err;
        });
        
        assignPromises.push(promise);
        assignments.push({ date: dateStr, dinnerId: dinner.id, promise });
      }
      
      // 5. Wait for all assignments to complete
      console.log('Waiting for all assignments to complete...');
      const results = await Promise.allSettled(assignPromises);
      
      // 6. Check for any real failures (rejections not due to 404 skip)
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('Some assignments failed:', failed);
        throw new Error(`${failed.length} assignments failed. Check console for details.`);
      }
      
      console.log('All assignments completed successfully');
      
      // 7. Refresh assignments
      setReloadAssignments(prev => prev + 1);
      
    } catch (err) {
      console.error('Random assignment error:', err);
      setAssignError('Failed to assign dinners: ' + (err.message || 'Unknown error'));
    } finally {
      setAssigning(false);
    }
  }

  // --- MANUAL ASSIGNMENT FEATURE ---
  function handleDateClick(date) {
    if (forceSingleClick) {
      setForceSingleClick(false);
      return; // Skip range selection for this click
    }
    
    if (!calendarRange) {
      // First click - start new range
      setCalendarRange([date]);
    } else if (calendarRange.length === 1) {
      // Second click - complete range
      const [start] = calendarRange;
      const end = date;
      if (start > end) {
        // If end date is before start, swap them
        setCalendarRange([end, start]);
      } else {
        setCalendarRange([start, end]);
      }
    } else {
      // Third+ click - start new range
      setCalendarRange([date]);
    }
  }

  function handleAssignDinner() {
    if (!calendarRange || !selectedDinnerId) return;
    
    const [start, end = start] = calendarRange;
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Convert to YYYY-MM-DD strings
    const startStr = getDateString(startDate);
    const endStr = getDateString(endDate);
    
    // Generate all dates in range
    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(getDateString(new Date(current)));
      current.setDate(current.getDate() + 1);
    }
    
    // Assign dinner to all dates in range
    setAssigning(true);
    setAssignError(null);
    
    Promise.all(
      dates.map(date => 
        fetch(`${API_BASE}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, dinner_id: selectedDinnerId })
        })
      )
    )
    .then(() => {
      setReloadAssignments(prev => prev + 1); // Trigger refetch
      setCalendarRange(null); // Clear selection
      setAssigning(false);
    })
    .catch(err => {
      setAssignError('Failed to assign dinners: ' + err.message);
      setAssigning(false);
    });
  }

  // --- CLEAR ASSIGNMENTS FEATURE ---
  function handleClearAssignments() {
    if (!calendarRange) return;
    
    const [start, end = start] = calendarRange;
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Generate all dates in range
    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(getDateString(new Date(current)));
      current.setDate(current.getDate() + 1);
    }
    
    setAssigning(true);
    setAssignError(null);
    
    Promise.all(
      dates.map(date => 
        fetch(`${API_BASE}/assignments?date=${date}`, { method: 'DELETE' })
      )
    )
    .then(() => {
      setReloadAssignments(prev => prev + 1); // Trigger refetch
      setCalendarRange(null); // Clear selection
      setAssigning(false);
    })
    .catch(err => {
      setAssignError('Failed to clear assignments: ' + err.message);
      setAssigning(false);
    });
  }

  // --- RENDER FUNCTIONS ---
  function tileContent({ date, view }) {
    if (view !== 'month') return null;
    
    const dateStr = getDateString(date);
    const dinnerName = assignments[dateStr];
    
    return (
      <div className="tile-content">
        {dinnerName && (
          <div className="dinner-assignment">
            {dinnerName}
          </div>
        )}
      </div>
    );
  }

  function tileClassName({ date, view }) {
    if (view !== 'month') return '';
    
    const classes = [];
    const dateStr = getDateString(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Highlight today
    if (date.toDateString() === today.toDateString()) {
      classes.push('today');
    }
    
    // Highlight selected range
    if (calendarRange) {
      const [start, end = start] = calendarRange;
      const current = new Date(date);
      
      if (current >= start && current <= end) {
        classes.push('selected-range');
      }
    }
    
    return classes.join(' ');
  }

  // --- RENDER ---
  return (
    <div className="calendar-container" ref={calendarRef}>
      <div className="calendar-controls">
        <div className="dinner-selector">
          <select 
            value={selectedDinnerId}
            onChange={(e) => setSelectedDinnerId(e.target.value)}
            disabled={!dinners.length}
          >
            <option value="">Select a dinner...</option>
            {dinners.map(dinner => (
              <option key={dinner.id} value={dinner.id}>
                {dinner.name}
              </option>
            ))}
          </select>
          
          <button 
            onClick={handleAssignDinner}
            disabled={!selectedDinnerId || !calendarRange || assigning}
          >
            {assigning ? 'Assigning...' : 'Assign to Selected Dates'}
          </button>
          
          <button 
            onClick={handleClearAssignments}
            disabled={!calendarRange || assigning}
            className="clear-btn"
          >
            {assigning ? 'Clearing...' : 'Clear Assignments'}
          </button>
        </div>
        
        <div className="random-assign">
          <button 
            onClick={handleRandomAssignMonth}
            disabled={!dinners.length || assigning}
          >
            {assigning ? 'Randomizing...' : 'Randomize This Month'}
          </button>
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}
      {assignError && <div className="error">{assignError}</div>}
      
      <div className="calendar-wrapper">
        <Calendar
          key={calendarKey}
          onChange={setDate}
          value={date}
          onClickDay={(value, event) => {
            // Handle single click
            handleDateClick(value);
            
            // If we're forcing single click, prevent range selection
            if (forceSingleClick) {
              setForceSingleClick(false);
              return;
            }
            
            // If this is the first click of a potential range, don't do anything yet
            if (!calendarRange || calendarRange.length === 0) {
              return;
            }
            
            // If this is the second click, handle the range
            if (calendarRange.length === 1) {
              const [start] = calendarRange;
              const end = value;
              if (start > end) {
                setCalendarRange([end, start]);
              } else {
                setCalendarRange([start, end]);
              }
            }
          }}
          onActiveStartDateChange={handleActiveStartDateChange}
          tileContent={tileContent}
          tileClassName={tileClassName}
          selectRange={false} // We handle range selection manually
          view="month"
          minDetail="month"
          maxDetail="month"
          calendarType="US"
          formatShortWeekday={(locale, date) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]}
        />
      </div>
      
      <div className="selection-info">
        {calendarRange && (
          <div>
            <p>Selected range: {calendarRange.map(d => d.toLocaleDateString()).join(' to ')}</p>
            <button onClick={() => {
              setCalendarRange(null);
              setCalendarKey(prev => prev + 1); // Force remount to reset
            }}>
              Clear Range
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Add styles for full-tile drop target and day borders
const style = document.createElement('style');
style.innerHTML = `
  .react-calendar__navigation {
    margin-bottom: 0;
  }
  
  .react-calendar__viewContainer {
    background: white;
  }
  
  .react-calendar__month-view__weekdays {
    text-align: center;
    text-transform: uppercase;
    font-weight: bold;
    font-size: 0.8em;
  }
  
  .react-calendar__month-view__weekdays__weekday {
    padding: 0.5em;
  }
  
  .react-calendar__month-view__weekdays__weekday abbr {
    text-decoration: none;
  }
  
  .react-calendar__month-view__weekdays__weekday--weekend {
    color: #d10000;
  }
  
  .react-calendar__month-view__days__day--weekend {
    color: #d10000;
  }
  
  .react-calendar__tile {
    max-width: 100%;
    text-align: center;
    padding: 0.75em 0.5em;
    background: none;
    border: 1px solid #f0f0f0;
    position: relative;
    height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }
  
  .react-calendar__tile--now {
    background-color: #f8f8f8;
  }
  
  .react-calendar__tile--active,
  .react-calendar__tile--active:enabled:hover,
  .react-calendar__tile--active:enabled:focus {
    background: #e6f7ff;
    color: #000;
  }
  
  .react-calendar__tile--range {
    background: #e6f7ff;
  }
  
  .tile-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
  .dinner-assignment {
    font-size: 0.8em;
    margin-top: 0.5em;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  
  .today {
    background-color: #ffff76 !important;
  }
  
  .selected-range {
    background-color: #e6f7ff !important;
  }
  
  .calendar-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1em;
    font-family: Arial, sans-serif;
  }
  
  .calendar-controls {
    margin-bottom: 1em;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  
  .dinner-selector {
    display: flex;
    gap: 1em;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .dinner-selector select {
    padding: 0.5em;
    min-width: 200px;
  }
  
  .dinner-selector button {
    padding: 0.5em 1em;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .dinner-selector button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
  
  .clear-btn {
    background-color: #f44336 !important;
  }
  
  .random-assign {
    margin-top: 0.5em;
  }
  
  .random-assign button {
    padding: 0.5em 1em;
    background-color: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .random-assign button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
  
  .error {
    color: #f44336;
    margin: 0.5em 0;
    padding: 0.5em;
    background-color: #ffebee;
    border-radius: 4px;
  }
  
  .calendar-wrapper {
    background: white;
    padding: 1em;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .selection-info {
    margin-top: 1em;
    padding: 0.5em;
    background: #f5f5f5;
    border-radius: 4px;
  }
  
  @media print {
    .calendar-controls,
    .selection-info {
      display: none;
    }
    
    .react-calendar__tile {
      height: 120px;
      page-break-inside: avoid;
    }
    
    .react-calendar__month-view__days__day--neighboringMonth {
      visibility: hidden;
    }
  }
`;

document.head.appendChild(style);

export default CalendarComponent;
