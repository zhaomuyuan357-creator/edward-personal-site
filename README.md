# Edward 的个人网站

独立的静态网站，包含个人介绍、照片画廊、视频播放和本机内容编辑器。没有 Framer 依赖，也不需要付费建站套餐。页面使用你的三张照片和一段视频；文案可以继续修改。

## 打开网站、自己修改内容

1. 双击 `预览和编辑.command`，保持弹出的终端窗口开启。
2. 网站预览：<http://127.0.0.1:8765>
3. 内容编辑：<http://127.0.0.1:8765/__editor>
4. 在编辑页面修改介绍、照片、作品说明和联系邮箱，点击「保存到本机」。刷新网站预览，就能看到更新。

若 macOS 不允许双击启动，可在本文件夹的终端运行：

```sh
python3 scripts/serve.py
```

关闭终端会停止本机预览，不会影响已上线的网站。编辑器只监听本机，且不会打包发布。上传图片支持 JPG、PNG、WebP，视频推荐 H.264/AAC 编码的 MP4；单文件请小于 25 MB。网页视频默认不会自动下载、播放或出声。

也可以直接编辑 `site/content.json`。媒体文件在 `site/assets/`；请勿放入不打算公开的素材。

## 免费上线：Cloudflare Pages

1. 双击 `生成上线包.command`，或运行 `python3 scripts/build.py`。
2. 在 Cloudflare 控制台进入 **Workers & Pages → Create application → Pages → Upload assets**（名称可能随控制台更新）。
3. 为项目取一个名字，上传生成的 `edward-site.zip`，完成部署。
4. Cloudflare 会提供一个可公开访问的 `项目名.pages.dev` 网址。
5. 后续修改内容后，重新生成上线包，在同一项目中创建新部署即可更新网址上的内容。

不需要购买域名也能上线。以后购买域名后，在该 Pages 项目 **Custom domains** 中添加，再按界面提示设置 DNS。绑定根域名通常需要把域名 DNS 托管到 Cloudflare；子域名可以根据提示配置 CNAME。请先在 Pages 内添加域名，再改 DNS。使用情况受 Cloudflare 当前免费额度和服务条款约束；域名本身通常按年续费。

也可在 Cloudflare Pages 连接 Git 仓库：构建命令填写 `python3 scripts/build.py`，输出文件夹填写 `dist`。如果使用 Wrangler 命令行，项目配置见 `wrangler.jsonc`。

## 备用上线方式：GitHub Pages

仓库内提供了 `.github/workflows/pages.yml`。在你自己的仓库中将 **Settings → Pages → Source** 设为 **GitHub Actions**，推送到 `main` 后会自动构建和部署。GitHub 免费账号一般需要公开仓库来使用 Pages；Cloudflare 直接上传方案不需要公开源码仓库。

## 文件说明

- `site/`：真正的网站文件，部署时只发布这里生成的内容。
- `site/content.json`：你的名字、文案、项目和公开联系方式。
- `site/assets/`：照片、视频、封面和网站图标。
- `tools/editor.html`、`scripts/serve.py`：仅供本机使用的编辑器。
- `scripts/build.py`：校验媒体文件、生成搜索预览文字，并打包网站。
- `dist/`、`edward-site.zip`：生成的上线文件，不包含编辑器或本机原始文件路径。

网页里的三张图片已经压成 WebP，视频保留 H.264/AAC 编码，处理了流式加载位置。原始照片和视频没有改动。项目配文是初稿，未填写拍摄日期、地点或虚构的职业经历。联系邮箱尚未提供，可以在本机编辑器补上。
