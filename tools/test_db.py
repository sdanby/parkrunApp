from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///processing_status.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Define the ProcessingStatus model for tracking processing state
class ProcessingStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(10), nullable=False)
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

def init_db():
    with app.app_context():
        db.create_all()  # Create the database tables

@app.route('/api/start', methods=['POST'])
def start_processing():
    """Set the processing status to 'running'."""
    status_entry = ProcessingStatus.query.first()
    
    if status_entry:
        status_entry.status = 'running'
    else:
        status_entry = ProcessingStatus(status='running')
        db.session.add(status_entry)
    
    db.session.commit()
    return jsonify({'status': 'started'}), 200

@app.route('/api/stop', methods=['POST'])
def stop_processing():
    """Set the processing status to 'stopped'."""
    status_entry = ProcessingStatus.query.first()
    
    if status_entry:
        status_entry.status = 'stopped'
        db.session.commit()
        return jsonify({'status': 'stopped'}), 200
    else:
        return jsonify({'error': 'Status not set'}), 404

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get the current processing status."""
    status_entry = ProcessingStatus.query.first()
    if status_entry:
        return jsonify({'status': status_entry.status}), 200
    else:
        return jsonify({'status': 'not set'}), 404


def main() -> None:
    init_db()
    app.run(debug=True)

if __name__ == '__main__':
    main()