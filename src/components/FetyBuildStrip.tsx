import { APP_BUILD_LABEL } from "../lib/appBuildLabel";

/** Visible on every screen so deployments can be verified against Git. */
export default function FetyBuildStrip() {
  return (
    <p className="fety-build-strip" title="Compare this to the latest commit on GitHub main">
      Build <code>{APP_BUILD_LABEL}</code>
    </p>
  );
}
