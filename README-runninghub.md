# RunningHub image composition

This update preserves the existing Site, artwork/frame/color libraries and storage bindings. It replaces the old OpenAI image-edit call with the RunningHub standard image-to-image API. No live provider request was made during development.

## Before using

1. Configure `RUNNINGHUB_API_KEY` as a secret in this Site's production environment settings. Do not put it in client code, source control, prompts or chat. The existing `OPENAI_API_KEY` is untouched and no longer used by the new generation route.
2. This adapter uses `https://www.runninghub.ai`. Confirm the key and account have access to this international-site model. The CN model page directs visitors to `.ai`; that notice alone does not verify CN-key compatibility.
3. Publish the saved update when ready. Saving code alone does not change the live Site. Additive migrations create `generation_tasks` and add nullable `products.sample_asset_id`; existing tables and assets are retained.
4. Check the configuration indicator, then explicitly submit one sample. This spends RunningHub API credit; key presence is not a connection test. No price is hard-coded.

## Supported first slice

- Frame image (optional) plus artwork, selected wood color, optional extra instructions.
- GPT Image 2 official-stable image-to-image, fixed **16:9 / 2k / medium**, one task per click. These are the verified example values; other endpoint enums were not reliably retrievable, so they are not exposed as supported controls.
- Upload, submit, poll, persist the actual image in existing R2 storage, and store owner-scoped metadata in D1.
- Task history survives reload. Browser polling resumes on open/focus; the model runs remotely while the page is closed, but local result archival resumes only when the Site is opened and polled. This is not a background worker/cron pipeline.
- Stops polling after 20 minutes; the user can resume without submitting another generation.
- Submission IDs are idempotent. A database-enforced active-task lock and expiring poll lease protect repeated clicks/tabs. A submission timeout is treated as unknown and is not retried automatically. Unlock only after the user verifies that no upstream task was created.
- Successful images can be viewed/downloaded, then associated with a confirmed product. Subsequent main-image, size-image and detail-page records are plans only, not implemented automatic batch generation.
- Workbench reference limit: 10 MB each, 22 MB total; archived output limit: 30 MB. These are application limits, not claims about RunningHub's V2 maximums.
- Result downloads accept only HTTPS, known RunningHub domains and the exact documented object-storage hosts. No redirects or credentials accompany downloads. New upstream CDN hosts require deliberate allowlist review.

## API references

- [Image-to-image model](https://www.runninghub.ai/runninghub-api-doc-en/api-448969336): `POST /openapi/v2/rhart-image-g-2-official/image-to-image`, Bearer key, `{prompt,imageUrls,aspectRatio,resolution,quality}`.
- [Upload](https://www.runninghub.ai/runninghub-api-doc-en/api-425761098): `POST /openapi/v2/media/upload/binary`, multipart `file`; response `code:200`, `data.download_url`.
- [Query](https://www.runninghub.cn/runninghub-api-doc-cn/api-425767306): `POST /openapi/v2/query`, `{taskId}`; top-level `status`, `results[].url`, `results[].outputType`, `errorCode`, `errorMessage`. Do not use the legacy nested `data/taskStatus` envelope.
- [Model errors](https://www.runninghub.cn/runninghub-api-doc-cn/doc-8435517).
- [CN migration notice](https://www.runninghub.cn/call-api/api-detail/2046514150500524035).

## Offline verification

`node tests/runninghub.integration.mjs` uses in-memory SQLite, mocked R2 and a fetch stub that blocks all unexpected network requests. It checks actual migration application, auth/owner separation, provider payloads, duplicate/active-task protection, task state and result archival, unknown submission handling, parameter and result-URL validation. Node 24 and the existing esbuild dependency are used. Run the normal TypeScript check and Sites build separately.

Remaining live validation: international API-key permissions, actual reference acceptance, model response/quality, fees, result CDN compatibility, and production environment/migration application. Browser visual QA was not requested and was not run.
