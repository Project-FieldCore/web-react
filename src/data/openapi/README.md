# OpenAPI mocks (vendored)

Canonical sample payload from [Project-FieldCore/api-java](https://github.com/Project-FieldCore/api-java)
`openapi/mocks/fieldops-v1.json` (PBI-0006 / PR #100).

Do **not** invent divergent cadastro shapes here. When the API updates the
canonical file, copy it again into this folder.

Contract fields use English names and UUID ids (`name`, `status: ACTIVE|…`).
Domain adapters in `../contract-mocks.ts` map to the painel types (`nome`, `ativo`, …).
