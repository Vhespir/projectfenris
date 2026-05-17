CREATE TABLE frequencies (
  id            SERIAL PRIMARY KEY,
  submitted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  state         TEXT NOT NULL,
  county        TEXT,
  category      TEXT NOT NULL CHECK (category IN ('police','fire','ems','noaa_weather','ham_repeater','gmrs','military','other')),
  frequency_mhz NUMERIC(9,4) NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  tone_ctcss    TEXT,
  tone_dcs      TEXT,
  notes         TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_freq_state    ON frequencies(state);
CREATE INDEX idx_freq_category ON frequencies(category);
CREATE INDEX idx_freq_mhz      ON frequencies(frequency_mhz);

-- Seed: NOAA Weather Radio stations (national network, 7 standard frequencies)
INSERT INTO frequencies (submitted_by, state, county, category, frequency_mhz, name, description, is_verified) VALUES
  (NULL, 'ALL', NULL, 'noaa_weather', 162.400, 'WX1 - NOAA Weather Radio', 'Primary NOAA Weather Radio frequency', TRUE),
  (NULL, 'ALL', NULL, 'noaa_weather', 162.425, 'WX2 - NOAA Weather Radio', 'Secondary NOAA Weather Radio frequency', TRUE),
  (NULL, 'ALL', NULL, 'noaa_weather', 162.450, 'WX3 - NOAA Weather Radio', 'NOAA Weather Radio frequency', TRUE),
  (NULL, 'ALL', NULL, 'noaa_weather', 162.475, 'WX4 - NOAA Weather Radio', 'NOAA Weather Radio frequency', TRUE),
  (NULL, 'ALL', NULL, 'noaa_weather', 162.500, 'WX5 - NOAA Weather Radio', 'NOAA Weather Radio frequency', TRUE),
  (NULL, 'ALL', NULL, 'noaa_weather', 162.525, 'WX6 - NOAA Weather Radio', 'NOAA Weather Radio frequency', TRUE),
  (NULL, 'ALL', NULL, 'noaa_weather', 162.550, 'WX7 - NOAA Weather Radio', 'NOAA Weather Radio frequency', TRUE);

-- Seed: GMRS standard channels
INSERT INTO frequencies (submitted_by, state, county, category, frequency_mhz, name, description, notes, is_verified) VALUES
  (NULL, 'ALL', NULL, 'gmrs', 462.5500, 'GMRS Ch 1',  'General Mobile Radio Service channel 1',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.5750, 'GMRS Ch 2',  'General Mobile Radio Service channel 2',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6000, 'GMRS Ch 3',  'General Mobile Radio Service channel 3',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6250, 'GMRS Ch 4',  'General Mobile Radio Service channel 4',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6500, 'GMRS Ch 5',  'General Mobile Radio Service channel 5',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6750, 'GMRS Ch 6',  'General Mobile Radio Service channel 6',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.7000, 'GMRS Ch 7',  'General Mobile Radio Service channel 7',  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.5500, 'GMRS Ch 8',  'GMRS simplex channel 8',                  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.5750, 'GMRS Ch 9',  'GMRS simplex channel 9',                  'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.6000, 'GMRS Ch 10', 'GMRS simplex channel 10',                 'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.6250, 'GMRS Ch 11', 'GMRS simplex channel 11',                 'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.6500, 'GMRS Ch 12', 'GMRS simplex channel 12',                 'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.6750, 'GMRS Ch 13', 'GMRS simplex channel 13',                 'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 467.7000, 'GMRS Ch 14', 'GMRS simplex channel 14',                 'Requires FCC GMRS license', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.5500, 'GMRS Ch 15', 'GMRS repeater output 15',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.5750, 'GMRS Ch 16', 'GMRS repeater output 16',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6000, 'GMRS Ch 17', 'GMRS repeater output 17',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6250, 'GMRS Ch 18', 'GMRS repeater output 18',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6500, 'GMRS Ch 19', 'GMRS repeater output 19',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.6750, 'GMRS Ch 20', 'GMRS repeater output 20',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.7000, 'GMRS Ch 21', 'GMRS repeater output 21',                 'Repeater output pair', TRUE),
  (NULL, 'ALL', NULL, 'gmrs', 462.5625, 'GMRS Ch 22', 'GMRS simplex interstitial',               'Interstitial channel', TRUE);

-- Seed: Ham radio calling frequencies (national simplex)
INSERT INTO frequencies (submitted_by, state, county, category, frequency_mhz, name, description, notes, is_verified) VALUES
  (NULL, 'ALL', NULL, 'ham_repeater', 146.520, '2m National Calling', '2 meter FM national simplex calling frequency', 'No tone required on calling freq', TRUE),
  (NULL, 'ALL', NULL, 'ham_repeater', 446.000, '70cm National Calling', '70 cm FM national simplex calling frequency', 'No tone required on calling freq', TRUE),
  (NULL, 'ALL', NULL, 'ham_repeater',  52.525, '6m National Calling', '6 meter FM national simplex calling frequency', 'No tone required', TRUE),
  (NULL, 'ALL', NULL, 'ham_repeater', 223.500, '1.25m National Calling', '1.25 meter FM national simplex calling frequency', NULL, TRUE);
