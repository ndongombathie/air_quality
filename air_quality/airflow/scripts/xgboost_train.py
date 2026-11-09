import joblib
import os
import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from scripts.config import POLLUANTS, MODELS_DIR
from scripts.feature_engineering import get_feature_columns

def split_temporel(df: pd.DataFrame, test_size: float = 0.15):
    train_list, test_list = [], []
    for loc_id, group in df.groupby('location_id'):
        group = group.sort_values('timestamp')
        split_idx = int(len(group) * (1 - test_size))
        train_list.append(group.iloc[:split_idx])
        test_list.append(group.iloc[split_idx:])
    return pd.concat(train_list).reset_index(drop=True), pd.concat(test_list).reset_index(drop=True)


def entrainer_tous_les_xgboost(df: pd.DataFrame) -> pd.DataFrame:
    os.makedirs(f'{MODELS_DIR}/xgboost', exist_ok=True)
    train, test = split_temporel(df)
    features = get_feature_columns(df)

    resultats = []
    for p in POLLUANTS:
        target_col = f'target_{p}'
        if target_col not in train.columns:
            continue

        X_train, y_train = train[features], train[target_col]
        X_test, y_test = test[features], test[target_col]

        model = XGBRegressor(
            n_estimators=300,
            max_depth=5,              # réduit car peu de données (évite l'overfitting)
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,       # équivalent de min_samples_leaf, régularise
            reg_alpha=0.1,            # régularisation L1
            reg_lambda=1.0,           # régularisation L2
            random_state=42,
            n_jobs=-1,
            eval_metric='mae'
        )

        # early stopping pour éviter l'overfitting avec peu de données
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False
        )

        pred = model.predict(X_test)

        mae = mean_absolute_error(y_test, pred)
        baseline_mae = mean_absolute_error(y_test, test[p])

        chemin_modele = f'{MODELS_DIR}/xgboost/modele_{p}.pkl'
        deployer = True

        # Ne remplacer que si meilleur (ou si aucun modèle existant)
        if os.path.exists(chemin_modele):
            ancien = XGBRegressor()
            ancien.load_model(chemin_modele)
            mae_ancien = mean_absolute_error(y_test, ancien.predict(X_test))
            deployer = mae < mae_ancien

        if deployer:
            model.save_model(chemin_modele)

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
    df_resultats.to_csv(f'{MODELS_DIR}/xgboost/derniers_resultats.csv', index=False)
    print(df_resultats)
    return df_resultats