# 止痕 Trace Off

> 轻量级浏览器扩展，按域名禁止浏览器保存历史记录。

[![Version](https://img.shields.io/badge/version-1.0.4-blue)](https://github.com/Only-233/trace-off)

---

## 📸 界面截图

![alt text](/test-pages/image1.png)
![alt text](/test-pages/image2.png)
![alt text](/test-pages/image3.png)


## ✨ 功能

- **域名管理** — 支持顶级域名、多级子域名、localhost 及端口号
- **快捷添加** — 弹窗一键添加，域名可编辑后再确认
- **灵活控制** — 每个域名独立开关 + 插件全局总开关
- **批量操作** — 全选 / 批量启用 / 禁用 / 删除
- **清空历史** — 按域名搜索并清空历史记录（多选 + 二次确认）
- **隐私安全** — 全部数据本地存储，开源可审查

---

## 🚀 安装

```bash
git clone https://github.com/Only-233/trace-off.git
```

打开 `chrome://extensions/` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择目录。

兼容 Chrome / Edge 88+（Manifest V3）。

---

## 📁 结构

```
trace-off/
├── manifest.json
├── background/service-worker.js   # 历史拦截 + 总开关
├── popup/                          # 快捷添加弹窗
├── options/                        # 设置页（域名管理 + 关于）
├── icons/                          # SVG 图标
└── README.md
```

---

## 🔌 技术

| API | 用途 |
|-----|------|
| `chrome.history.onVisited` + `deleteUrl` | 拦截并删除历史记录 |
| `chrome.history.search` | 搜索并清空历史 |
| `chrome.storage.local` | 本地持久化 |
| `chrome.tabs` | 获取标签页 URL |

域名匹配：精确 + 子域名后缀，`example.com` 同时覆盖 `www.example.com`。

---

## 👤 作者

**Goooonly**

- GitHub: [Only-233/trace-off](https://github.com/Only-233/trace-off)
- Gitee: [GoKun/trace-off](https://gitee.com/GoKun/trace-off)

---

MIT License
