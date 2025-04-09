// Add loading state management functions
function showLoadingOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "summary-loading-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
  overlay.style.zIndex = "9998"; // Below final overlay
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.flexDirection = "column";

  // Create spinner
  const spinner = document.createElement("div");
  spinner.style.border = "4px solid rgba(255, 255, 255, 0.3)";
  spinner.style.borderRadius = "50%";
  spinner.style.borderTop = "4px solid #ffffff";
  spinner.style.width = "40px";
  spinner.style.height = "40px";
  spinner.style.animation = "spin 1s linear infinite";

  // Create loading text
  const loadingText = document.createElement("p");
  loadingText.textContent = "Generating summary...";
  loadingText.style.color = "white";
  loadingText.style.marginTop = "16px";

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
  document.head.appendChild(style);

  overlay.appendChild(spinner);
  overlay.appendChild(loadingText);
  document.body.appendChild(overlay);
}

function removeLoadingOverlay() {
  const overlay = document.getElementById("summary-loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}

// Enhanced event listener with loading state
window.addEventListener("keydown", async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
    e.preventDefault(); // Prevent any default browser behavior

    // Show loading state immediately
    showLoadingOverlay();

    try {
      // Get page content
      const article = new Readability(document.cloneNode(true)).parse();
      const content = article?.textContent || document.body.innerText;

      // Send message to background script
      chrome.runtime.sendMessage(
        { action: "summarizePage", text: content.substring(0, 4000) },
        (response) => {
          removeLoadingOverlay(); // Remove loading state

          if (chrome.runtime.lastError) {
            console.error("Extension error:", chrome.runtime.lastError);
            showFullPageSummary("Failed to communicate with extension.");
            return;
          }

          if (response.error) {
            console.error("Error:", response.error);
            showFullPageSummary("Failed to summarize the page.");
          } else {
            showFullPageSummary(response.summary);
          }
        }
      );
    } catch (error) {
      removeLoadingOverlay();
      console.error("Content extraction error:", error);
      showFullPageSummary("Error processing page content.");
    }
  }
});

// Enhanced summary display with animation
function showFullPageSummary(summary) {
  // Remove any existing overlays first
  const existingOverlay = document.getElementById("summary-overlay");
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement("div");
  overlay.id = "summary-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
  overlay.style.zIndex = "9999";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.3s ease";

  const box = document.createElement("div");
  box.style.position = "fixed";
  box.style.top = "50%";
  box.style.left = "50%";
  box.style.transform = "translate(-50%, -50%)";
  box.style.backgroundColor = "#fff";
  box.style.padding = "24px";
  box.style.borderRadius = "8px";
  box.style.maxWidth = "80%";
  box.style.maxHeight = "80%";
  box.style.overflowY = "auto";
  box.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
  box.style.fontSize = "16px";
  box.style.lineHeight = "1.5";
  box.style.color = "#333";
  box.style.opacity = "0";
  box.style.transform = "translate(-50%, -48%)";
  box.style.transition = "all 0.3s ease";

  // Insert summary as paragraphs instead of raw text
  const paragraphs = summary.split("\n").filter((p) => p.trim().length > 0);
  if (paragraphs.length > 0) {
    paragraphs.forEach((p) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = p;
      paragraph.style.marginBottom = "12px";
      box.appendChild(paragraph);
    });
  } else {
    box.textContent = summary;
  }

  // Close on click
  overlay.addEventListener("click", () => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 300);
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Trigger animations
  setTimeout(() => {
    overlay.style.opacity = "1";
    box.style.opacity = "1";
    box.style.transform = "translate(-50%, -50%)";
  }, 10);
}
