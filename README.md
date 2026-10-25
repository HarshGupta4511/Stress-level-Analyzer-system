# Mindful Metrics: Mental Health Score Prediction

A machine learning web application that predicts mental health scores using a trained Random Forest regression pipeline, FastAPI, and vanilla HTML, CSS, and JavaScript.

## Live Demo

- **Frontend Application:** [Launch Mindful Metrics](https://stress-level-analyzer-system-frontend.onrender.com/)
- **Backend API:** [Open FastAPI Backend](https://stress-level-analyzer-system.onrender.com)
- **API Documentation:** [Explore API Docs](https://stress-level-analyzer-system.onrender.com/docs)
- **Health Check:** [Check Backend Status](https://stress-level-analyzer-system.onrender.com/api/health)

Complete the assessment form in the frontend to receive a prediction from the deployed machine learning model.

> **Note:** The application is for educational purposes only. Its predictions are not a medical diagnosis or a substitute for professional medical advice.

## Features

- Predicts a continuous mental health score using a trained machine learning model.
- FastAPI backend for prediction requests.
- Responsive frontend built with vanilla HTML, CSS, and JavaScript.
- Input validation and error handling.
- Preprocessing handled by the existing scikit-learn pipeline.
- Deployed frontend and backend on Render.

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Python, FastAPI, Uvicorn
- **Machine Learning:** scikit-learn, Random Forest Regressor
- **Model Artifact:** `Model.pkl`
- **Deployment:** Render

## Project Structure

```text
mental-health-app/
├── main.py
├── Model.pkl
├── requirements.txt
├── README.md
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

The exact structure may vary slightly depending on the deployment configuration. Keep `Model.pkl` in the location expected by `main.py`.

## How It Works

1. The user completes the assessment form in the frontend.
2. The frontend sends the submitted values to the FastAPI prediction endpoint.
3. The backend validates the input and passes the raw feature values to the trained scikit-learn pipeline.
4. The pipeline performs its configured preprocessing and generates a regression prediction.
5. The frontend displays the returned predicted score.

The model predicts a continuous numerical value. The score's scale and clinical interpretation should not be assumed unless supported by the dataset documentation.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Checks backend and model status |
| `POST` | `/api/predict` | Returns a predicted mental health score and country group |

Interactive API documentation is available at [`/docs`](https://stress-level-analyzer-system.onrender.com/docs).

Invalid requests may return HTTP `422` with validation details. The application also validates that study, physical activity, and sleep hours do not exceed 24 hours in total.

## Run Locally on Windows

### 1. Requirements

- Python 3.10 or newer
- The project files, including `Model.pkl`

### 2. Open the project folder

In PowerShell, navigate to the directory containing `main.py`:

```powershell
cd path\to\mental-health-app
```

### 3. Create and activate a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks environment activation, run this command in PowerShell and then activate the environment again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 4. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

The model was saved with scikit-learn `1.7.2`. Use the version specified in `requirements.txt` to help maintain compatibility with the saved model.

### 5. Start the backend

```powershell
uvicorn main:app --reload
```

Open the application at:

- Frontend: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

These local URLs assume that `main.py` is configured to serve the frontend from the root URL.

## Test the Health Endpoint

With the backend running, open a second PowerShell window and run:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

A healthy response should report `status: ok` and `model_loaded: True`.

## Test a Prediction from PowerShell

The following example sends sample inputs to the local prediction endpoint. Adjust the values to match the options supported by your application.

```powershell
$body = @{
    Age = 20
    Gender = "Female"
    Country = "India"
    Academic_Level = "Undergraduate"
    Most_Used_Platform = "Instagram"
    Purpose_Of_Use = "Entertainment"
    Avg_Daily_Usage_Hours = 5
    Daily_Unlocks = 80
    Study_Hours = 4
    Physical_Activity_Hours = 1
    Sleep_Hours_Per_Night = 7
    Stress_Level = "Medium"
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri http://127.0.0.1:8000/api/predict `
    -ContentType "application/json" `
    -Body $body
```

The response should contain the predicted score and country group, according to the backend's response schema.

## Troubleshooting

- **`model_loaded: False`:** Confirm that `Model.pkl` is in the expected location and that the installed scikit-learn version matches the project's requirements.
- **Port already in use:** Start the server on another port with `uvicorn main:app --reload --port 8001`. Ensure the frontend uses the matching backend URL if required.
- **Frontend cannot reach the backend:** Confirm that the backend is running and that the frontend API base URL, CORS configuration, and port are correct.
- **First request takes time on Render:** A free service may need time to wake up after inactivity. Retry once the service responds.
- **HTTP 422 validation error:** Check the submitted field names, data types, allowed categorical values, and hour constraints.

## Limitations

- The application returns the model's numerical prediction; it does not establish a clinical diagnosis.
- The model's performance metrics and score interpretation should only be reported when supported by reliable evaluation results and dataset documentation.
- Predictions depend on the quality and scope of the data used to train the model.

## Disclaimer

**Mindful Metrics is an educational machine learning project. It is not a medical device and must not be used to diagnose, treat, or manage a mental health condition.** If you have concerns about your mental health, consult a qualified healthcare professional.
