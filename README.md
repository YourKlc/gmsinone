# gmsinone

GMS 主攻略站与工具入口，站点唯一发布源。

- 主站：`/main/`
- Q区套装毕业词条求解器：`/tools/3lsolve/`
- 根路径 `/` 跳 `/main/`

仓库结构：

- `index.html`：根路径跳转页
- `main/index.html`：主站
- `tools/3lsolve/index.html`：Q区套装毕业词条求解器

主题约定：

- 全站共用 `localStorage.gms-theme`，默认 `day`，可取值为 `day` / `night` / `obsidian` / `ocean` / `forest` / `violet`
- 所有子页面读取同一个值并设置 `documentElement.dataset.theme`
- 新增子页面时必须沿用同一组主题变量和主题入口，不允许各自另起一套配色
