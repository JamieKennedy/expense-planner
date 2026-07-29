import fs from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

const source = process.env.OPENAPI_URL ?? 'http://localhost:5080/openapi/v1.json'
const ast = await openapiTS(new URL(source))
await fs.writeFile(
  new URL('../src/lib/schema.d.ts', import.meta.url),
  `// Generated from the API OpenAPI document. Do not edit.\n${astToString(ast)}`,
)
