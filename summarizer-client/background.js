// Add this helper function at the top
function truncateText(text) {
  // Approximate token count (rough estimate: 4 chars = 1 token)
  const maxChars = 1024 * 4;
  if (text.length <= maxChars) return text;

  // Try to break at a sentence
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1) : truncated;
}

async function fetchSummaryFromHuggingFace(text, isSelection = false) {
  try {
    // Truncate text before sending to API
    const truncatedText = truncateText(text);

    const response = await fetch("http://localhost:3000/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: truncatedText, isSelection }),
    });

    const data = await response.json();
    if (data && data.summary) {
      return data.summary; // Extract summary from response
    } else {
      console.error("No summary found in the API response");
      return "Error summarizing text.";
    }
  } catch (error) {
    console.error("Error fetching summary:", error);
    // Optionally, notify via runtime.sendMessage if needed.
    return "Error: Cannot fetch summary at the moment.";
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarizePage") {
    fetchSummaryFromHuggingFace(request.text)
      .then((summary) => sendResponse({ summary }))
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Required for async response
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Existing context menu for selection
  chrome.contextMenus.create({
    id: "summarize-text",
    title: "Summarize",
    contexts: ["selection"],
  });
  // New context menu for entire page
  chrome.contextMenus.create({
    id: "summarize-entire-page",
    title: "Summarize entire page",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarize-text" && info.selectionText) {
    // Directly fetch summary without checking cache
    fetchSummaryFromHuggingFace(info.selectionText, true)
      .then((summary) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showSummaryBox,
          args: [summary],
        });
      })
      .catch((error) => {
        console.error("Error summarizing text:", error);
      });
  }
  if (info.menuItemId === "summarize-entire-page") {
    // Execute a function in the tab that calls the already exposed triggerPrefetchedSummary
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        if (window.triggerPrefetchedSummary) {
          window.triggerPrefetchedSummary();
        } else {
          console.error("triggerPrefetchedSummary is not defined.");
        }
      },
    });
  }
});

// Add action button click handler
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      if (window.triggerPrefetchedSummary) {
        window.triggerPrefetchedSummary();
      } else {
        console.error("triggerPrefetchedSummary is not defined.");
      }
    },
  });
});

function showSummaryBox(summary) {
  const existingBox = document.getElementById("summary-box");
  if (existingBox) existingBox.remove();

  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Calculate position to place box on the right
  const viewportWidth = window.innerWidth;
  const boxWidth = 300;
  let leftPosition = rect.right + window.scrollX + 16; // 16px gap from selection

  // Ensure the box doesn't go off-screen
  if (leftPosition + boxWidth > viewportWidth - 20) {
    leftPosition = rect.left + window.scrollX - boxWidth - 16;
  }

  const box = document.createElement("div");
  box.id = "summary-box";
  box.style.cssText = `
    position: absolute;
    top: ${rect.top + window.scrollY}px;
    left: ${leftPosition}px;
    background-color: white;
    border-radius: 8px;
    padding: 16px;
    width: ${boxWidth}px;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    animation: fadeIn 0.2s ease-out;
  `;

  // Add fade-in animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);

  // Simple paragraph display
  const content = document.createElement("p");
  content.style.margin = "0";
  content.textContent = summary;
  box.appendChild(content);

  document.body.appendChild(box);

  // Close on outside click
  function closeOnClickOutside(event) {
    if (!box.contains(event.target)) {
      box.remove();
      document.removeEventListener("click", closeOnClickOutside);
    }
  }
  document.addEventListener("click", closeOnClickOutside);
}

// Remove or comment out the old showLoadingBox function as we won't show loading state for quick selections
