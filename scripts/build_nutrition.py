"""Builds backend/data/nutrition.json from USDA FoodData Central (FNDDS 2021-2023 survey foods).

Every Food-101 class maps to one FNDDS food, or to a weighted mix of FNDDS foods when USDA
has no entry for the dish itself (those are flagged approximate in the app). Values are per
100 g; portions come from FNDDS, and "Quantity not specified" is USDA's typical serving.

    python scripts/build_nutrition.py path/to/FoodData_Central_survey_food_csv_2024-10-31
Download: https://fdc.nal.usda.gov/download-datasets (Survey FNDDS, CSV). Stdlib only.
"""
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NUTRIENTS = {"208": "kcal", "203": "protein", "205": "carbs", "204": "fat"}  # USDA nutrient numbers

# class: (fdc_id, ) for a direct match, or [(fdc_id, weight), ...] for a mix, plus optional serving grams.
FOODS = {
    "apple_pie": ("2707995",), "baby_back_ribs": ("2705894",), "baklava": ("2708044",),
    "beef_carpaccio": ([("2705841", .85), ("2710186", .07), ("2705730", .08)], 90),
    "beef_tartare": ([("2705841", .9), ("2707172", .1)], 140),
    "beet_salad": ([("2709770", .7), ("2705714", .15), ("2710195", .15)], 150),
    "beignets": ("2708071",), "bibimbap": ("2708950",), "bread_pudding": ("2705680",),
    "breakfast_burrito": ("2707343",), "bruschetta": ("2707652",),
    "caesar_salad": ([("2709591", .85), ("2710199", .15)], 200),
    "cannoli": ("2708030",),
    "caprese_salad": ([("2709719", .5), ("2705722", .42), ("2710186", .08)], 180),
    "carrot_cake": ("2707859",), "ceviche": ("2706463",), "cheese_plate": ("2705704",),
    "cheesecake": ("2707861",), "chicken_curry": ("2706437",), "chicken_quesadilla": ("2708593",),
    "chicken_wings": ("2706076",), "chocolate_cake": ("2707866",), "chocolate_mousse": ("2705698",),
    "churros": ("2708070",), "clam_chowder": ("2707139",), "club_sandwich": ("2706993",),
    "crab_cakes": ("2706549",),
    "creme_brulee": ([("2705597", .65), ("2707172", .2), ("2710258", .15)], 120),
    "croque_madame": ([("2706965", .78), ("2707159", .22)], 230),
    "cup_cakes": ("2707853",), "deviled_eggs": ("2707181",), "donuts": ("2708062",),
    "dumplings": ("2708708",), "edamame": ("2707436",), "eggs_benedict": ("2707180",),
    "escargots": ([("2706342", .7), ("2710155", .3)], 90),
    "falafel": ("2707408",), "filet_mignon": ("2705841",),
    "fish_and_chips": ([("2706244", .45), ("2709456", .55)], 400),
    "foie_gras": ("2706155",), "french_fries": ("2709456",), "french_onion_soup": ("2710108",),
    "french_toast": ("2708331",), "fried_calamari": ("2706334",), "fried_rice": ("2708952",),
    "frozen_yogurt": ("2705451",), "garlic_bread": ("2707626",), "gnocchi": ("2708722",),
    "greek_salad": ([("2709830", .88), ("2710195", .12)], 200),
    "grilled_cheese_sandwich": ("2705801",), "grilled_salmon": ("2706287",), "guacamole": ("2709307",),
    "gyoza": ("2708705",), "hamburger": ("2706920",), "hot_and_sour_soup": ("2707136",),
    "hot_dog": ("2707056",), "huevos_rancheros": ("2707191",), "hummus": ("2707402",),
    "ice_cream": ("2705629",), "lasagna": ("2708750",), "lobster_bisque": ("2707140",),
    "lobster_roll_sandwich": ([("2706825", .6), ("2707656", .4)], 180),
    "macaroni_and_cheese": ("2708811",), "macarons": ("2707936",), "miso_soup": ("2707455",),
    "mussels": ("2706350",), "nachos": ("2708576",), "omelette": ("2707198",),
    "onion_rings": ("2710055",), "oysters": ("2706351",), "pad_thai": ("2708804",), "paella": ("2706723",),
    "pancakes": ("2708294",),
    "panna_cotta": ([("2705597", .6), ("2705385", .3), ("2710258", .1)], 120),
    "peking_duck": ("2706141",), "pho": ("2707124",), "pizza": ("2708616",), "pork_chop": ("2705866",),
    "poutine": ([("2709456", .6), ("2705704", .2), ("2707145", .2)], 300),
    "prime_rib": ("2705829",), "pulled_pork_sandwich": ("2706975",), "ramen": ("2709153",),
    "ravioli": ("2708768",), "red_velvet_cake": ("2707884",),
    "risotto": ([("2708404", .85), ("2705730", .08), ("2710155", .07)], 250),
    "samosa": ("2708730",), "sashimi": ("2706308",), "scallops": ("2706356",),
    "seaweed_salad": ([("2709805", .92), ("2710190", .04), ("2710258", .04)], 100),
    "shrimp_and_grits": ([("2708369", .6), ("2706363", .4)], 350),
    "spaghetti_bolognese": ([("2708357", .55), ("2706470", .45)], 400),
    "spaghetti_carbonara": ("2708861",), "spring_rolls": ("2708702",), "steak": ("2705824",),
    "strawberry_shortcake": ("2707896",), "sushi": ("2708959",), "tacos": ("2708514",),
    "takoyaki": ([("2708304", .75), ("2706331", .25)], 120),
    "tiramisu": ("2705702",), "tuna_tartare": ([("2706308", .85), ("2709223", .1), ("2710190", .05)], 140),
    "waffles": ("2708312",),
}
NAMES = {"cup_cakes": "Cupcakes", "donuts": "Doughnuts", "macarons": "Macarons", "pho": "Phở",
         "creme_brulee": "Crème brûlée", "lobster_roll_sandwich": "Lobster roll", "huevos_rancheros": "Huevos rancheros"}


def read(d, name):
    return csv.DictReader(open(d / name, encoding="utf-8"))


def main(d):
    d = pathlib.Path(d)
    desc = {r["fdc_id"]: r["description"] for r in read(d, "food.csv")}
    per100 = {}
    for r in read(d, "food_nutrient.csv"):
        if r["nutrient_id"] in NUTRIENTS:
            per100.setdefault(r["fdc_id"], {})[NUTRIENTS[r["nutrient_id"]]] = float(r["amount"])
    portions = {}
    for r in read(d, "food_portion.csv"):
        g = float(r["gram_weight"] or 0)
        if g > 0:
            label = "Typical serving" if r["portion_description"] == "Quantity not specified" else r["portion_description"]
            portions.setdefault(r["fdc_id"], []).append({"label": label, "grams": g})

    out = {}
    for cls, spec in FOODS.items():
        if isinstance(spec[0], str):
            parts, serving, approx = [(spec[0], 1.0)], None, False
        else:
            parts, serving, approx = spec[0], spec[1], True
        assert abs(sum(w for _, w in parts) - 1) < 1e-9, cls
        values = {k: round(sum(per100[f][k] * w for f, w in parts), 1) for k in NUTRIENTS.values()}
        if approx:
            options = [{"label": "Typical serving", "grams": serving}]
        else:
            options = sorted(portions[parts[0][0]], key=lambda p: (p["label"] != "Typical serving", p["grams"]))
        out[cls] = {
            "name": NAMES.get(cls, cls.replace("_", " ").capitalize()),
            "per100g": values,
            "portions": options,
            "approximate": approx,
            "source": [{"fdcId": int(f), "description": desc[f], "share": w} for f, w in parts],
        }
    assert len(out) == 101
    path = ROOT / "backend/data/nutrition.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(out)} foods to {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1])
