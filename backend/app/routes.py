# Placeholder for API endpoints (routes)

from flask import Blueprint, jsonify, request
import os
import sys

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# Now use absolute imports
from app.models import db, Dinner, DinnerAssignment

routes = Blueprint('routes', __name__)

# Database initialization is handled in main.py's create_app()

@routes.route('/dinners', methods=['GET', 'POST'])
def dinners():
    if request.method == 'POST':
        data = request.get_json()
        name = data.get('name', '').strip()
        ingredients = data.get('ingredients', [])
        recipe = data.get('recipe', '')
        if not name:
            return jsonify({'error': 'Name required'}), 400
        dinner = Dinner(name=name, ingredients=','.join(ingredients), recipe=recipe)
        db.session.add(dinner)
        db.session.commit()
        return jsonify(dinner.to_dict()), 201

    # GET: seed if DB is empty, then return all
    dinners = Dinner.query.all()
    if not dinners:
        example_dinners = [
            Dinner(name="Spaghetti Bolognese", ingredients="spaghetti,ground beef,tomato sauce,onion,garlic,olive oil,salt,pepper", recipe="1. Cook spaghetti according to package.\n2. Brown beef with onion and garlic.\n3. Add tomato sauce, simmer.\n4. Serve over spaghetti."),
            Dinner(name="Chicken Stir Fry", ingredients="chicken breast,broccoli,carrot,soy sauce,ginger,garlic,vegetable oil", recipe="1. Slice chicken and veggies.\n2. Stir fry chicken, then veggies.\n3. Add soy sauce, ginger, garlic.\n4. Toss together and serve."),
            Dinner(name="Tacos", ingredients="ground beef,taco shells,lettuce,tomato,cheddar cheese,taco seasoning,sour cream", recipe="1. Cook beef with taco seasoning.\n2. Fill shells with beef and toppings.\n3. Serve with sour cream."),
            Dinner(name="Veggie Curry", ingredients="potato,carrot,peas,coconut milk,curry paste,onion,garlic,ginger", recipe="1. Sauté onion, garlic, ginger.\n2. Add veggies and curry paste.\n3. Pour in coconut milk, simmer.\n4. Serve with rice."),
            Dinner(name="Salmon & Rice Bowl", ingredients="salmon fillet,rice,avocado,cucumber,soy sauce,sesame seeds", recipe="1. Cook rice.\n2. Sear salmon.\n3. Assemble bowl with toppings.\n4. Drizzle with soy sauce."),
        ]
        db.session.add_all(example_dinners)
        db.session.commit()
        dinners = Dinner.query.all()
    return jsonify([d.to_dict() for d in dinners])

@routes.route('/dinners/<int:dinner_id>', methods=['PUT'])
def update_dinner(dinner_id):
    dinner = Dinner.query.get_or_404(dinner_id)
    data = request.get_json()
    dinner.name = data.get('name', dinner.name)
    dinner.ingredients = ','.join(data.get('ingredients', dinner.ingredients.split(',')))
    dinner.recipe = data.get('recipe', dinner.recipe)
    db.session.commit()
    return jsonify(dinner.to_dict())

@routes.route('/dinners/<int:dinner_id>', methods=['DELETE'])
def delete_dinner(dinner_id):
    try:
        # First delete any assignments that reference this dinner
        DinnerAssignment.query.filter_by(dinner_id=dinner_id).delete()
        
        # Then delete the dinner
        dinner = Dinner.query.get_or_404(dinner_id)
        db.session.delete(dinner)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Dinner and its assignments successfully deleted'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to delete dinner: {str(e)}'
        }), 500

@routes.route('/assignments', methods=['GET'])
def get_assignments():
    date = request.args.get('date')
    month = request.args.get('month')
    
    if date:
        # Get assignment for specific date
        assignment = DinnerAssignment.query.filter_by(date=date).first()
        if assignment:
            return jsonify(assignment.to_dict())
        return jsonify(None)
    elif month:
        # Get all assignments for a month (format: YYYY-MM)
        assignments = DinnerAssignment.query.filter(
            DinnerAssignment.date.like(f"{month}-%")
        ).all()
        return jsonify([a.to_dict() for a in assignments])
    else:
        return jsonify({'error': 'Must provide either date or month parameter'}), 400

@routes.route('/assignments/all', methods=['GET'])
def get_all_assignments():
    # Debug endpoint to list all assignments
    assignments = DinnerAssignment.query.all()
    return jsonify([{
        'id': a.id,
        'date': a.date,
        'dinner_id': a.dinner_id,
        'dinner_name': a.dinner.name if a.dinner else None
    } for a in assignments])

@routes.route('/assignments/clear', methods=['POST'])
def clear_assignments():
    try:
        # Delete all assignments
        num_deleted = DinnerAssignment.query.delete()
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Successfully cleared {num_deleted} assignments',
            'count': num_deleted
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to clear assignments: {str(e)}'
        }), 500
