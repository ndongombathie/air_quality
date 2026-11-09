from sklearn.neighbors import KNeighborsRegressor
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
import pandas as pd


def modelKNN(data: pd.DataFrame):
    x = data[["latitude", "longitude"]]
    y = data[["iqr", "pm25", "pm10", "co2", "no2", "so2", "o3"]]

    x = x.fillna(x.mean())
    y = y.fillna(y.mean())

    print("Valeurs manquantes dans x:", x.isna().sum().to_dict())
    print("Valeurs manquantes dans y:", y.isna().sum().to_dict())

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42
    )

    model = KNeighborsRegressor(n_neighbors=3, weights="distance")
    model.fit(x_train, y_train)

    y_pred = model.predict(x_test)
    print("Mean squared error: %.2f" % mean_squared_error(y_test, y_pred))
    print("Coefficient of determination: %.2f" % r2_score(y_test, y_pred))

    return model

