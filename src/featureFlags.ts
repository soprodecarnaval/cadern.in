export const FEATURE_FLAG_COLLAB_FLOW =
  import.meta.env.VITE_FEATURE_FLAG_COLLAB_FLOW === "true";

const browserUpload = import.meta.env.VITE_FEATURE_FLAG_BROWSER_UPLOAD;
export const BROWSER_UPLOAD_MODE =
  browserUpload === "default" ? "default" :
    browserUpload === "beta" || browserUpload === "true" ? "beta" : "off";
export const FEATURE_FLAG_BROWSER_UPLOAD = BROWSER_UPLOAD_MODE !== "off";
