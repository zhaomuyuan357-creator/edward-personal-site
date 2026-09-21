#!/bin/zsh
cd "${0:A:h}"
set -e
/usr/bin/python3 scripts/build.py
git add site
if git diff --cached --quiet; then
  echo "没有检测到需要上线的内容变化。"
else
  git commit -m "Update personal site content"
  git push
  echo "已推送，GitHub Pages 会自动更新。"
fi
read -r "reply?按回车关闭窗口…"
