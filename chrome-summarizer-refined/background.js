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

async function fetchSummaryFromHuggingFace(text) {
  try {
    // Truncate text before sending to API
    const truncatedText = truncateText(text);

    const response = await fetch("http://localhost:3000/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: truncatedText }),
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
    // Show loading message while waiting for the API response
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showLoadingBox,
    });

    fetchSummaryFromHuggingFace(info.selectionText)
      .then((summary) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showSummaryBox,
          args: [summary, info.selectionText],
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

function showLoadingBox() {
  const existingBox = document.getElementById("summary-box");
  if (existingBox) {
    existingBox.remove(); // Remove any previous summary box
  }

  // Get the position of the selected text
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect(); // Get the bounding box of the selected text

  // Create the loading box
  const box = document.createElement("div");
  box.id = "summary-box";
  box.style.position = "absolute";
  box.style.top = `${rect.top + window.scrollY + 50}px`; // Position the summary box above the selected text
  box.style.left = `${rect.left + window.scrollX + rect.width - 300}px`; // Position the summary box to the right
  box.style.backgroundColor = "#f0f0f0";
  box.style.border = "1px solid #ccc";
  box.style.paddingLeft = "10px"; // Added padding for better spacing
  box.style.paddingRight = "10px"; // Added padding for better spacing
  box.style.paddingTop = "10px"; // Added padding for top
  box.style.paddingBottom = "10px"; // Added padding for bottom
  box.style.zIndex = "9999";
  box.style.maxWidth = "400px";
  box.style.maxHeight = "300px";
  box.style.overflowY = "auto";
  box.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";

  // Show loading text
  const loadingText = document.createElement("p");
  loadingText.innerText = "Loading summary...";
  box.appendChild(loadingText);

  // Append the summary box to the document
  document.body.appendChild(box);

  // Close the summary box when clicking outside of it
  function closeSummaryBox(event) {
    if (!box.contains(event.target)) {
      box.remove();
      document.removeEventListener("click", closeSummaryBox); // Remove the event listener after closing the box
    }
  }

  // Add the event listener to detect clicks outside the summary box
  document.addEventListener("click", closeSummaryBox);
}

function showSummaryBox(summary, selectedText) {
  const existingBox = document.getElementById("summary-box");
  if (existingBox) {
    existingBox.remove(); // Remove any previous summary box
  }

  // Get the position of the selected text
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect(); // Get the bounding box of the selected text

  // Create the summary box
  const box = document.createElement("div");
  box.id = "summary-box";
  box.style.position = "absolute";
  box.style.top = `${rect.top + window.scrollY + 50}px`; // Position the summary box above the selected text
  box.style.left = `${rect.left + window.scrollX + rect.width - 300}px`; // Position the summary box to the right
  box.style.backgroundColor = "#f0f0f0";
  box.style.border = "1px solid #ccc";
  box.style.paddingLeft = "10px"; // Added padding for better spacing
  box.style.paddingRight = "10px"; // Added padding for better spacing
  box.style.paddingTop = "10px"; // Added padding for top
  box.style.paddingBottom = "10px"; // Added padding for bottom
  box.style.zIndex = "9999";
  box.style.maxWidth = "400px";
  box.style.maxHeight = "300px";
  box.style.overflowY = "auto";
  box.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";

  // Add highlight styles
  const style = document.createElement("style");
  style.textContent = `
    #summary-box mark {
      background: linear-gradient(120deg, rgba(255, 242, 0, 0.4) 0%, rgba(255, 242, 0, 0.2) 100%);
      padding: 0 2px;
      border-radius: 2px;
      color: inherit;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);

  // Create the unordered list for bullet points
  const ul = document.createElement("ul");
  ul.style.listStyleType = "disc"; // Bullet points (disc style)
  ul.style.paddingLeft = "20px"; // Space between bullet and text
  ul.style.margin = "0"; // Remove margin around the list

  // Split the summary text into individual points (you can split based on punctuation or content)
  const points = summary.split(/(?<=[.!?])\s+/); // Split the summar
  points.forEach((point) => {
    if (point.trim()) {
      const li = document.createElement("li");
      li.innerHTML = point.trim(); // Using innerHTML to parse the <mark> tags
      ul.appendChild(li);
    }
  });

  // Create the summary text header
  const header = document.createElement("div");
  const headerContainer = document.createElement("div");
  headerContainer.appendChild(header);

  // Append the header and list to the box
  box.appendChild(headerContainer);
  box.appendChild(ul);

  // Append the summary box to the document
  document.body.appendChild(box);

  // Close the summary box when clicking outside of it
  function closeSummaryBox(event) {
    if (!box.contains(event.target)) {
      box.remove();
      document.removeEventListener("click", closeSummaryBox); // Remove the event listener after closing the box
    }
  }

  // Add the event listener to detect clicks outside the summary box
  document.addEventListener("click", closeSummaryBox);
}
