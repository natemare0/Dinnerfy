import React, { useState } from 'react';
import './RecipeCard.css';

function RecipeCard({ dinner, open, onClose, onSave, onDelete, editable }) {
  const [editMode, setEditMode] = useState(editable || false);
  const [name, setName] = useState(dinner?.name || '');
  const [ingredients, setIngredients] = useState(dinner?.ingredients ? [...dinner.ingredients] : []);
  const [newIngredient, setNewIngredient] = useState('');
  const [recipe, setRecipe] = useState(dinner?.recipe || '');

  // Always sync state with dinner prop
  React.useEffect(() => {
    setName(dinner?.name || '');
    setIngredients(dinner?.ingredients ? [...dinner.ingredients] : []);
    setRecipe(dinner?.recipe || '');
    setEditMode(editable || false);
  }, [dinner, editable]);

  if (!open) return null;

  function handleAddIngredient() {
    if (newIngredient.trim()) {
      setIngredients([...ingredients, newIngredient.trim()]);
      setNewIngredient('');
    }
  }
  function handleRemoveIngredient(idx) {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  }
  function handleSave() {
    onSave({ ...dinner, name, ingredients, recipe });
    setEditMode(false);
  }
  function handleCancel() {
    setEditMode(false);
    setName(dinner?.name || '');
    setIngredients(dinner?.ingredients ? [...dinner.ingredients] : []);
    setRecipe(dinner?.recipe || '');
  }

  return (
    <div className="recipecard-modal-bg">
      <div className="recipecard-modal">
        <button className="recipecard-close" onClick={onClose}>×</button>
        {editMode ? (
          <>
            <input
              className="recipecard-title-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Dinner Name"
              autoFocus
            />
            <div className="recipecard-section">
              <strong>Ingredients</strong>
              <ul>
                {ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing}
                    <button onClick={() => handleRemoveIngredient(i)} className="recipecard-remove">Remove</button>
                  </li>
                ))}
              </ul>
              <input
                className="recipecard-ing-input"
                value={newIngredient}
                onChange={e => setNewIngredient(e.target.value)}
                placeholder="Add ingredient"
                onKeyDown={e => { if (e.key === 'Enter') handleAddIngredient(); }}
              />
              <button onClick={handleAddIngredient} className="recipecard-add">Add</button>
            </div>
            <div className="recipecard-section">
              <strong>Instructions</strong>
              <textarea
                className="recipecard-recipe-input"
                value={recipe}
                onChange={e => setRecipe(e.target.value)}
                placeholder="Instructions (plain text, paragraphs supported)"
                rows={8}
              />
            </div>
            <div className="recipecard-actions">
              <button onClick={handleSave} className="recipecard-save">Save</button>
              <button onClick={handleCancel} className="recipecard-cancel">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="recipecard-title">{name}</h2>
            <div className="recipecard-section">
              <strong>Ingredients</strong>
              <ul>
                {ingredients.map((ing, i) => (
                  <li key={i}>{ing}</li>
                ))}
              </ul>
            </div>
            <div className="recipecard-section">
              <strong>Instructions</strong>
              <pre className="recipecard-recipe">{recipe}</pre>
            </div>
            <div className="recipecard-actions">
              <button onClick={() => setEditMode(true)} className="recipecard-edit">Edit</button>
              {dinner && dinner.id && (
                <button onClick={() => onDelete && onDelete(dinner.id)} className="recipecard-delete" style={{marginLeft:8, background:'#ffeaea', color:'#c62828', borderColor:'#c62828'}}>Delete</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RecipeCard;
