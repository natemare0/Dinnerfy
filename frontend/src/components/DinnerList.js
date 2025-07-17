import React, { useEffect, useState } from 'react';
import RecipeCard from './RecipeCard';
import './RecipeCard.css';

function DinnerList() {
  const [dinners, setDinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDinner, setSelectedDinner] = useState(null);
  const [showRecipeCard, setShowRecipeCard] = useState(false);
  const [editMode, setEditMode] = useState(false);

  function fetchDinners() {
    setLoading(true);
    fetch('http://localhost:5000/api/dinners')
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch');
        return response.json();
      })
      .then(data => {
        setDinners(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchDinners();
  }, []);

  function handleOpenRecipe(dinner, edit = false) {
    // Only open with a valid dinner object (with id) for existing dinners
    let found = null;
    if (dinner && dinner.id) {
      found = dinners.find(d => d.id === dinner.id);
      if (!found) return; // don't open blank card if not found
    } else if (edit) {
      found = {}; // for new dinner
    } else {
      return; // don't open blank card for non-existent dinner
    }
    setSelectedDinner(found);
    setShowRecipeCard(true);
    setEditMode(edit);
  }

  function handleCloseRecipe() {
    setShowRecipeCard(false);
    setSelectedDinner(null);
    setEditMode(false);
  }

  async function handleSaveRecipe(updated) {
    try {
      let resp, data;
      if (updated.id) {
        resp = await fetch(`http://localhost:5000/api/dinners/${updated.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updated.name,
            ingredients: updated.ingredients,
            recipe: updated.recipe
          })
        });
      } else {
        resp = await fetch('http://localhost:5000/api/dinners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updated.name,
            ingredients: updated.ingredients,
            recipe: updated.recipe
          })
        });
      }
      data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');
      fetchDinners(); // reload from backend
      handleCloseRecipe();
    } catch (err) {
      alert('Failed to save dinner: ' + err.message);
    }
  }

  async function handleDeleteDinner(id) {
    if (!window.confirm('Delete this dinner? This cannot be undone.')) return;
    try {
      const resp = await fetch(`http://localhost:5000/api/dinners/${id}`, {
        method: 'DELETE'
      });
      const data = await resp.json();
      
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Delete failed');
      }
      
      // Success case
      fetchDinners();
      handleCloseRecipe();
      alert('Dinner successfully deleted');
    } catch (err) {
      alert('Failed to delete dinner: ' + (err.message || 'Network error'));
      console.error('Delete error:', err);
    }
  }

  if (loading) return <div>Loading dinners...</div>;
  if (error) return <div style={{color: 'red'}}>Error: {error}</div>;

  return (
    <div>
      <button
        style={{ width: '100%', marginBottom: 12, padding: 8, fontWeight: 600, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        onClick={() => handleOpenRecipe({}, true)}
      >
        + Add Dinner
      </button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {dinners.map(dinner => (
          <li
            key={dinner.id}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('text/plain', dinner.id);
            }}
            onClick={() => handleOpenRecipe(dinner, false)}
            style={{ cursor: 'pointer', border: '1px solid #ccc', marginBottom: 8, padding: 10, borderRadius: 4, background: '#f7faff', fontWeight: 500 }}
            title="Click to view recipe, or drag to calendar"
          >
            {dinner.name}
          </li>
        ))}
      </ul>
      <RecipeCard
        dinner={selectedDinner}
        open={showRecipeCard}
        onClose={handleCloseRecipe}
        onSave={handleSaveRecipe}
        onDelete={handleDeleteDinner}
        editable={editMode}
      />
    </div>
  );
}

export default DinnerList;

