# 止痕（Trace Off）

> 一个轻量级浏览器扩展，让你可以按域名禁止浏览器保存历史记录。

---

## ✨ 功能特性

### 🔧 域名管理
- 在设置页面手动添加 / 编辑 / 删除域名
- 同时支持 **顶级域名**（`example.com`）和 **多级子域名**（`sub.example.com`）
- 顶级域名自动覆盖所有子域名，无需逐一添加

### ⚡ 快捷添加
- 点击插件图标，弹窗即时显示当前页面域名
- 域名**可编辑**后再添加（如将 `www.example.com` 改成 `example.com`）
- 体验如同保存书签一般简单自然

### 🎛 灵活控制
- **每个域名独立开关**，可随时启用或暂停屏蔽
- **插件总开关**，一键全局开启 / 关闭所有拦截
- 配置实时生效，无需刷新页面

### 📋 批量操作
- 全选复选框 + 多选功能
- 批量启用、禁用、删除选中域名
- 操作按钮常驻，选中即用

### 🔒 隐私安全
- 全部数据**本地存储**，不上传任何信息
- 开源透明，代码可审查

---

## 📸 界面

| 弹窗 | 设置页 |
|:---:|:---:|
| 快捷添加 / 移除域名 | 域名管理 + 批量操作 + 关于 |
| 域名可编辑 + 总开关 | 全选 / 编辑 / 开关 / 删除 |

---

## 🚀 安装使用

### 开发模式加载

1. 克隆项目
   ```bash
   git clone https://github.com/Only-233/trace-off.git
   ```

2. 打开 Chrome 浏览器，进入 `chrome://extensions/`

3. 开启右上角「**开发者模式**」

4. 点击「**加载已解压的扩展程序**」，选择 `trace-off` 目录

5. 插件图标出现在工具栏，即可使用

### 兼容性

- Chrome 88+
- Edge 88+
- 其他 Chromium 内核浏览器（Manifest V3）

---

## 📁 项目结构

```
trace-off/
├── manifest.json              # 扩展清单（Manifest V3）
├── background/
│   └── service-worker.js      # 后台服务（历史记录拦截 + 总开关）
├── popup/
│   ├── popup.html             # 弹窗页面（快捷添加 + 总开关）
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html           # 设置页面（域名管理 + 关于）
│   ├── options.css
│   └── options.js
├── icons/                     # 插件图标（SVG）
├── test-pages/                # 本地测试页面
└── README.md
```

---

## 🔌 技术实现

| API | 用途 |
|-----|------|
| `chrome.history.onVisited` | 监听浏览器历史记录写入 |
| `chrome.history.deleteUrl` | 拦截匹配域名时删除记录 |
| `chrome.storage.local` | 本地持久化域名配置 + 总开关状态 |
| `chrome.tabs` | 获取当前标签页 URL 和域名 |

**域名匹配规则**：精确匹配 + 子域名后缀匹配，`example.com` 会同时覆盖 `www.example.com`、`api.example.com` 等。

---

## 👤 作者

**Goooonly** — 注重隐私、专注效率工具的开发者

- GitHub: [github.com/Only-233/trace-off](https://github.com/Only-233/trace-off)
- Gitee: [gitee.com/GoKun/trace-off](https://gitee.com/GoKun/trace-off)

---

## 📄 开源协议

MIT License

---

*止痕 — 你的浏览记录，由你做主。*
