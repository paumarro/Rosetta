declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';
  import type * as Y from 'yjs';

  export interface YjsPersistenceProvider {
    bindState: (docName: string, ydoc: Y.Doc) => Promise<void>;
    writeState: (docName: string, ydoc: Y.Doc) => Promise<void>;
    provider?: unknown;
  }

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: {
      docName?: string;
      gc?: boolean;
      [key: string]: unknown;
    },
  ): void;

  export function setPersistence(persistence: YjsPersistenceProvider | null): void;
}

declare module 'y-websocket/bin/utils.js' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';
  import type * as Y from 'yjs';

  export interface YjsPersistenceProvider {
    bindState: (docName: string, ydoc: Y.Doc) => Promise<void>;
    writeState: (docName: string, ydoc: Y.Doc) => Promise<void>;
    provider?: unknown;
  }

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: {
      docName?: string;
      gc?: boolean;
      [key: string]: unknown;
    },
  ): void;

  export function setPersistence(persistence: YjsPersistenceProvider | null): void;
}
