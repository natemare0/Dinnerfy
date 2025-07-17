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
      const dinnersResp = await fetch('http://localhost:5000/dinners');
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
          fetch('http://localhost:5000/assignments', {
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
      const dinnersResp = await fetch('http://localhost:5000/dinners');
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
          fetch('http://localhost:5000/assignments', {
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
    fetch('http://localhost:5000/assignments', {
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
      // Full-tile drop area, day number top-left, dinner centered at bottom
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
            borderRadius: 0,
            zIndex: 2,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: 6
          }}
        >
          <span className="dinnerfy-day-number">{date.getDate()}</span>
          <span style={{ flex: 1 }}></span>
          {dinnerName && <span className="dinnerfy-dinner-name dinnerfy-dinner-center">{dinnerName}</span>}
        </div>
      );
    }
    return null;
  }

  // Assignment handler
  function handleAssignDinner() {
    if (!selectedDinnerId) return;
    setAssigning(true);
    setAssignError(null);
    fetch('http://localhost:5000/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: getDateString(date), dinner_id: selectedDinnerId })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to assign dinner');
        return res.json();
      })
      .then(() => {
        // Refresh assignments without reload
        setReloadAssignments(r => r + 1);
        setAssigning(false);
        setSelectedDinnerId('');
      })
      .catch(err => {
        setAssignError(err.message);
        setAssigning(false);
      });
  }

  return (
    <div ref={calendarRef}>
      <Calendar
        key={calendarKey}
        selectRange={!forceSingleClick}
        value={forceSingleClick ? null : (calendarRange ? calendarRange : date)}
        onChange={val => {
          if (Array.isArray(val) && val[0] && val[1] && val[0].getTime() !== val[1].getTime()) {
            // Only set range if user actually drags/selects more than one day
            setCalendarRange([val[0], val[1]]);
            setDate(val[0]);
          } else if (val instanceof Date) {
            // Single click: always select just that day
            setCalendarRange([val, val]);
            setDate(new Date(val));
          }
        }}
        onClickDay={day => {
          setCalendarRange([day, day]);
          setDate(new Date(day));
          if (forceSingleClick) setForceSingleClick(false);
        }}
        // Always reset selection when month changes
        onActiveStartDateChange={({ activeStartDate }) => {
          setActiveMonth(getMonthString(activeStartDate));
          setCalendarRange(null);
          setDate(activeStartDate);
        }}
        value={calendarRange ? calendarRange : date}
        selectRange={true}
        tileContent={tileContent}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return undefined;
          let highlight = false;
          if (calendarRange && Array.isArray(calendarRange)) {
            const [start, end] = calendarRange;
            if (start && end) {
              // Full range selected
              highlight = date >= start && date <= end;
            } else if (start && !end) {
              // Partial range (dragging)
              highlight = date.getTime() === start.getTime();
            }
          }
          return highlight ? 'dinnerfy-calendar-day dinnerfy-range-highlight' : 'dinnerfy-calendar-day';
        }}
        formatDay={() => ''} // Hide default day number
      />
      <div style={{ marginTop: '20px' }}>
        Selected date: {date.toDateString()}
      </div>
      <div style={{ marginTop: '10px' }}>
        <label htmlFor="dinner-select">Assign a dinner to this date: </label>
        <div style={{ marginTop: '20px' }}>
        <button onClick={handleRandomAssignMonth} disabled={assigning || !dinners.length} style={{ fontWeight: 600, marginBottom: 12 }}>
          {assigning ? 'Assigning...' : 'Randomly Assign Dinners for Month'}
        </button>
        <button
          onClick={async () => {
            if (!window.confirm('Clear all dinner assignments for this month?')) return;
            try {
              await fetch('http://localhost:5000/api/assignments/clear', { method: 'POST' });
              setReloadAssignments(r => r + 1);
              setCalendarRange(null);
              setForceSingleClick(true);
              setTimeout(() => setCalendarKey(k => k + 1), 0); // delay remount until after click
            } catch (err) {
              alert('Failed to clear assignments.');
            }
          }}
          style={{ fontWeight: 600, marginLeft: 12, background: '#ffeaea', color: '#c62828', borderColor: '#c62828' }}
        >
          Clear All Assignments
        </button>
        {/* Calendar-based range selector for random assignment */}
        {calendarRange && Array.isArray(calendarRange) && calendarRange[0] && calendarRange[1] && calendarRange[0].getTime() !== calendarRange[1].getTime() && (
          <div style={{ margin: '18px 0', padding: '10px 0', borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
            <strong>Randomly Assign Dinners for Selected Range:</strong>
            <br />
            <span>
              {calendarRange[0].toLocaleDateString()} – {calendarRange[1].toLocaleDateString()}
            </span>
            <button
              onClick={async () => {
                await handleRandomAssignRange(calendarRange[0], calendarRange[1]);
                setCalendarRange(null); // Remove highlight after assignment
              }}
              disabled={assigning || !calendarRange[0] || !calendarRange[1] || !dinners.length}
              style={{ fontWeight: 600, marginLeft: 16 }}
            >
              {assigning ? 'Assigning...' : 'Randomly Assign Range'}
            </button>
            <button onClick={() => {
  setCalendarRange(null);
  setForceSingleClick(true);
  setTimeout(() => setCalendarKey(k => k + 1), 0); // delay remount until after click
}} style={{ marginLeft: 8 }}>Clear Range</button>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          Selected date: {date.toDateString()}
          <br />
          <select value={selectedDinnerId} onChange={e => setSelectedDinnerId(e.target.value)} style={{ marginRight: 8 }}>
            <option value=''>-- Select Dinner --</option>
            {dinners.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={handleAssignDinner} disabled={!selectedDinnerId || assigning}>Assign to selected date</button>
        </div>
        {assignError && <span style={{ color: 'red', marginLeft: 8 }}>{assignError}</span>}
      </div>
        {loading && <div>Loading assignments...</div>}
        {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      </div>
    </div>
  );
}

// Add styles for full-tile drop target and day borders
const style = document.createElement('style');
style.innerHTML = `
  .react-calendar__navigation {
    margin-bottom: 8px;
    background: #fff !important;
    color: #111 !important;
    border: none !important;
    box-shadow: none !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
  }
  .react-calendar__navigation__label {
    flex: 1 1 100%;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
  }
  .react-calendar__navigation__label, .react-calendar__navigation__label > span, .react-calendar__navigation__label > button {
    font-size: 1.1em !important;
    font-weight: 700 !important;
    background: #fff !important;
    color: #111 !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 8px !important;
  }
  .dinnerfy-calendar-day {
    position: relative !important;
    border: 1px solid #222 !important;
    box-sizing: border-box !important;
    min-height: 120px;
    min-width: 120px;
    background: #fff;
    font-size: 1.1em;
    padding: 0;
    overflow: visible !important;
  }
  .react-calendar {
    margin: 0 auto !important;
    display: block !important;
    background: #fff !important;
    border: none !important;
    box-shadow: none !important;
    width: auto !important;
    max-width: 100vw !important;
  }
  .react-calendar__tile {
    overflow: visible !important;
    height: 120px !important;
    width: 120px !important;
    max-width: 100% !important;
    max-height: 100% !important;
    padding: 0 !important;
    background: #fff !important;
    vertical-align: top !important;
    box-sizing: border-box !important;
  }
  .react-calendar__month-view__days {
    display: grid !important;
    grid-template-columns: repeat(7, 120px) !important;
    grid-auto-rows: 120px !important;
    gap: 0 !important;
    min-height: 840px !important;
    min-width: 840px !important;
    background: #fff !important;
  }
  .react-calendar__month-view__weekdays {
    font-size: 1.1em;
    display: grid !important;
    grid-template-columns: repeat(7, 120px) !important;
    background: #fff !important;
    color: #111 !important;
  }
  .dinnerfy-day-number {
    font-size: 0.8em !important;
    color: #111;
    font-weight: 700;
    position: absolute;
    left: 6px;
    top: 4px;
    z-index: 3;
    background: none !important;
    margin: 0;
    padding: 0;
  }
  .dinnerfy-dinner-name {
    font-size: 0.95em !important;
    font-weight: 500;
    color: #1976d2;
    margin-bottom: 4px;
    margin-left: 2px;
    margin-right: 2px;
    background: rgba(255,255,255,0.85);
    border-radius: 2px;
    display: block;
    max-width: 100px;
    overflow-wrap: break-word;
    word-break: break-word;
    text-align: center;
    align-self: center;
  }
  .dinnerfy-dinner-center {
    align-self: center !important;
    justify-self: flex-end !important;
    text-align: center !important;
    width: 100%;
  }
  @media print {
    body, html {
      background: #fff !important;
    }
    .react-calendar {
      box-shadow: none !important;
      border: none !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: 100vw !important;
      margin: 0 auto !important;
      display: block !important;
      background: #fff !important;
    }
    .react-calendar__tile, .dinnerfy-calendar-day {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      background: #fff !important;
      color: #000 !important;
      border: 1px solid #222 !important;
    }
    .react-calendar__month-view__days {
      min-height: 840px !important;
      min-width: 840px !important;
      display: grid !important;
      grid-template-columns: repeat(7, 120px) !important;
      grid-auto-rows: 120px !important;
      gap: 0 !important;
      background: #fff !important;
    }
    .react-calendar__month-view__weekdays {
      color: #000 !important;
      background: #fff !important;
      font-size: 1.25em !important;
      display: grid !important;
      grid-template-columns: repeat(7, 120px) !important;
    }
    .react-calendar__navigation button {
      display: none !important;
    }
  }
`;
document.head.appendChild(style);

export default CalendarComponent;

