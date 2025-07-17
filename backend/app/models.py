from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Dinner(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    recipe = db.Column(db.Text, nullable=True)
    ingredients = db.Column(db.Text, nullable=True)  # Store as comma-separated for now

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'recipe': self.recipe,
            'ingredients': self.ingredients.split(',') if self.ingredients else []
        }

class DinnerAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(10), nullable=False)  # Format: YYYY-MM-DD
    dinner_id = db.Column(db.Integer, db.ForeignKey('dinner.id'), nullable=False)
    dinner = db.relationship('Dinner', backref='assignments')

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date,
            'dinner': self.dinner.to_dict() if self.dinner else None
        }
