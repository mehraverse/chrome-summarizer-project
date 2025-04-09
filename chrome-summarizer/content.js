window.addEventListener("message", (event) => {
  if (event.source !== window || event.data.type !== "SUMMARIZE_TEXT") return;
  const selectedText = event.data.text;
  showSummaryPopup("Summarizing...");
  fetchSummary(selectedText)
    .then((summary) => {
      updateSummaryPopup(summary);
    })
    .catch((err) => {
      updateSummaryPopup("Error summarizing.");
      console.error(err);
    });
});

function fetchSummary(text) {
  // Placeholder for now — we’ll replace with API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("• Example summary point 1\n• Example summary point 2");
    }, 1500);
  });
}

function showSummaryPopup(initialText) {
  removeExistingPopup();
  const popup = document.createElement("div");
  popup.id = "quick-summary-popup";
  popup.style.position = "fixed";
  popup.style.bottom = "20px";
  popup.style.right = "20px";
  popup.style.backgroundColor = "#fff";
  popup.style.border = "1px solid #ccc";
  popup.style.padding = "10px";
  popup.style.zIndex = "9999";
  popup.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  popup.style.maxWidth = "300px";
  popup.style.fontSize = "14px";
  popup.innerText = initialText;
  document.body.appendChild(popup);
}

function updateSummaryPopup(text) {
  const popup = document.getElementById("quick-summary-popup");
  if (popup) popup.innerText = text;
}

function removeExistingPopup() {
  const old = document.getElementById("quick-summary-popup");
  if (old) old.remove();
}
