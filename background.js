chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    _author: "http://localhost:4502|admin|admin",
    _publish: "http://localhost:4503|admin|admin",
  });
});
