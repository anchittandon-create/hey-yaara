export const openExternalUrlInNewTab = (url: string) => {
  const newTab = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(newTab);
};
