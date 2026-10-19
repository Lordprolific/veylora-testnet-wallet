const expandButton = document.querySelector<HTMLButtonElement>("#expand-wallet");

expandButton?.addEventListener("click", () => {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: {
      runtime?: { getURL?: (path: string) => string };
      tabs?: { create?: (options: { url: string; active: boolean }) => void };
    };
  }).chrome;
  const getURL = chromeApi?.runtime?.getURL;
  const createTab = chromeApi?.tabs?.create;
  if (!getURL || !createTab) {
    expandButton.textContent = "Open wallet.html from Extensions";
    return;
  }
  createTab({ url: getURL("wallet.html"), active: true });
});
