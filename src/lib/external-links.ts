export const openExternalUrlInNewTab = (url: string) => {
  const newTab = window.open("", "_blank", "noopener,noreferrer");

  if (!newTab) {
    return false;
  }

  newTab.opener = null;
  newTab.location.href = url;
  return true;
};
