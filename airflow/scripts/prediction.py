import joblib
import pandas as pd
from scripts.config import POLLUANTS, MODELS_DIR, HORIZON_MIN
from scripts.feature_engineering import get_feature_columns

def predire_tous_polluants(df_features: pd.DataFrame) -> pd.DataFrame:
    if df_features.empty:
        return df_features
    
    features = get_feature_columns(df_features)
    resultat = df_features[['location_id', 'timestamp']].copy()
    
    for p in POLLUANTS:
        chemin = f'{MODELS_DIR}/random_forest/modele_{p}.pkl'
        try:
            model = joblib.load(chemin)
            resultat[p] = round(model.predict(df_features[features]), 3)
        except FileNotFoundError:
            print(f"Modèle absent pour {p}, ignoré")
            resultat[p] = None
    
    resultat['predicted_for'] = resultat['timestamp'] + pd.Timedelta(minutes=HORIZON_MIN)
    return resultat