# GA4GH Schema Registry Site

A static site implementation of the [GA4GH Schema Registry specification](https://ga4gh.github.io/schema-registry/) for GKS schemas.

## How it works

1. **`build.py`** reads `registry.yaml` and fetches JSON Schema files from GitHub repos (vrs, gks-core, cat-vrs, va-spec)
2. It generates static JSON files in `api/` matching the Schema Registry API endpoints
3. A React frontend in `frontend/` provides a browsable UI on top of the static API
4. GitHub Actions builds and deploys everything to GitHub Pages

## Deployment

### Two deployment targets

The site is deployed to two hosting providers in parallel:

- **GitHub Pages**: https://nsheff.github.io/schema-registry-site/
- **Cloudflare Pages**

This is intentional. The site acts as a testbed to compare static site hosting providers and verify that the GA4GH Schema Registry spec works correctly across different infrastructure.

### Deployment workflows

Builds are triggered two ways:

- **`workflow_dispatch`**: manual trigger via the GitHub Actions UI or `gh workflow run`
- **`schedule`**: weekly cron (Mondays 6am UTC) that auto-rebuilds to pick up upstream schema changes. This matters for FAIRtracks, which is tracked by branch HEAD rather than a pinned tag, so its content can drift between releases.

## Local development

```bash
# Build the API
pip install pyyaml requests
python build.py

# Build and serve the frontend
cd frontend
npm install
npm run dev
```

## Endpoints served

| Endpoint | File |
|----------|------|
| GET /namespaces | `api/namespaces/index.json` |
| GET /schemas/{namespace} | `api/schemas/{ns}/index.json` |
| GET /schemas/{ns}/{schema}/versions | `api/schemas/{ns}/{schema}/versions/index.json` |
| GET /schemas/{ns}/{schema}/versions/{ver} | `api/schemas/{ns}/{schema}/versions/{ver}/index.json` |
| GET /schemas/{ns}/{schema}/versions/{ver}/components | `api/schemas/{ns}/{schema}/versions/{ver}/components/index.json` |
| GET /schemas/{ns}/{schema}/versions/{ver}/components/{name} | `api/schemas/{ns}/{schema}/versions/{ver}/components/{name}.json` |
