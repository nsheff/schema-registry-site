# GA4GH Schema Registry Site

A static site implementation of the [GA4GH Schema Registry specification](https://ga4gh.github.io/schema-registry/) for GKS schemas.

## How it works

1. **`build.py`** reads `registry.yaml` and fetches JSON Schema files from GitHub repos (vrs, gks-core, cat-vrs, va-spec)
2. It generates static JSON files in `api/` matching the Schema Registry API endpoints
3. A React frontend in `frontend/` provides a browsable UI on top of the static API
4. GitHub Actions builds and deploys everything to GitHub Pages

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
