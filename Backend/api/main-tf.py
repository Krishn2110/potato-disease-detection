from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from io import BytesIO
import numpy as np
from PIL import Image
import tensorflow as tf
import os
import requests

app = FastAPI()

endpoint = "http://localhost:8501/v1/models/potatoes_model/2:predict"

CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/ping')
async def ping():
    return 'Hello'

def read_file_as_image(data) -> np.ndarray:
    image = Image.open(BytesIO(data)).convert("RGB").resize((256, 256))
    return np.array(image)

@app.post('/predict')
async def predict(
    file: UploadFile = File(...)
):
    image = read_file_as_image(await file.read())
    json_data = {
        "instances": np.expand_dims(image, 0).tolist()
        }
    response = requests.post(endpoint, json=json_data)
    prediction = response.json()["predictions"][0]
    predicted_class = CLASS_NAMES[np.argmax(prediction)]
    confidence = float(np.max(prediction))
    return {
        'predicted_class': predicted_class,
        'confidence': confidence
    }
    

if __name__ == '__main__':
    uvicorn.run(app, host='localhost', port=8000)
