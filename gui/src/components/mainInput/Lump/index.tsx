import { LumpToolbar } from "./LumpToolbar/LumpToolbar";

/**
 * Simplified toolbar component that only shows the toolbar without expansion.
 * LumpToolbar owns its own container (and renders nothing when idle), so the
 * config-options bar no longer shows above the chat input.
 */
export function Lump() {
  return <LumpToolbar />;
}
