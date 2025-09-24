declare module 'y-mongodb' {
  export class MongoDBPersistence {
    constructor(url: string);
    bindState(docName: string, ydoc: unknown): Promise<unknown>;
    writeState(docName: string, ydoc: unknown): Promise<unknown>;
  }
}
