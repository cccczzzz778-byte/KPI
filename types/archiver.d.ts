// archiver (exceljs orqali o'rnatilgan) uchun minimal tiplar.
declare module "archiver" {
  import type { Readable } from "node:stream";
  interface Archiver extends Readable {
    append(source: Readable | Buffer | string, data: { name: string; date?: Date }): this;
    finalize(): Promise<void>;
    abort(): this;
    pointer(): number;
  }
  function archiver(format: "zip", options?: { zlib?: { level?: number }; store?: boolean; forceZip64?: boolean }): Archiver;
  export default archiver;
}
