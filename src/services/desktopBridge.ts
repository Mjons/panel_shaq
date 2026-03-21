const WS_PORT = 9876;
const WS_URL = `ws://localhost:${WS_PORT}`;
const PROBE_TIMEOUT = 1500;

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

/** Send project data to Panelhaus Desktop via WebSocket */
export async function sendToDesktop(comicData: string): Promise<boolean> {
  try {
    const ws = new WebSocket(WS_URL);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.onopen = () => {
        ws.send(comicData);
        clearTimeout(timer);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}
