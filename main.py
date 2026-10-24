import joblib
Model = joblib.load('Model.pkl')

from fastapi import FastAPI
app = FastAPI()
@app.get("/")
def greet():
    return "Hello! Welcome to the model prediction service."