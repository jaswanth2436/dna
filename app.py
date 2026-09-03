from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from statistics import mean

from flask import Flask, render_template


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_DIR = BASE_DIR / "database"
DB_PATH = DB_DIR / "hbb.db"


app = Flask(__name__)


def load_json(filename: str, default):
    path = DATA_DIR / filename
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_protein_data() -> dict:
    return load_json("protein.json", {})


def get_mutations_data() -> list[dict]:
    return load_json("mutations.json", [])


def get_stability_data() -> list[dict]:
    return load_json("stability.json", [])


def ensure_database() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    protein = get_protein_data()
    mutations = get_mutations_data()
    stability = get_stability_data()

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS protein (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gene_name TEXT NOT NULL,
                protein_name TEXT NOT NULL,
                organism TEXT NOT NULL,
                uniprot_id TEXT NOT NULL,
                protein_length INTEGER NOT NULL,
                molecular_weight REAL NOT NULL,
                function TEXT NOT NULL,
                sequence TEXT NOT NULL,
                pdb_structure_id TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS mutations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mutation TEXT NOT NULL,
                position INTEGER NOT NULL,
                wild_amino_acid TEXT NOT NULL,
                mutant_amino_acid TEXT NOT NULL,
                clinical_significance TEXT NOT NULL,
                disease_association TEXT NOT NULL,
                prediction_status TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS stability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mutation TEXT NOT NULL,
                delta_g REAL NOT NULL,
                prediction TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                stability_score REAL NOT NULL,
                reported_on TEXT NOT NULL
            )
            """
        )

        if connection.execute("SELECT COUNT(*) FROM protein").fetchone()[0] == 0 and protein:
            connection.execute(
                """
                INSERT INTO protein (
                    gene_name, protein_name, organism, uniprot_id,
                    protein_length, molecular_weight, function,
                    sequence, pdb_structure_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    protein["gene_name"],
                    protein["protein_name"],
                    protein["organism"],
                    protein["uniprot_id"],
                    protein["protein_length"],
                    protein["molecular_weight"],
                    protein["function"],
                    protein["sequence"],
                    protein["pdb_structure_id"],
                ),
            )

        if connection.execute("SELECT COUNT(*) FROM mutations").fetchone()[0] == 0 and mutations:
            connection.executemany(
                """
                INSERT INTO mutations (
                    mutation, position, wild_amino_acid, mutant_amino_acid,
                    clinical_significance, disease_association, prediction_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["mutation"],
                        item["position"],
                        item["wild_amino_acid"],
                        item["mutant_amino_acid"],
                        item["clinical_significance"],
                        item["disease_association"],
                        item["prediction_status"],
                    )
                    for item in mutations
                ],
            )

        if connection.execute("SELECT COUNT(*) FROM stability").fetchone()[0] == 0 and stability:
            connection.executemany(
                """
                INSERT INTO stability (
                    mutation, delta_g, prediction, confidence_score,
                    stability_score, reported_on
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["mutation"],
                        item["delta_g"],
                        item["prediction"],
                        item["confidence_score"],
                        item["stability_score"],
                        item["reported_on"],
                    )
                    for item in stability
                ],
            )

        connection.commit()


def build_dashboard_payload() -> dict:
    protein = get_protein_data()
    mutations = get_mutations_data()
    stability = get_stability_data()

    total_mutations = len(mutations)
    pathogenic = sum(
        1 for item in mutations if "pathogenic" in item["clinical_significance"].lower()
    )
    benign = sum(1 for item in mutations if "benign" in item["clinical_significance"].lower())
    average_stability = round(mean(item["stability_score"] for item in stability), 1) if stability else 0

    frequency_labels = [item["mutation"] for item in mutations]
    frequency_values = [item["position"] for item in mutations]

    distribution_labels = ["Pathogenic", "Benign", "Uncertain"]
    distribution_values = [
        pathogenic,
        benign,
        max(total_mutations - pathogenic - benign, 0),
    ]

    stability_labels = [item["mutation"] for item in stability]
    stability_values = [item["stability_score"] for item in stability]

    clinical_labels = list(
        dict.fromkeys(item["clinical_significance"] for item in mutations)
    )
    clinical_values = [
        sum(1 for item in mutations if item["clinical_significance"] == label)
        for label in clinical_labels
    ]

    heatmap_x = ["ΔΔG", "Confidence", "Stability Score"]
    heatmap_y = [item["mutation"] for item in stability]
    heatmap_metrics = [
        [item["delta_g"] for item in stability],
        [item["confidence_score"] for item in stability],
        [item["stability_score"] for item in stability],
    ]

    def normalize(values: list[float]) -> list[float]:
        low, high = min(values), max(values)
        span = high - low
        if span == 0:
            return [0.5 for _ in values]
        return [(value - low) / span for value in values]

    normalized_metrics = [normalize(column) for column in heatmap_metrics]
    heatmap_z = [
        [normalized_metrics[col_idx][row_idx] for col_idx in range(len(heatmap_x))]
        for row_idx in range(len(stability))
    ]
    heatmap_z_raw = [
        [heatmap_metrics[col_idx][row_idx] for col_idx in range(len(heatmap_x))]
        for row_idx in range(len(stability))
    ]

    timeline_labels = [item["reported_on"] for item in stability]
    timeline_values = [item["stability_score"] for item in stability]

    return {
        "summary": {
            "gene_name": protein.get("gene_name", "HBB"),
            "protein_name": protein.get("protein_name", "Hemoglobin subunit beta"),
            "total_mutations": total_mutations,
            "pathogenic_mutations": pathogenic,
            "benign_mutations": benign,
            "average_stability_score": average_stability,
        },
        "charts": {
            "mutation_frequency": {"labels": frequency_labels, "values": frequency_values},
            "mutation_distribution": {"labels": distribution_labels, "values": distribution_values},
            "stability": {"labels": stability_labels, "values": stability_values},
            "clinical": {"labels": clinical_labels, "values": clinical_values},
            "heatmap": {
                "x": heatmap_x,
                "y": heatmap_y,
                "z": heatmap_z,
                "z_raw": heatmap_z_raw,
            },
            "timeline": {"labels": timeline_labels, "values": timeline_values},
        },
        "recent_mutations": mutations[:5],
        "protein": protein,
    }


@app.route("/")
def index():
    protein = get_protein_data()
    return render_template(
        "index.html",
        title="Home",
        protein=protein,
    )


@app.route("/protein")
def protein_page():
    protein = get_protein_data()
    return render_template(
        "protein.html",
        title="Protein Information",
        protein=protein,
    )


@app.route("/mutation")
def mutation_page():
    mutations = get_mutations_data()
    stability = get_stability_data()
    stability_map = {item["mutation"]: item for item in stability}
    return render_template(
        "mutation.html",
        title="Mutation Analysis",
        mutations=mutations,
        stability_map=stability_map,
    )


@app.route("/stability")
def stability_page():
    stability = get_stability_data()
    return render_template(
        "stability.html",
        title="Stability Prediction",
        stability=stability,
    )


@app.route("/dashboard")
def dashboard_page():
    dashboard = build_dashboard_payload()
    return render_template(
        "dashboard.html",
        title="Dashboard",
        dashboard=dashboard,
    )


@app.route("/about")
def about_page():
    return render_template(
        "about.html",
        title="About",
    )


if __name__ == "__main__":
    ensure_database()
    app.run(host="127.0.0.1", port=5000, debug=True)
