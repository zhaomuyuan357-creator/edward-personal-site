#!/usr/bin/env python3
"""Create a deployment folder and ZIP with public website files only."""
import html
import json
import re
import shutil
import zipfile
from pathlib import Path
from content import load_content

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site"
DESTINATION = ROOT / "dist"
content = load_content(SOURCE / "content.json")
referenced = [content.get("aboutImage", "")]
for project in content["projects"]:
    referenced += [project.get("image", ""), project.get("video", ""), project.get("videoWebm", "")]
for asset in referenced:
    if asset and not asset.startswith("https://"):
        if not (SOURCE / asset).is_file():
            raise SystemExit("缺少媒体文件：" + asset)
        if (SOURCE / asset).stat().st_size >= 25 * 1024 * 1024:
            raise SystemExit("文件超过 Cloudflare Pages 的 25 MiB 限制：" + asset)
if DESTINATION.exists():
    shutil.rmtree(DESTINATION)
shutil.copytree(SOURCE, DESTINATION)
page = (DESTINATION / "index.html").read_text(encoding="utf-8")
title = html.escape(content["name"] + " — 个人作品集", quote=True)
description = html.escape(content["role"] + "。" + content["intro"].replace("\n", ""), quote=True)
page = re.sub(r"<title>.*?</title>", lambda match: "<title>" + title + "</title>", page)
page = re.sub(r'<meta name="description" content="[^"]*">', lambda match: '<meta name="description" content="' + description + '">', page)
page = re.sub(r'<meta property="og:title" content="[^"]*">', lambda match: '<meta property="og:title" content="' + title + '">', page)
page = re.sub(r'<meta property="og:description" content="[^"]*">', lambda match: '<meta property="og:description" content="' + description + '">', page)
(DESTINATION / "index.html").write_text(page, encoding="utf-8")
(DESTINATION / ".nojekyll").touch()
archive = ROOT / "edward-site.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
    for file in sorted(DESTINATION.rglob("*")):
        if file.is_file():
            bundle.write(file, file.relative_to(DESTINATION))
size = sum(file.stat().st_size for file in DESTINATION.rglob("*") if file.is_file())
print("构建完成：dist/，%.2f MB" % (size / 1024 / 1024))
print("上传包：edward-site.zip（不包含本机编辑器或个人文件路径）")
