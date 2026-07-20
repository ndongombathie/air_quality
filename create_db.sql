-- ============================================
-- Création de la base de données air_quality_db
-- ============================================

CREATE DATABASE IF NOT EXISTS air_quality_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE air_quality_db;

-- ============================================
-- Table principale : air_quality_data
-- ============================================

CREATE TABLE IF NOT EXISTS air_quality_data (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    location_id     VARCHAR(100),
    location_name   VARCHAR(255),
    latitude        DOUBLE,
    longitude       DOUBLE,
    vitesse_vent    FLOAT,
    direction_vent  FLOAT,
    timestamp       DATETIME,

    -- Données capteur (station)
    pm25            FLOAT,
    pm10            FLOAT,
    temperature     FLOAT,
    humidity        FLOAT,
    co2             FLOAT,
    tvoc            FLOAT,

    -- Données API OpenWeatherMap (pollution atmosphérique)
    co              FLOAT,
    no              FLOAT,
    no2             FLOAT,
    so2             FLOAT,
    o3              FLOAT,
    nh3             FLOAT,
    iqr             FLOAT,
    categorie_iqa   VARCHAR(50),

    -- Métadonnées
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_location_id (location_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;