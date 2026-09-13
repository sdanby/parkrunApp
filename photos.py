import os
import random
from flask import Flask, render_template, jsonify, send_from_directory

app = Flask(__name__)

# Directory containing images
IMAGE_DIR = r"C:\Users\stevi\OneDrive\Pictures\WPW"

# Route to serve the HTML page
@app.route('/')
def index():
    return render_template('index.html')

# Route to serve the images
@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMAGE_DIR, filename)

# Route to get the list of images
@app.route('/api/images')
def get_images():
    image_files = [f for f in os.listdir(IMAGE_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
    return jsonify(image_files)

if __name__ == '__main__':
    app.run(debug=True)