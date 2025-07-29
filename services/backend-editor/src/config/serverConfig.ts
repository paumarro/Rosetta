import { createServer as createNetServer } from 'net';

// Function to find an available port
export const findAvailablePort = async (startPort: number): Promise<number> => {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const testServer = createNetServer()
        .once('error', (): void => {
          resolve(false);
        })

        .once('listening', (): void => {
          testServer
            .once('close', (): void => {
              resolve(true);
            })
            .close();
        })
        .listen(port);
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
};
