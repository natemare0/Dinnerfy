// Create a copy of the original file with all API endpoints updated
import React, { useState, useEffect } from 'react';
import './Calendar.css';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function getMonthString(date) {
  // Returns YYYY-MM for a JS Date
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function getDateString(date) {
  // Returns YYYY-MM-DD for a JS Date
  return date.getFullYear() + '-' + 
         String(date.getMonth() + 1).padStart(2, '0') + 
         '-' + 
         String(date.getDate()).padStart(2, '0');
}

function CalendarComponent() {
  const [calendarRange, setCalendarRange] = useState(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const [forceSingleClick, setForceSingleClick] = useState(false);

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
    fetch(`http://localhost:5000/api/assignments?month=${activeMonth}`)
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
    fetch('http://localhost:5000/api/dinners')
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
    setAssigning(true);
    setAssignError(null);
    try {
      // Always fetch latest dinners before random assignment
      const dinnersResp = await fetch('http://localhost:5000/api/dinners');
      const latestDinners = await dinnersResp.json();
      if (!latestDinners.length) throw new Error('No dinners available');
      const [year, month] = activeMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      let shuffled = [...latestDinners];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      let assignPromises = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dinner = shuffled[(d - 1) % shuffled.length];
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        assignPromises.push(
          fetch('http://localhost:5000/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, dinner_id: dinner.id })
          })
        );
      }
      await Promise.all(assignPromises);
      setReloadAssignments(r => r + 1);
    } catch (err) {
      setAssignError('Random assignment failed');
    }
    setAssigning(false);
  }

  async function handleRandomAssignRange(start, end) {
    setAssigning(true);
    setAssignError(null);
    try {
      // Always fetch latest dinners before random assignment
      const dinnersResp = await fetch('http://localhost:5000/api/dinners');
      const latestDinners = await dinnersResp.json();
      if (!latestDinners.length || !start || !end) throw new Error('No dinners available');
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate < startDate) throw new Error('End date must be after start date');
      let dates = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      let shuffled = [...latestDinners];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      let assignPromises = [];
      for (let i = 0; i < dates.length; i++) {
        const dinner = shuffled[i % shuffled.length];
        const dateStr = getDateString(dates[i]);
        assignPromises.push(
          fetch('http://localhost:5000/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, dinner_id: dinner.id })
          })
        );
      }
      await Promise.all(assignPromises);
      setReloadAssignments(r => r + 1);
    } catch (err) {
      setAssignError('Random assignment failed: ' + err.message);
    }
    setAssigning(false);
  }

  // Render dinner name on each day if assigned
  // Drag-and-drop handlers
  const [dragOverDate, setDragOverDate] = useState(null);

  function handleDrop(date, e) {
    e.preventDefault();
    setDragOverDate(null);
    const dinnerId = e.dataTransfer.getData('text/plain');
    if (!dinnerId) return;
    setAssigning(true);
    setAssignError(null);
    fetch('http://localhost:5000/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: getDateString(date), dinner_id: dinnerId })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to assign dinner');
        return res.json();
      })
      .then(() => {
        setReloadAssignments(r => r + 1);
        setAssigning(false);
        setSelectedDinnerId('');
      })
      .catch(err => {
        setAssignError(err.message);
        setAssigning(false);
      });
  }

  function tileContent({ date, view }) {
    if (view === 'month') {
      const dinnerName = assignments[getDateString(date)];
      const isDragOver = dragOverDate && getDateString(date) === getDateString(dragOverDate);
      return (
        <div
          onDragOver={e => { e.preventDefault(); setDragOverDate(date); }}
          onDragLeave={() => setDragOverDate(null)}
          onDrop={e => handleDrop(date, e)}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            background: isDragOver ? '#e3f2fd' : 'transparent',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2px',
            boxSizing: 'border-box',
            cursor: 'pointer'
          }}
        >
          <div style={{ textAlign: 'left', fontSize: '0.8em' }}>
            {date.getDate()}
          </div>
          {dinnerName && (
            <div style={{
              textAlign: 'center',
              fontSize: '0.7em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
              marginTop: 'auto',
              marginBottom: '2px'
            }}>
              {dinnerName}
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  function handleDateClick(date) {
    if (forceSingleClick) {
      setForceSingleClick(false);
      setCalendarRange([date]);
      return;
    }
    
    setDate(date);
    setCalendarRange(prev => {
      if (!prev || prev.length === 2) {
        return [date];
      } else {
        const [start] = prev;
        if (date < start) {
          return [date, start];
        } else {
          return [start, date];
        }
      }
    });
  }

  function handleClearRange() {
    setCalendarRange(null);
    setForceSingleClick(true);
  }

  function handleAssignDinner() {
    if (!calendarRange || !calendarRange[0] || !selectedDinnerId) return;
    
    setAssigning(true);
    setAssignError(null);
    
    const [start, end = start] = calendarRange;
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (startDate > endDate) {
      setAssignError('End date must be after start date');
      setAssigning(false);
      return;
    }
    
    const dates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    
    Promise.all(dates.map(date => 
      fetch('http://localhost:5000/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: getDateString(date), 
          dinner_id: selectedDinnerId 
        })
      })
    ))
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(() => {
      setReloadAssignments(r => r + 1);
      setCalendarRange(null);
      setSelectedDinnerId('');
      setAssigning(false);
    })
    .catch(err => {
      setAssignError('Failed to assign dinner: ' + err.message);
      setAssigning(false);
    });
  }

  function handleClearAssignments() {
    if (!window.confirm('Clear all dinner assignments for this month?')) return;
    
    fetch('http://localhost:5000/api/assignments/clear', { 
      method: 'POST' 
    })
      .then(res => res.json())
      .then(() => {
        setReloadAssignments(r => r + 1);
        setCalendarRange(null);
      })
      .catch(err => {
        console.error('Failed to clear assignments:', err);
      });
  }

  return (
    <div className="calendar-container">
      <div style={{ marginBottom: '20px' }}>
        <h2>Dinner Calendar</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={handleRandomAssignMonth}
            disabled={assigning}
            style={{ padding: '5px 10px' }}
          >
            {assigning ? 'Assigning...' : 'Randomize This Month'}
          </button>
          
          <button 
            onClick={() => calendarRange && calendarRange.length === 2 ? 
              handleRandomAssignRange(calendarRange[0], calendarRange[1]) : 
              alert('Please select a date range first')
            }
            disabled={assigning || !calendarRange || calendarRange.length !== 2}
            style={{ padding: '5px 10px' }}
          >
            {assigning ? 'Assigning...' : 'Randomize Selected Range'}
          </button>
          
          <button 
            onClick={handleClearAssignments}
            disabled={assigning}
            style={{ padding: '5px 10px' }}
          >
            Clear All Assignments
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
          <select
            value={selectedDinnerId}
            onChange={(e) => setSelectedDinnerId(e.target.value)}
            style={{ padding: '5px', minWidth: '150px' }}
          >
            <option value="">Select a dinner</option>
            {dinners.map(dinner => (
              <option key={dinner.id} value={dinner.id}>
                {dinner.name}
              </option>
            ))}
          </select>
          
          <button 
            onClick={handleAssignDinner}
            disabled={!selectedDinnerId || !calendarRange || calendarRange.length === 0 || assigning}
            style={{ padding: '5px 10px' }}
          >
            {assigning ? 'Assigning...' : 'Assign Selected'}
          </button>
          
          <button 
            onClick={handleClearRange}
            disabled={!calendarRange || calendarRange.length === 0}
            style={{ padding: '5px 10px' }}
          >
            Clear Selection
          </button>
        </div>
        
        {assignError && (
          <div style={{ color: 'red', marginTop: '10px' }}>
            Error: {assignError}
          </div>
        )}
      </div>

      <div ref={calendarRef} style={{ maxWidth: '100%', margin: '0 auto' }}>
        <Calendar
          key={calendarKey}
          onChange={setDate}
          onClickDay={handleDateClick}
          value={date}
          tileContent={tileContent}
          onActiveStartDateChange={handleActiveStartDateChange}
          selectRange={true}
          returnValue="range"
          tileClassName={({ date, view }) => {
            if (view !== 'month') return null;
            const dateStr = getDateString(date);
            const isSelected = calendarRange && calendarRange.some(d => getDateString(d) === dateStr);
            return isSelected ? 'selected-date' : null;
          }}
          className="dinner-calendar"
        />
      </div>
      
      {loading && <div>Loading assignments...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}

// Add styles for full-tile drop target and day borders
const style = document.createElement('style');
style.innerHTML = `
  .react-calendar__navigation {
    display: flex;
    margin-bottom: 1em;
  }
  
  .react-calendar__navigation button {
    min-width: 44px;
    background: none;
    border: 0;
    font-size: 1em;
    margin: 0 2px;
    cursor: pointer;
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
    border: 1px solid #e0e0e0;
    position: relative;
    height: 80px;
    overflow: hidden;
  }
  
  .react-calendar__tile--now {
    background: #ffff76;
  }
  
  .react-calendar__tile--active {
    background: #006edc;
    color: white;
  }
  
  .react-calendar__tile--hasActive {
    background: #76baff;
  }
  
  .react-calendar__tile--range {
    background: #e6f2ff;
  }
  
  .selected-date {
    background-color: #e6f2ff !important;
  }
  
  .dinner-calendar {
    width: 100%;
    max-width: 100%;
    font-size: 14px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  @media print {
    .dinner-calendar {
      border: none;
      box-shadow: none;
      padding: 0;
    }
    
    .react-calendar__navigation,
    .react-calendar__navigation ~ div > div:first-child {
      display: none;
    }
    
    .react-calendar__tile {
      height: 100px;
      page-break-inside: avoid;
    }
    
    .react-calendar__month-view__days__day--neighboringMonth {
      visibility: hidden;
    }
  }
`;

document.head.appendChild(style);

export default CalendarComponent;
