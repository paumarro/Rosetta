declare module 'y-mongodb' {
  import type * as Y from 'yjs';

  export class MongodbPersistence {
    constructor(url: string, collection: string);
    getYDoc(docName: string): Promise<Y.Doc>;
    storeUpdate(docName: string, update: Uint8Array): Promise<void>;
    clearDocument(docName: string): Promise<void>;
  }
}
