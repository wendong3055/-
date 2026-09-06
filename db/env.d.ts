declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    RUNNINGHUB_API_KEY?: string;
  }
}
