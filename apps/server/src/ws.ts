import type { NorthStarWss } from "@workspace/ws-server";

let _wss: NorthStarWss | null = null;

export function setWss(wss: NorthStarWss): void {
  _wss = wss;
}

export function getWss(): NorthStarWss | null {
  return _wss;
}
