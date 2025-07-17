import React, { useEffect, useState } from 'react';
import Calendar from './components/Calendar';
import DinnerList from './components/DinnerList';
import './App.css';

function App() {
  const [backendMessage, setBackendMessage] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/')
      .then(response => response.json())
      .then(data => setBackendMessage(data.message))
      .catch(error => setBackendMessage('Could not connect to backend'));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh' }}>
      <div style={{ flex: 1, borderRight: '1px solid #ddd', padding: '20px' }}>
        <h2>Dinner List</h2>
        <DinnerList />
      </div>
      <div style={{ flex: 2, padding: '20px' }}>
        <h2>Calendar</h2>
        <Calendar />
        <div style={{ marginTop: '20px', color: 'green' }}>
          Backend says: {backendMessage}
        </div>
      </div>
    </div>
  );
}

export default App;
