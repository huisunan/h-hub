export interface SlotKey {
  code: string;
  label: string;
  accel: string;
}

function makeRow(codes: string[]): SlotKey[] {
  return codes.map((code) => {
    if (code.startsWith("Digit")) return { code, label: code.slice(5), accel: code.slice(5) };
    if (code.startsWith("Key")) return { code, label: code.slice(3), accel: code.slice(3) };
    return { code, label: code, accel: code };
  });
}

export const KEY_ROWS: SlotKey[][] = [
  makeRow(["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"]),
  makeRow(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"]),
  makeRow(["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"]),
  makeRow(["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"]),
];

export const ALL_SLOTS: SlotKey[] = KEY_ROWS.flat();

export const SLOT_BY_CODE: Record<string, SlotKey> = Object.fromEntries(
  ALL_SLOTS.map((slot) => [slot.code, slot]),
);

export function slotFromCode(code: string): SlotKey | undefined {
  return SLOT_BY_CODE[code];
}

export function acceleratorFor(code: string, modifier: string): string {
  const slot = SLOT_BY_CODE[code];
  if (!slot) return "";
  return `${modifier}+${slot.accel}`;
}
