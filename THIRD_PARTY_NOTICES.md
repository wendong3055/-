# RunningHub official example reuse

- Repository: https://github.com/HM-RunningHub/RH_CLI
- Pinned commit: `0ed2b31d50fbfef114304fae78d24d4c9e371b68`
- License: Apache-2.0, copied in `licenses/RH_CLI-Apache-2.0.txt`.
- Source: `src/rh_cli/poll.py` and the AI-app contract in `src/rh_cli/app/client.py`.
- Adaptation: `lib/runninghub-member-query.ts` replaces deprecated task/status polling with V2 query. It keeps requests in the authenticated server, normalizes image results, and leaves retry timing and task persistence with this workbench. It never re-submits a billable generation.
- Metadata contract: GET `api/webapp/apiCallDemo`; apiKey and webappId are server-only query parameters. Upstream executable curl/examples are never executed.
- V2 binary upload is retained per current official documentation; older GitHub upload snippets are not copied.
- Verification: `tests/member-provider-contract.test.mjs` runs the adapted contract with deterministic responses, without credentials or paid tasks. This does not certify a live account's API entitlement or generation quality.

Official documentation checked 2026-09-09:

- https://www.runninghub.cn/runninghub-api-doc-cn/api-425749011
- https://www.runninghub.cn/runninghub-api-doc-cn/api-425749007
- https://www.runninghub.cn/runninghub-api-doc-cn/api-425749010
- https://www.runninghub.cn/runninghub-api-doc-cn/api-425767306
