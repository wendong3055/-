declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    RUNNINGHUB_API_KEY?: string;
    RUNNINGHUB_CN_API_KEY?: string;
    CREDENTIAL_ENCRYPTION_KEY?: string;
  }
}
