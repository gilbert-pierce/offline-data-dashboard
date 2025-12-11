# 数据看板 EXE 打包指南 (Tauri 方案)

本文档将指导你如何将现有的 React 代码从 CDN 依赖转换为本地离线依赖，并打包成一个在 Windows 10 x64 上运行的独立 EXE 文件。

## 1. 环境准备 (Prerequisites)

在开始之前，请确保电脑已安装：

1.  **Node.js** (建议 v18 或更高): [下载地址](https://nodejs.org/)
2.  **Rust 语言环境** (Tauri 依赖):
    *   下载并运行 [Rustup-init.exe](https://win.rustup.rs/)。
    *   安装通过后，在终端输入 `rustc --version` 确认安装成功。
3.  **Microsoft Visual Studio C++ 生成工具**:
    *   通常安装 Rust 时会提示安装。如果没有，需下载 "Build Tools for Visual Studio 2022"，勾选 "C++ 桌面开发"。

---

## 2. 初始化项目结构

我们需要创建一个标准的 Vite + React + TypeScript 项目结构，并将现有代码移入其中。

### 第一步：创建空项目
打开命令行（CMD 或 PowerShell）：

```bash
# 1. 创建项目 (使用 vite 模板)
npm create vite@latest offline-dashboard -- --template react-ts

# 2. 进入目录
cd offline-dashboard

# 3. 安装依赖 (这一步将把 React 等库下载到本地，不再依赖 esm.sh)
npm install
npm install recharts lucide-react react-grid-layout lodash xlsx clsx tailwind-merge react-resizable
npm install -D tailwindcss postcss autoprefixer @types/lodash @types/react-grid-layout @types/react-resizable
```

### 第二步：配置 Tailwind CSS
```bash
npx tailwindcss init -p
```
修改 `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```
修改 `src/index.css`，在顶部添加：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 3. 迁移现有代码

将您现有的代码文件复制到新项目的 `src` 文件夹中。

1.  **删除** `src` 下原有的 `App.css`, `App.tsx`, `main.tsx` (或 `index.tsx`)。
2.  **创建目录**: 在 `src` 下创建 `components` 和 `lib` 文件夹。
3.  **复制文件**:
    *   将原 `App.tsx` -> `src/App.tsx`
    *   将原 `index.tsx` -> `src/main.tsx` (注意 Vite 默认入口通常叫 main.tsx，需确保引入 css)
    *   将原 `components/*` -> `src/components/*`
    *   将原 `lib/*` -> `src/lib/*`
4.  **修正入口文件 (`src/main.tsx`)**:
    确保顶部包含样式引入：
    ```tsx
    import React from 'react'
    import ReactDOM from 'react-dom/client'
    import App from './App'
    import './index.css' // 引入 Tailwind
    // ... rest of the code
    ```

---

## 4. 初始化 Tauri (打包配置)

在 `offline-dashboard` 项目根目录下：

```bash
# 初始化 Tauri
npm install -D @tauri-apps/cli
npx tauri init
```

执行 `init` 时，直接按回车使用默认设置，但注意以下问题：
*   **Where are your web assets?**: 输入 `dist`
*   **Url of your dev server?**: 输入 `http://localhost:5173`
*   **What is your frontend build command?**: 输入 `npm run build`

---

## 5. 本地调试与打包

### 开发模式 (测试)
```bash
npx tauri dev
```
这将启动一个本地窗口，你应该能看到看板界面。如果报错，通常是 TypeScript 类型问题，请根据提示修复（或在 tsconfig.json 中设置 `"noEmit": true` 忽略严格检查）。

### 正式打包 (生成 EXE)
```bash
npx tauri build
```
*   **注意**: 第一次打包会下载一些 Rust 依赖，速度可能较慢，请耐心等待。
*   打包完成后，控制台会显示 EXE 的路径。
*   **输出路径**: 通常在 `src-tauri/target/release/bundle/nsis/` 下。

你将看到一个 `.exe` 安装包（Setup）和一个直接运行的 `.exe` 程序。

---

## 6. 常见问题排查

**Q: 打开 EXE 白屏？**
*   检查 `tauri.conf.json` 中的 `identifier` 是否已修改（不能是默认的 `com.tauri.dev`）。
*   按 `F12` (如果是开发包) 或右键检查元素，看控制台是否有 JS 错误。

**Q: 拖拽功能失效？**
*   Tauri 窗口默认会拦截部分拖拽事件。确保你的拖拽库（react-grid-layout）只在特定的 handle 上触发。目前的 CSS `.draggable-handle` 已经处理了这个问题。

**Q: 提示 "WebView2 not found"？**
*   Windows 10/11 通常自带 WebView2。如果是老版本 Win10 或 Win7，用户需要安装 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)。Tauri 安装包可以配置自动下载这个运行时。

---

## 7. 补充说明：架构兼容性与离线确认

### 7.1 是否支持无网运行？
**完全支持。**
只要您按照第 2 步执行了 `npm install` 并使用 `tauri build` 打包，所有依赖（React, Recharts 等）都会被编译到本地 EXE 文件中。
*   **效果**：软件在没有任何网络连接的电脑上打开，功能与开发时完全一致。
*   **区别**：目前的 index.html 使用了 CDN (esm.sh)，而打包后的版本使用本地 node_modules，彻底去除了网络依赖。

### 7.2 Windows 系统架构处理 (Win10 x64 vs x86)
默认情况下，`tauri build` 会根据您当前的电脑架构生成 EXE。

*   **Win10 x64 (推荐)**:
    *   绝大多数现代电脑（Win10/Win11）都是 64 位架构。
    *   在 64 位电脑上打包生成的 EXE，可以在所有 Win10 64 位系统上运行。
    *   **注意**: 64 位 EXE 无法在古老的 32 位系统上运行。

*   **Win10 x86 (32位)**:
    *   如果您确实需要支持 32 位老旧设备，需要为 Rust 添加 32 位编译目标：
        ```bash
        rustup target add i686-pc-windows-msvc
        ```
    *   然后使用指定目标进行打包：
        ```bash
        npx tauri build --target i686-pc-windows-msvc
        ```

*   **WebView2 运行时**:
    *   Tauri 依赖 WebView2 组件（Win10/11 通常自带）。
    *   如果目标机器提示缺失组件，请下载微软官方的 **Evergreen Bootstrapper** 安装包。它只有几 MB，运行时会自动检测系统架构（x64/x86）并安装正确的文件。
