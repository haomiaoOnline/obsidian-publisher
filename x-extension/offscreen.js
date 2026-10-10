chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "obsidian-publisher:read-clipboard") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const pasted = document.execCommand("paste");
    const text = textarea.value;
    textarea.remove();

    if (!pasted && !text) {
      sendResponse({
        ok: false,
        error: "Chrome did not grant clipboard paste to the offscreen document"
      });
      return false;
    }

    sendResponse({ ok: true, text });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error?.message || String(error)
    });
  }
  return false;
});
