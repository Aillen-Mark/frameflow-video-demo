declare namespace Cloudflare {
  interface Env {
    VIDEO_CONFIG_KEY: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
