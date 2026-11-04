import pandas as pd
import numpy as np
from scripts.config import POLLUANTS, FEATURES_METEO, FREQ_MIN, HORIZON_MIN, LAGS_MIN

def preparer_station(group: pd.DataFrame, avec_target: bool = True) -> pd.DataFrame:
    """Feature engineering pour UNE station. Si avec_target=False, on ne garde
    que la dernière ligne dispo (utilisé en mode prédiction temps réel)."""
    
    group = group.sort_values('timestamp').set_index('timestamp')
    loc_id = group['location_id'].iloc[0]
    
    cols_base = [c for c in POLLUANTS + FEATURES_METEO if c in group.columns]
    g = group[cols_base].resample(f'{FREQ_MIN}min').mean()
    g = g.interpolate(method='linear', limit=3)
    
    for p in POLLUANTS:
        if p not in g.columns:
            continue
        for lag in LAGS_MIN:
            n = lag // FREQ_MIN
            g[f'{p}_lag_{lag}min'] = g[p].shift(n)
        g[f'{p}_roll_mean_30min'] = g[p].rolling(30 // FREQ_MIN).mean()
        g[f'{p}_roll_std_30min'] = g[p].rolling(30 // FREQ_MIN).std()
        g[f'{p}_diff'] = g[p].diff(1)
        
        if avec_target:
            n_target = HORIZON_MIN // FREQ_MIN
            g[f'target_{p}'] = g[p].shift(-n_target)
    
    g['hour'] = g.index.hour
    g['hour_sin'] = np.sin(2 * np.pi * g['hour'] / 24)
    g['hour_cos'] = np.cos(2 * np.pi * g['hour'] / 24)
    g['location_id'] = loc_id
    
    if not avec_target:
        g = g.dropna().tail(1)  # seulement l'instant présent
    else:
        g = g.dropna()
    
    return g.reset_index()

def construire_dataset(df_brut: pd.DataFrame, avec_target: bool = True) -> pd.DataFrame:
    resultats = []
    for loc_id, group in df_brut.groupby('location_id'):
        print(f"Station {loc_id}: {group.head()}")
        try:
            resultats.append(preparer_station(group, avec_target=avec_target))
            print(f"Station {loc_id} prête")
        except Exception as e:
            print(f"Erreur station {loc_id}: {e}")
            print(group.head(10))
    if not resultats:
        return pd.DataFrame()
    return pd.concat(resultats).reset_index(drop=True)

def get_feature_columns(df: pd.DataFrame) -> list:
    target_cols = [f'target_{p}' for p in POLLUANTS]
    exclude = target_cols + ['timestamp', 'location_id']
    return [c for c in df.columns if c not in exclude]

