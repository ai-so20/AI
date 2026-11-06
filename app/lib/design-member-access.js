// Shared access rules for isolated design pages.
// Original 26 stores approval_status as "1"; the separate AI database uses "approved".
// Never change either database or bypass Supabase RLS to bridge these values.
export function isApprovedProfile(profile) {
  return Boolean(profile) && ["1", "approved"].includes(String(profile.approval_status ?? ""));
}

export function isDesignUiLocked() {
  if (typeof window === "undefined") return false;
  try {
    // The existing AI login/logout flow keeps the auth token but locks the VIP interface.
    return window.localStorage.getItem("vip-ui-locked") === "1";
  } catch {
    // Don't display member data if the local VIP lock state cannot be checked.
    return true;
  }
}

export function observeDesignUiLock(onLock) {
  if (typeof window === "undefined") return () => {};
  const handleChange = () => {
    if (isDesignUiLocked()) onLock();
  };
  window.addEventListener("storage", handleChange);
  window.addEventListener("focus", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("focus", handleChange);
  };
}
