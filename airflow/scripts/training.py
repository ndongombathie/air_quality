import joblib
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from scripts.config import POLLUANTS, MODELS_DIR
from scripts.feature_engineering import get_feature_columns

def split_temporel(df: pd.DataFrame, test_size: float = 0.2):
    train_list, test_list = [], []
    for loc_id, group in df.groupby('location_id'):
        group = group.sort_values('timestamp')
        split_idx = int(len(group) * (1 - test_size))
        train_list.append(group.iloc[:split_idx])
        test_list.append(group.iloc[split_idx:])
    return pd.concat(train_list).reset_index(drop=True), pd.concat(test_list).reset_index(drop=True)

def entrainer_tous_les_modeles(df: pd.DataFrame) -> pd.DataFrame:
    os.makedirs(MODELS_DIR, exist_ok=True)
    train, test = split_temporel(df)
    features = get_feature_columns(df)
    
    resultats = []
    for p in POLLUANTS:
        target_col = f'target_{p}'
        if target_col not in train.columns:
            continue
        
        X_train, y_train = train[features], train[target_col]
        X_test, y_test = test[features], test[target_col]
        
        model = RandomForestRegressor(
            n_estimators=200, max_depth=15, min_samples_leaf=5,
            random_state=42, n_jobs=-1
        )
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, pred)
        baseline_mae = mean_absolute_error(y_test, test[p])
        
        chemin_modele = f'{MODELS_DIR}/random_forest/modele_{p}.pkl'
        deployer = True
        
        # Ne remplacer que si meilleur (ou si aucun modèle existant)
        if os.path.exists(chemin_modele):
            ancien = joblib.load(chemin_modele)
            mae_ancien = mean_absolute_error(y_test, ancien.predict(X_test))
            deployer = mae < mae_ancien
        
        if deployer:
            joblib.dump(model, chemin_modele)
        
        resultats.append({
            'polluant': p,
            'MAE': round(mae, 3),
            'RMSE': round(np.sqrt(mean_squared_error(y_test, pred)), 3),
            'R2': round(r2_score(y_test, pred), 3),
            'MAE_baseline': round(baseline_mae, 3),
            'amelioration_%': round((1 - mae / baseline_mae) * 100, 1) if baseline_mae > 0 else None,
            'deploye': deployer
        })
    
    df_resultats = pd.DataFrame(resultats)
    df_resultats.to_csv(f'{MODELS_DIR}/random_forest/dern_forest_resultats.csv', index=False)
    print(df_resultats)
    return df_resultats