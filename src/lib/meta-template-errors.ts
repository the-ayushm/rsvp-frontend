/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extract the error message directly from Meta API response.
 * Returns only what Meta provides - no custom hints or additions.
 */
export function getMetaTemplateErrorMessage(data: any): string {
  if (!data) {
    return "Failed to create template. Please try again.";
  }
  const err = data.error ?? data;
  if (!err || typeof err !== "object") {
    return "Failed to create template. Please try again.";
  }
  return (
    err.error_user_msg ||
    err.error_user_title ||
    err.message ||
    "Failed to create template on Meta"
  );
}
