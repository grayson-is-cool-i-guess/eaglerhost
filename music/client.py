import os
import base64
from pathlib import Path
from bs4 import BeautifulSoup

INPUT_HTML = "index.html"
OUTPUT_HTML = "Offline_Download_Version.html"

with open(INPUT_HTML, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

for link in soup.find_all("link", rel="stylesheet"):
    href = link.get("href")
    if href and os.path.isfile(href):
        with open(href, "r", encoding="utf-8") as f:
            style_tag = soup.new_tag("style")
            style_tag.string = f.read()
            link.replace_with(style_tag)

for script in soup.find_all("script", src=True):
    src = script.get("src")
    if src and os.path.isfile(src):
        with open(src, "r", encoding="utf-8") as f:
            new_script = soup.new_tag("script")
            new_script.string = f.read()
            script.replace_with(new_script)

for script in soup.find_all("script"):
    if script.string and ".json" in script.string:

        pass  

for img in soup.find_all("img"):
    src = img.get("src")
    if src and os.path.isfile(src):
        ext = Path(src).suffix[1:]
        with open(src, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")
            img["src"] = f"data:image/{ext};base64,{data}"

with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(str(soup))

print(f"Offline HTML generated: {OUTPUT_HTML}")