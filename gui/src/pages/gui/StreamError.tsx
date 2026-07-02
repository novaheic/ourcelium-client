import {
  ArrowPathIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  Cog6ToothIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { useContext, useMemo, useState } from "react";

import { GhostButton } from "../../components";
import { useEditModel } from "../../components/mainInput/Lump/useEditBlock";
import { useMainEditor } from "../../components/mainInput/TipTapEditor";
import ToggleDiv from "../../components/ToggleDiv";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { analyzeError } from "../../util/errorAnalysis";

interface StreamErrorProps {
  error: unknown;
}

const StreamErrorDialog = ({ error }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const { refreshProfiles } = useAuth();
  const { mainEditor } = useMainEditor();

  const {
    parsedError,
    statusCode,
    message,
    modelTitle,
    providerName,
    apiKeyUrl,
    helpUrl,
    customErrorMessage,
    usageLimit,
  } = useMemo(() => analyzeError(error, selectedModel), [error, selectedModel]);

  const handleRefreshProfiles = () => {
    void refreshProfiles("Clicked reload config from stream error dialog");
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  // A 401 from our gateway means the stored key is gone/invalid — i.e. the user
  // is signed out. Surface the sign-in flow directly instead of the generic
  // "invalid API key" provider troubleshooting.
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    const result = await ideMessenger.request("ourceliumSignIn", undefined);
    setSigningIn(false);
    if (result.status === "success" && result.content.success) {
      // Pick up the freshly written key and dismiss the dialog.
      void refreshProfiles("Signed in from stream error dialog");
      dispatch(setShowDialog(false));
      dispatch(setDialogMessage(undefined));
    } else {
      setSignInError(
        result.status === "success"
          ? (result.content.error ?? "Sign-in failed")
          : result.error,
      );
    }
  };

  const copyErrorToClipboard = () => {
    void navigator.clipboard.writeText(parsedError);
  };

  const history = useAppSelector((store) => store.session.history);

  const checkKeysButton = apiKeyUrl ? (
    <GhostButton
      className="flex items-center"
      onClick={() => ideMessenger.ide.openUrl(apiKeyUrl)}
    >
      <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>Check API key</span>
    </GhostButton>
  ) : null;

  const handleEditModel = useEditModel();

  const configButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => handleEditModel(selectedModel)}
    >
      <Cog6ToothIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>View config</span>
    </GhostButton>
  );

  const resubmitButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => {
        let index = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (
            history[i].message.role === "user" ||
            history[i].message.role === "tool"
          ) {
            index = i;
            break;
          }
        }

        if (!mainEditor) {
          console.error("Main editor not found, cannot resubmit message.");
          return;
        }

        const editorState =
          index === -1 ? mainEditor.getJSON() : history[index].editorState;

        void dispatch(
          streamResponseThunk({
            editorState,
            modifiers: {
              noContext: true,
              useCodebase: false,
            },
            index: index === -1 ? 0 : index,
          }),
        );
        dispatch(setShowDialog(false));
        dispatch(setDialogMessage(undefined));
      }}
    >
      <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>Resubmit last message</span>
    </GhostButton>
  );

  let errorContent = (
    <div className="mb-1 mt-3">
      <div className="m-0 p-0">
        <p className="m-0 mb-2 p-0">
          There was an error handling the response from{" "}
          {selectedModel?.title || "the model"}.
        </p>
        <p className="m-0 p-0">Please try to submit your message again.</p>
        <div className="mt-3">{resubmitButton}</div>
      </div>
    </div>
  );

  // Display components for specific errors
  if (statusCode === 429) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {`This might mean your ${modelTitle} usage has been rate limited
                by ${providerName}.`}
        </span>
        <div className="flex flex-row flex-wrap justify-start gap-3 py-4">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 404) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>Likely causes:</span>
        <ul className="m-0">
          <li>
            <span>Invalid</span>
            <code>apiBase</code>
            {selectedModel && (
              <>
                <span>{`: `}</span>
                <code>{selectedModel.apiBase}</code>
              </>
            )}
          </li>
          <li>
            <span>Model/deployment not found</span>
            {selectedModel && (
              <>
                <span>{` for: `}</span>
                <code>{selectedModel.model}</code>
              </>
            )}
          </li>
        </ul>
        <div>{configButton}</div>
      </div>
    );
  }

  const isSignedOut = statusCode === 401;

  if (isSignedOut) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>You've been signed out. Sign in to keep chatting.</span>
        {signInError && <span className="text-error">{signInError}</span>}
        <div className="flex flex-row flex-wrap gap-2 pt-1">
          <GhostButton
            className="flex items-center"
            onClick={() => void handleSignIn()}
            disabled={signingIn}
          >
            <ArrowRightEndOnRectangleIcon className="mr-1.5 h-3.5 w-3.5" />
            <span>{signingIn ? "Waiting for sign-in…" : "Log in"}</span>
          </GhostButton>
        </div>
      </div>
    );
  }

  if (statusCode === 403) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`Likely cause: not authorized to access the model deployment.`}</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (
    message &&
    (message.toLowerCase().includes("overloaded") ||
      message.toLowerCase().includes("malformed json"))
  ) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`Most likely, the provider's server(s) are overloaded and streaming was interrupted. Try again later`}</span>
        {selectedModel ? (
          <span>
            {`Provider: `}
            <code>{selectedModel.underlyingProviderName}</code>
          </span>
        ) : null}
      </div>
    );
  }

  // Custom error message from error analysis (e.g. invalid API key, insufficient balance)
  if (customErrorMessage) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{customErrorMessage}</span>
        <div className="flex flex-row flex-wrap justify-start gap-3 py-2">
          {helpUrl && (
            <GhostButton
              className="flex items-center"
              onClick={() => ideMessenger.ide.openUrl(helpUrl)}
            >
              <ArrowTopRightOnSquareIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>View help documentation</span>
            </GhostButton>
          )}
          {apiKeyUrl && (
            <GhostButton
              className="flex items-center"
              onClick={() => ideMessenger.ide.openUrl(apiKeyUrl)}
            >
              <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>Check API key</span>
            </GhostButton>
          )}
          {configButton}
        </div>
      </div>
    );
  }

  // Ourcelium usage cap reached (429 usage_limit_reached). Overrides the generic
  // 429 "rate limited" content above with an actionable upgrade / top-up prompt.
  if (usageLimit) {
    const isUpgrade = usageLimit.kind === "upgrade";
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {isUpgrade
            ? "You've used all the tokens included in your free plan for this period."
            : "You've used all your included tokens and your credit balance is empty."}
        </span>
        {usageLimit.resetAt && (
          <span className="text-description text-xs">
            {`Your usage resets on ${new Date(
              usageLimit.resetAt,
            ).toLocaleDateString()}.`}
          </span>
        )}
        <div className="flex flex-row flex-wrap gap-2 pt-1">
          <GhostButton
            className="flex items-center"
            onClick={() =>
              usageLimit.actionUrl &&
              ideMessenger.ide.openUrl(usageLimit.actionUrl)
            }
          >
            <ArrowTopRightOnSquareIcon className="mr-1.5 h-3.5 w-3.5" />
            <span>{isUpgrade ? "Upgrade to Pro" : "Buy more tokens"}</span>
          </GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-3 pt-3">
      {/* Concise error title. A signed-out (401) or usage-cap (429) state is an
          expected condition, not a crash — drop the alarming error styling and
          wording, and give it an actionable title. */}
      <h3
        className={`m-0 p-0 text-lg font-medium ${
          isSignedOut || usageLimit ? "" : "text-error"
        }`}
      >
        {isSignedOut
          ? "Sign in to continue"
          : usageLimit
            ? usageLimit.kind === "upgrade"
              ? "You've hit your free limit"
              : "You're out of tokens"
            : "Error handling model response"}
      </h3>

      {errorContent}

      {/* Expandable technical details using ToggleDiv (hidden for the expected
          signed-out / usage-cap states — the raw HTTP error is just noise there) */}
      {message && !isSignedOut && !usageLimit && (
        <div className="mb-2">
          <ToggleDiv
            title="View error output"
            testId="error-output-toggle"
            defaultOpen
          >
            <div className="flex flex-col gap-0 rounded-sm">
              <code className="text-editor-foreground block max-h-48 overflow-y-auto p-3 font-mono text-xs">
                {parsedError}
              </code>

              <div className="flex flex-row items-center justify-end gap-2 p-2">
                <GhostButton
                  onClick={copyErrorToClipboard}
                  className="flex items-center"
                >
                  <ClipboardIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span>Copy output</span>
                </GhostButton>

                <GhostButton
                  onClick={() => {
                    ideMessenger.post("toggleDevTools", undefined);
                  }}
                  className="flex items-center"
                >
                  <ArrowTopRightOnSquareIcon className="mr-1.5 h-4 w-4" />
                  <span className="text-xs">View Logs</span>
                </GhostButton>
              </div>
            </div>
          </ToggleDiv>
        </div>
      )}
    </div>
  );
};

export default StreamErrorDialog;
