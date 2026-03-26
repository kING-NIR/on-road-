"""
RoadAssist — train_models.py
Trains and saves breakdown + fuel demand ML models.
Run: python train_models.py
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, mean_absolute_error
import joblib
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

np.random.seed(42)
N = 5000

# ─── 1. Breakdown Risk Dataset ───────────────────────────────────────────────
print("Generating breakdown dataset...")

lats  = np.random.uniform(8.0, 35.0, N)     # India lat range
lngs  = np.random.uniform(68.0, 97.0, N)    # India lng range
hours = np.random.randint(0, 24, N)
dows  = np.random.randint(0, 7, N)
temps = np.random.normal(32, 8, N)
rain  = np.abs(np.random.normal(3, 8, N))
heavy_rain = (rain > 15).astype(int)
peak_hour  = ((hours >= 8) & (hours <= 10) | (hours >= 17) & (hours <= 19)).astype(int)

# Label: breakdown happened (1) based on risk factors
risk_score = (
    0.3 * heavy_rain +
    0.15 * (temps > 40).astype(int) +
    0.2 * ((hours >= 0) & (hours <= 4)).astype(int) +   # night
    0.1 * (rain > 5).astype(int) +
    0.25 * np.random.random(N)
)
labels = (risk_score > 0.45).astype(int)

breakdown_df = pd.DataFrame({
    'lat': lats, 'lng': lngs, 'hour': hours, 'dow': dows,
    'temperature': temps, 'rainfall': rain,
    'heavy_rain': heavy_rain, 'peak_hour': peak_hour,
    'breakdown': labels
})

X = breakdown_df.drop('breakdown', axis=1)
y = breakdown_df['breakdown']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

breakdown_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('clf', RandomForestClassifier(n_estimators=120, max_depth=10, random_state=42, n_jobs=-1))
])
breakdown_pipeline.fit(X_train, y_train)

print(classification_report(y_test, breakdown_pipeline.predict(X_test)))
joblib.dump(breakdown_pipeline, MODEL_DIR / "breakdown_predictor.pkl")
print(f"✅ Saved: {MODEL_DIR / 'breakdown_predictor.pkl'}")

# ─── 2. Fuel Demand Dataset ──────────────────────────────────────────────────
print("\nGenerating fuel demand dataset...")

fd_lats     = np.random.uniform(8.0, 35.0, N)
fd_lngs     = np.random.uniform(68.0, 97.0, N)
fd_hours    = np.random.randint(0, 24, N)
fd_dows     = np.random.randint(0, 7, N)
fd_holidays = np.random.choice([0, 1], N, p=[0.85, 0.15])

# Demand: peak hours + weekends + holidays → higher
fd_demand = (
    30 +
    30 * ((fd_hours >= 7) & (fd_hours <= 10) | (fd_hours >= 17) & (fd_hours <= 21)).astype(float) +
    20 * (fd_dows >= 5).astype(float) +
    25 * fd_holidays +
    np.random.normal(0, 8, N)
).clip(5, 100)

fuel_df = pd.DataFrame({
    'lat': fd_lats, 'lng': fd_lngs,
    'hour': fd_hours, 'dow': fd_dows,
    'is_holiday': fd_holidays, 'demand': fd_demand
})

Xf = fuel_df.drop('demand', axis=1)
yf = fuel_df['demand']
Xf_train, Xf_test, yf_train, yf_test = train_test_split(Xf, yf, test_size=0.2)

fuel_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('reg', GradientBoostingRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42))
])
fuel_pipeline.fit(Xf_train, yf_train)
mae = mean_absolute_error(yf_test, fuel_pipeline.predict(Xf_test))
print(f"Fuel demand MAE: {mae:.2f}")
joblib.dump(fuel_pipeline, MODEL_DIR / "fuel_demand.pkl")
print(f"✅ Saved: {MODEL_DIR / 'fuel_demand.pkl'}")

print("\n🎉 All models trained and saved successfully!")
