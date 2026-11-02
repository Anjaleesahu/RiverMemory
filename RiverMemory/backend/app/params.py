"""Water-quality parameters: single source of truth for labels, units and import plausibility ranges."""

PARAMS = {
    "ph": {"label": "pH", "unit": "pH units", "range": (0, 14)},
    "do_mg_l": {"label": "Dissolved Oxygen (DO)", "unit": "mg/L", "range": (0, 25)},
    "bod_mg_l": {"label": "BOD (3 days at 27°C or 5 days at 20°C, as reported)", "unit": "mg/L", "range": (0, 1000)},
    "cod_mg_l": {"label": "COD", "unit": "mg/L", "range": (0, 5000)},
    "temperature_c": {"label": "Temperature", "unit": "°C", "range": (-5, 50)},
    "conductivity_us_cm": {"label": "Electrical Conductivity", "unit": "µS/cm", "range": (0, 100000)},
    "nitrate_mg_l": {"label": "Nitrate", "unit": "mg/L", "range": (0, 1000)},
    "total_coliform_mpn": {"label": "Total Coliform", "unit": "MPN/100 mL", "range": (0, 1e9)},
    "fecal_coliform_mpn": {"label": "Fecal Coliform", "unit": "MPN/100 mL", "range": (0, 1e9)},
}
PARAM_KEYS = list(PARAMS.keys())

# Accepted CSV header aliases (lower-case) -> canonical key
WQ_ALIASES = {
    "date": "date", "sampling_date": "date", "sample_date": "date",
    "station": "station", "station_name": "station", "location": "station", "site": "station",
    "river": "river",
    "latitude": "latitude", "lat": "latitude", "longitude": "longitude", "lon": "longitude", "lng": "longitude",
    "ph": "ph",
    "do": "do_mg_l", "do_mg_l": "do_mg_l", "dissolved_oxygen": "do_mg_l",
    "bod": "bod_mg_l", "bod_mg_l": "bod_mg_l",
    "cod": "cod_mg_l", "cod_mg_l": "cod_mg_l",
    "temperature": "temperature_c", "temp": "temperature_c", "temperature_c": "temperature_c",
    "conductivity": "conductivity_us_cm", "ec": "conductivity_us_cm", "conductivity_us_cm": "conductivity_us_cm",
    "nitrate": "nitrate_mg_l", "nitrate_mg_l": "nitrate_mg_l",
    "total_coliform": "total_coliform_mpn", "tc": "total_coliform_mpn", "total_coliform_mpn": "total_coliform_mpn",
    "fecal_coliform": "fecal_coliform_mpn", "faecal_coliform": "fecal_coliform_mpn",
    "fc": "fecal_coliform_mpn", "fecal_coliform_mpn": "fecal_coliform_mpn",
}
RAIN_ALIASES = {
    "date": "date",
    "rainfall_mm": "rainfall_mm", "rainfall": "rainfall_mm", "precipitation": "rainfall_mm",
    "prcp": "rainfall_mm", "rain_mm": "rainfall_mm",
    "location": "location", "station": "location", "area": "location",
    "kind": "kind", "type": "kind", "resolution": "resolution", "grid_resolution": "resolution",
}
STATION_ALIASES = {
    "station": "station", "station_name": "station", "name": "station", "location": "station",
    "river": "river", "latitude": "latitude", "lat": "latitude", "longitude": "longitude",
    "lon": "longitude", "lng": "longitude",
}

RIVERS = ["Ganga", "Yamuna"]
RIVER_NORMALIZE = {"ganga": "Ganga", "ganges": "Ganga", "gange": "Ganga", "yamuna": "Yamuna", "jamuna": "Yamuna"}

# CPCB "Designated Best Use" Class B: outdoor bathing (organised).
# Source: https://cpcb.nic.in/water-quality-criteria/ . Indicative screening only; not a certification.
BATHING_CRITERIA = {
    "name": "CPCB Designated Best Use Class B - Outdoor bathing (organised)",
    "source_url": "https://cpcb.nic.in/water-quality-criteria/",
    "limits": {
        "ph": {"min": 6.5, "max": 8.5},
        "do_mg_l": {"min": 5},
        "bod_mg_l": {"max": 3},
        "total_coliform_mpn": {"max": 500},
    },
    "applicability": (
        "These limits describe suitability for organised outdoor bathing only. They are applied per observation "
        "as an indicative screen. They do NOT establish that water is safe to drink; drinking-water suitability "
        "requires different standards (e.g. BIS IS 10500 or CPCB source classes with treatment) and many more "
        "parameters. Fecal coliform has no limit in this class on the CPCB page and is not screened. Confirm "
        "against the current CPCB notification before citing."
    ),
}
