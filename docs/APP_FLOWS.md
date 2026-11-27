# Web app flows

Each box pairs a screen with its canonical URL. Arrows show selected user journeys, not React Router nesting or every available link. The sources of truth are [the screen bindings](../src/tsx/App.tsx) and [the route patterns](../src/lib/routes.ts).

## Discover, read, and build

```mermaid
flowchart TD
    Home["Landing · /"]
    Home --> Library["Biblioteca · /biblioteca"]
    Home --> Builder["Caderninho builder · /montar"]
    Home --> Articles["Articles · /artigos"]
    Articles --> Article["Article · /artigos/:slug"]
    Home --> Info["Help / About / Contribute · /ajuda · /sobre · /contribua"]
    Home --> Reader["Public songbook reader · /:slug/:songbookSlug"]
    Library --> Reader
    Builder -->|"Save to a project"| Manage["Manage songbook · /:slug/:songbookSlug/gerenciar"]
```

## Projects, scores, and review

```mermaid
flowchart TD
    Projects["My projects · /projetos"]
    Projects --> New["Create project · /projetos/novo"]
    New -->|"After creation"| Settings["Project settings · /:slug/config"]
    Projects --> Project["Project overview · /:slug"]
    Projects --> Settings
    Project -->|"Open public songbook"| Reader["Public songbook reader · /:slug/:songbookSlug"]
    Project -->|"Manage or create a songbook"| Manage["Manage songbook · /:slug/:songbookSlug/gerenciar"]
    Manage -->|"View public page"| Reader
    Manage -->|"Review a pinned score"| Review["Songbook score review · /:slug/:songbookSlug/gerenciar/partituras/:scoreId"]
    Project --> Score["Score detail · /partituras/:scoreId"]
    Upload["Browser upload · /:slug/enviar"] -->|"View uploaded score"| Revision["Score detail, specific revision · /partituras/:scoreId/versoes/:revisionId"]
    Upload -->|"Back to project"| Project
    Upload -->|"Send with the desktop Exportador"| Exporter["Exportador download and link · /:slug/exportador"]
    Exporter -->|"Back to browser upload"| Upload
```

- **Flags and access:** Project and songbook routes are registered only with `FEATURE_FLAG_COLLAB_FLOW`; browser upload additionally requires `FEATURE_FLAG_BROWSER_UPLOAD`. The Exportador page is registered with the project routes; it downloads the desktop app (latest GitHub release) and opens or copies the `cadernin-export://` link for the same upload context. Route registration is not permission to view or edit a resource. The two score detail URLs render the same `ScorePage`; the explicit revision URL selects a specific revision. Songbook review is separate and shows the score in the context of that songbook.
- **Same URL, different state:** Sign-in and profile/inbox open as app-level modals, not routes. File, parts, metadata, formatting, and submission are steps within the upload route.
- **Fallback:** Unmatched URLs show Not Found. Legacy year-only links redirect to `/` when handled by the SPA and no static page takes precedence; reserved names cannot resolve as project slugs.
