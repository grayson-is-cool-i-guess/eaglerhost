import os
from bs4 import BeautifulSoup

input_file = "index.html"
output_file = "bundled.html"

exclude_js = {"metadatafinderdontremovethisisimportant.js", "fflate.js"}

with open(input_file, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

for link in soup.find_all("link", rel="stylesheet"):
    href = link.get("href")
    if href and os.path.exists(href):
        with open(href, "r", encoding="utf-8") as css_file:
            style_tag = soup.new_tag("style")
            style_tag.string = css_file.read()
            link.replace_with(style_tag)

for script in soup.find_all("script", src=True):
    src = script.get("src")
    filename = os.path.basename(src)
    if filename not in exclude_js and os.path.exists(src):
        with open(src, "r", encoding="utf-8") as js_file:
            script_tag = soup.new_tag("script")
            script_tag.string = js_file.read()
            script.replace_with(script_tag)

with open(output_file, "w", encoding="utf-8") as f:
    f.write(str(soup))

print(f"Bundled HTML created: {output_file}")