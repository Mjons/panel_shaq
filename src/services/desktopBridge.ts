const WS_PORT = 9876;
const WS_URL = `ws://127.0.0.1:${WS_PORT}`;
const PROBE_TIMEOUT = 1500;
const SEND_TIMEOUT = 10000;

let _desktopAvailable: boolean | null = null;

/** Check if Panelhaus Desktop is running by probing the WebSocket */
export async function isDesktopAvailable(): Promise<boolean> {
  if (_desktopAvailable !== null) return _desktopAvailable;

  try {
    const result = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, PROBE_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });

    _desktopAvailable = result;
    return result;
  } catch {
    _desktopAvailable = false;
    return false;
  }
}

/** Reset the cached detection (e.g., user clicked "Try Again") */
export function resetDesktopDetection() {
  _desktopAvailable = null;
}

/** Send project data to Panelhaus Desktop via WebSocket.
 *  Waits for an ack response from Desktop before resolving. */
export async function sendToDesktop(
  comicData: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const ws = new WebSocket(WS_URL);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.close();
        resolve({ success: false, error: "Connection timed out" });
      }, SEND_TIMEOUT);

      ws.onopen = () => {
        ws.send(comicData);
      };

      ws.onmessage = (event) => {
        clearTimeout(timer);
        try {
          const response = JSON.parse(event.data);
          ws.close();
          if (response.status === "ok") {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: response.message || "Desktop rejected the project",
            });
          }
        } catch {
          ws.close();
          resolve({ success: true }); // Got a response, assume ok
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: "Could not connect to Panelhaus Desktop",
        });
      };

      // If connection closes without a message response, treat send as success
      // (older Desktop versions may not send ack)
      ws.onclose = () => {
        clearTimeout(timer);
      };
    });
  } catch {
    return { success: false, error: "WebSocket error" };
  }
}
