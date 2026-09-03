from pathlib import Path
import re
import shutil

from app import app


OUTPUT_DIR = Path(__file__).resolve().parent / "docs"
SITE_PREFIX = "/dna"
ROUTES = ["/", "/protein", "/mutation", "/stability", "/dashboard", "/about"]


def rewrite_project_links(html: str) -> str:
    html = re.sub(r'(href|src)="/(?!/)', rf'\1="{SITE_PREFIX}/', html)
    for route in ROUTES[1:]:
        html = html.replace(f'href="{SITE_PREFIX}{route}"', f'href="{SITE_PREFIX}{route}/"')
    html = html.replace(f'href="{SITE_PREFIX}/"', f'href="{SITE_PREFIX}/"')
    return html


def output_path(route: str) -> Path:
    if route == "/":
        return OUTPUT_DIR / "index.html"
    return OUTPUT_DIR / route.strip("/") / "index.html"


def main() -> None:
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True)

    client = app.test_client()
    for route in ROUTES:
        response = client.get(route)
        if response.status_code != 200:
            raise RuntimeError(f"Could not render {route}: HTTP {response.status_code}")
        destination = output_path(route)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            rewrite_project_links(response.get_data(as_text=True)),
            encoding="utf-8",
        )

    shutil.copytree(
        Path(__file__).resolve().parent / "static",
        OUTPUT_DIR / "static",
    )
    (OUTPUT_DIR / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Built {len(ROUTES)} pages in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
