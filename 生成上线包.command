#!/bin/zsh
cd "${0:A:h}"
/usr/bin/python3 scripts/build.py
read -r "reply?按回车关闭窗口…"
