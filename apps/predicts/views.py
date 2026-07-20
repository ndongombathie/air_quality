from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import serializers
import joblib
import pandas as pd



# Create your views here.


@api_view(["POST"])
def predict(request):
    
    model = joblib.load("./airflow/models/knn_model.pkl")
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    
    if latitude is None or longitude is None:
        return Response({"message": "latitude and longitude are required"}, status=status.HTTP_400_BAD_REQUEST)
    
    X = pd.DataFrame({
        "latitude": [latitude],
        "longitude": [longitude]
    })  
    
    prediction = model.predict(X)
    
    return Response({"polluants": {
        "iqr": round(float(prediction[0][6]), 2),
        "pm25": round(float(prediction[0][0]), 2),
        "pm10": round(float(prediction[0][1]), 2),
        "co": round(float(prediction[0][2]), 2),
        "no2": round(float(prediction[0][3]), 2),
        "so2": round(float(prediction[0][4]), 2),
        "o3": round(float(prediction[0][5]), 2)
    }})
