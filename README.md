# gmsinone

GMS 主攻略站与工具入口，站点唯一发布源。

- 主站：https://tools.drytron.net/main/
- 3L 套装求解器：https://tools.drytron.net/tools/3lsolve/
- 根路径 `https://tools.drytron.net/` 会跳到 `/main/`

仓库结构：

- `index.html`：根路径跳转页
- `main/index.html`：主站
- `tools/3lsolve/index.html`：3L 套装求解器

主题约定：

- 全站共用 `localStorage.gms-theme`，取值为 `obsidian` / `ocean` / `forest` / `violet`
- 所有子页面读取同一个值并设置 `documentElement.dataset.theme`
- 新增子页面时必须沿用同一组主题变量和主题入口，不允许各自另起一套配色

GitHub Pages 自定义域：`tools.drytron.net`。
