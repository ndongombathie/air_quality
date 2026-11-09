import joblib
import pandas as pd

def predict_pollution(latitude, longitude):

    model = joblib.load("./airflow/models/knn_model.pkl")

    X = pd.DataFrame({
        "latitude": [latitude],
        "longitude": [longitude]
    })  


    prediction = model.predict(X)

    return {
        "iqr": round(float(prediction[0][6]), 2),
        "pm25": round(float(prediction[0][0]), 2),
        "pm10": round(float(prediction[0][1]), 2),
        "co": round(float(prediction[0][2]), 2),
        "no2": round(float(prediction[0][3]), 2),
        "so2": round(float(prediction[0][4]), 2),
        "o3": round(float(prediction[0][5]), 2)
    }
    

print(predict_pollution(14.7936825,-16.9653179))