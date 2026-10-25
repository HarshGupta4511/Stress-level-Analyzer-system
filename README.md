# Mindful Metrics: Mental Health Score Prediction

A FastAPI + vanilla HTML/CSS/JS app around your existing `Model.pkl`.

## Project layout

```
mental-health-app/
├── main.py
├── Model.pkl            <- your existing model (copy it here, unchanged)
├── requirements.txt
├── README.md
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## About the model (inspected from your Model.pkl)

- A scikit-learn `Pipeline`: `ColumnTransformer` preprocessor + `RandomForestRegressor` (150 trees).
- **Regression**: it outputs one continuous number.
- The pipeline already does all preprocessing (log1p + scaling, ordinal Stress_Level, one-hot encoding), so `main.py` passes raw values and never preprocesses twice.
- It was saved with scikit-learn **1.7.2**, so `requirements.txt` pins that version.
- 12 columns go in: the 11 form answers, plus `Grouped_Countries`, which `main.py` derives from Country (top 9 countries kept, everything else becomes `Other`).
- `Mental_Health_Score` is the target, so it is not an input.
- The pickle does not store the score's scale or any accuracy metric, so the app shows only the raw model output.

## Run on Windows PowerShell

Use Python 3.10 or newer. From the project folder:

```powershell
cd path\to\mental-health-app
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload
```

If activation is blocked, run this once, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Open <http://127.0.0.1:8000> in your browser. Interactive API docs: <http://127.0.0.1:8000/docs>.

## Test the health endpoint

In a second PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Expected: `status: ok` and `model_loaded: True`.

## Make a real prediction from PowerShell

```powershell
$body = @{
  Age = 20; Gender = "Female"; Country = "India"
  Academic_Level = "Undergraduate"; Most_Used_Platform = "Instagram"
  Purpose_Of_Use = "Entertainment"; Avg_Daily_Usage_Hours = 5
  Daily_Unlocks = 80; Study_Hours = 4; Physical_Activity_Hours = 1
  Sleep_Hours_Per_Night = 7; Stress_Level = "Medium"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/predict `
  -ContentType "application/json" -Body $body
```

Or fill in the form on the page and press **Predict score**.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server and model status |
| POST | `/api/predict` | Returns `predicted_mental_health_score` and `country_group` |

Invalid input returns HTTP 422 with field-level messages. Study + physical activity + sleep hours must total 24 or less.

## Troubleshooting

- **`model_loaded: False`**: check that `Model.pkl` sits next to `main.py` and that scikit-learn is 1.7.2 (`pip show scikit-learn`).
- **Port busy**: `uvicorn main:app --reload --port 8001`, then open that port.
- **"Could not reach the server"**: uvicorn is not running, or you opened `index.html` from disk while the server is on a different port.

Educational use only; this is not medical advice.
