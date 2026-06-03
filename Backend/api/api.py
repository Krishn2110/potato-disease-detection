from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from io import BytesIO
import numpy as np
from PIL import Image
import tensorflow as tf
import os

app = FastAPI()
MODEL_PATH = os.path.join(os.path.dirname(__file__), '../saved_models/1')
MODEL = tf.keras.models.load_model(MODEL_PATH)

CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/')
async def root():
    return {
        "status": "ok",
        "message": "Potato disease detection API is running",
        "predict_endpoint": "/predict"
    }

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
    img_batch = np.expand_dims(image, 0)
    predictions = MODEL.predict(img_batch)
    predicted_class = CLASS_NAMES[np.argmax(predictions[0])]
    confidence = np.max(predictions[0])
    print(predicted_class, confidence)
    return {
        "predicted_class": predicted_class,
        "confidence": float(confidence)
    }

if __name__ == '__main__':
    uvicorn.run(app, host='localhost', port=8000)
