"""Validate the small, public content file before saving or publishing."""
import json
from pathlib import PurePosixPath
from urllib.parse import urlparse


def validate_content(content):
    if not isinstance(content, dict):
        raise ValueError("网站内容必须是一个 JSON 对象")
    for key in ("name", "wordmark", "role", "intro", "aboutTitle", "aboutText", "email"):
        if not isinstance(content.get(key), str) or len(content[key]) > 10000:
            raise ValueError("请检查字段：" + key)
    if not content["name"].strip() or not content["wordmark"].strip():
        raise ValueError("名字和首页大字不能为空")
    if len(content["wordmark"]) > 40:
        raise ValueError("首页大字请控制在 40 个字符以内")
    for key in ("tags", "projects", "socials"):
        if not isinstance(content.get(key), list) or len(content[key]) > 100:
            raise ValueError("请检查列表：" + key)
    if not all(isinstance(tag, str) and len(tag) <= 100 for tag in content["tags"]):
        raise ValueError("标签格式有误")
    seen = set()
    for project in content["projects"]:
        if not isinstance(project, dict):
            raise ValueError("项目格式有误")
        for key in ("id", "title", "englishTitle", "category", "year", "image", "alt", "description", "link"):
            if not isinstance(project.get(key), str) or len(project[key]) > 10000:
                raise ValueError("请检查作品字段：" + key)
        if not project["id"] or project["id"] in seen:
            raise ValueError("作品编号不能为空或重复")
        seen.add(project["id"])
        if not project["title"].strip() or not project["category"].strip():
            raise ValueError("作品名称和分类不能为空")
        for key in ("image", "video", "videoWebm"):
            if project.get(key):
                validate_asset(project[key])
        if project.get("link"):
            validate_url(project["link"])
    if content.get("aboutImage"):
        validate_asset(content["aboutImage"])
    for social in content["socials"]:
        if not isinstance(social, dict) or not isinstance(social.get("label"), str):
            raise ValueError("社交链接名称有误")
        validate_url(social.get("url", ""))
    return content


def validate_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("外部链接需要以 https:// 或 http:// 开头")


def validate_asset(value):
    if not isinstance(value, str):
        raise ValueError("图片或视频地址应为文本")
    if value.startswith("https://"):
        validate_url(value)
        return
    path = PurePosixPath(value)
    if not value.startswith("assets/") or ".." in path.parts or "\\" in value or "?" in value or "#" in value:
        raise ValueError("本地图片和视频必须放在 assets 文件夹内")


def load_content(path):
    return validate_content(json.loads(path.read_text(encoding="utf-8")))
