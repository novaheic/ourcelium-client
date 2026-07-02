import { useContext, useEffect, useState } from "react";
import { vscButtonBackground, vscButtonForeground } from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";
import { varWithFallback } from "../styles/theme";

export function OurceliumSignInBanner() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every sign-in/out path (this banner, settings, the stream-error dialog)
  // reloads the config, so re-check auth whenever config changes — that way a
  // sign-in triggered elsewhere makes this banner disappear without a reload.
  const config = useAppSelector((state) => state.config.config);

  useEffect(() => {
    void ideMessenger
      .request("ourceliumAuthStatus", undefined)
      .then((result) => {
        setSignedIn(result.status === "success" ? result.content : false);
      });
  }, [ideMessenger, config]);

  if (signedIn === null || signedIn) {
    return null;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    const result = await ideMessenger.request("ourceliumSignIn", undefined);
    setSigningIn(false);
    if (result.status === "success" && result.content.success) {
      setSignedIn(true);
    } else {
      setError(
        result.status === "success"
          ? (result.content.error ?? "Sign-in failed")
          : result.error,
      );
    }
  };

  return (
    <div className="px-4 py-4">
      <div
        className="border-info relative rounded-md border-[0.5px] border-solid px-3 py-2.5 shadow-sm"
        style={{
          backgroundColor: `color-mix(in srgb, ${varWithFallback("info")} 20%, transparent)`,
        }}
      >
        <div className="flex flex-col gap-1.5 text-xs">
          <p>Sign in to Ourcelium to start chatting.</p>
          {error && <p className="text-red-400">{error}</p>}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="cursor-pointer rounded border-none px-2 py-1 text-[11px] font-medium hover:brightness-125 disabled:cursor-default disabled:opacity-50"
            style={{
              backgroundColor: vscButtonBackground,
              color: vscButtonForeground,
            }}
          >
            {signingIn ? "Waiting for sign-in..." : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
