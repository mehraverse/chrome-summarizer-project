// Add cache management at the top
const SUMMARY_CACHE_KEY = "page_summaries";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function getCachedSummary(url) {
  try {
    const cache = JSON.parse(localStorage.getItem(SUMMARY_CACHE_KEY) || "{}");
    const item = cache[url];
    if (item && Date.now() - item.timestamp < CACHE_EXPIRY) {
      return item.summary;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function cacheSummary(url, summary) {
  try {
    const cache = JSON.parse(localStorage.getItem(SUMMARY_CACHE_KEY) || "{}");
    cache[url] = {
      summary,
      timestamp: Date.now(),
    };
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to cache summary:", e);
  }
}

// Add loading state management functions
function showLoadingOverlay(isGenerating = true) {
  const overlay = document.createElement("div");
  overlay.id = "summary-loading-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: ${isGenerating ? "rgba(0, 0, 0, 0.6)" : "transparent"};
    z-index: 9998;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    pointer-events: ${isGenerating ? "auto" : "none"};
  `;
  overlay.setAttribute("role", "alert");

  if (isGenerating) {
    // Only show spinner and text if actually generating
    const spinner = document.createElement("div");
    spinner.style.cssText = `
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 4px solid #ffffff;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
    `;

    const loadingText = document.createElement("p");
    loadingText.textContent = "Generating summary...";
    loadingText.style.cssText = `
      color: white;
      margin-top: 16px;
    `;

    overlay.appendChild(spinner);
    overlay.appendChild(loadingText);
  }

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
  document.head.appendChild(style);

  document.body.appendChild(overlay);
}

function removeLoadingOverlay() {
  const overlay = document.getElementById("summary-loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}

// Add banner creation function at the top
function createNotificationBanner() {
  const banner = document.createElement("div");
  banner.id = "summary-notification-banner";
  banner.style.cssText = `
    position: fixed;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    background: #0095f6;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    cursor: pointer;
    transition: none;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 6px;
  `;

  banner.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
    Summary Available
  `;

  banner.addEventListener("click", () => {
    banner.style.top = "-50px";
    triggerPrefetchedSummary();
  });

  document.body.appendChild(banner);
  // Force a reflow before adding transition
  banner.offsetHeight; // This triggers a reflow
  banner.style.transition = "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
  return banner;
}

// Add show/hide banner functions
function showNotificationBanner() {
  let banner = document.getElementById("summary-notification-banner");
  if (!banner) {
    banner = createNotificationBanner();
  }

  // Use nested requestAnimationFrame for reliable transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.style.top = "16px";
      // Auto-hide after 5 seconds
      setTimeout(() => {
        banner.style.top = "-40px";
      }, 5000);
    });
  });
}

// Add flags to track prefetch state
let prefetchedSummary = null;
let isPrefetching = false;
let prefetchDebounceTimer = null;

// Add state tracking
let isSummaryBoxOpen = false;

// Add URL tracking
let currentPageUrl = window.location.href;

// Update the load event listener to use the new banner
window.addEventListener("load", async () => {
  // Delay analysis to ensure page is fully loaded
  setTimeout(async () => {
    try {
      const isValidContent = await ContentAnalyzer.analyze();
      if (isValidContent) {
        prefetchSummary();
      }
    } catch (error) {
      console.error("Content analysis failed:", error);
    }
  }, 1000);
});

// Separate prefetch logic
function prefetchSummary() {
  if (isPrefetching) return;

  // Check cache first
  const cachedSummary = getCachedSummary(window.location.href);
  if (cachedSummary) {
    prefetchedSummary = cachedSummary;
    showNotificationBanner();
    return;
  }

  clearTimeout(prefetchDebounceTimer);
  prefetchDebounceTimer = setTimeout(() => {
    isPrefetching = true;
    const article = new Readability(document.cloneNode(true)).parse();
    if (!article?.textContent) {
      isPrefetching = false;
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "summarizePage",
        text: article.textContent.slice(0, 4000),
      },
      (response) => {
        isPrefetching = false;
        if (!chrome.runtime.lastError && response?.summary) {
          prefetchedSummary = response.summary;
          cacheSummary(window.location.href, response.summary);
          showNotificationBanner(); // Show notification when summary is ready
        }
      }
    );
  }, 500);
}

// Add this helper function (placed near the keydown event listener)
function triggerPrefetchedSummary() {
  if (isSummaryBoxOpen) return;

  const showSummaryWithTransition = (summary) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        removeLoadingOverlay();
        showFullPageSummary(summary);
      }, 50);
    });
  };

  if (prefetchedSummary && currentPageUrl === window.location.href) {
    showSummaryWithTransition(prefetchedSummary);
    return;
  }

  // Only fetch if not already fetching
  if (!isPrefetching) {
    showLoadingOverlay(true);
    isPrefetching = true;

    const article = new Readability(document.cloneNode(true)).parse();
    const content = article?.textContent || document.body.innerText;

    chrome.runtime.sendMessage(
      { action: "summarizePage", text: content.substring(0, 4000) },
      (response) => {
        isPrefetching = false;
        if (!chrome.runtime.lastError && response && response.summary) {
          prefetchedSummary = response.summary;
          currentPageUrl = window.location.href;
          removeLoadingOverlay();
          showFullPageSummary(response.summary);
        }
      }
    );
  } else {
    // Show loading while waiting for ongoing fetch
    showLoadingOverlay(true);
    const checkInterval = setInterval(() => {
      if (prefetchedSummary) {
        clearInterval(checkInterval);
        removeLoadingOverlay();
        showFullPageSummary(prefetchedSummary);
      }
    }, 300);
  }
}

// Enhanced event listener with loading state
window.addEventListener("keydown", async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    triggerPrefetchedSummary();
  }
});

// Add new chat container creation function
function createChatInterface() {
  // Changed: Simple text box interface with output echo
  const chatInterface = document.createElement("div");
  chatInterface.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  `;

  // Changed: Update output container styling to remove background and border for an interactive feel
  const outputContainer = document.createElement("div");
  outputContainer.style.cssText = `
    padding: 10px;
    min-height: 40px;
    white-space: pre-wrap;
    font-style: italic;
    color: #555;
  `;

  // Input box for typing text
  const input = document.createElement("input");
  input.placeholder = "Ask about this article...";
  input.style.cssText = `
    width: 100%;
    padding: 14px 18px;
    border: 2px solid transparent;
    border-radius: 12px;
    font-size: 15px;
    background: #f8f8f8;
    color: #333;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;
  input.addEventListener("focus", () => {
    input.style.background = "#fff";
    input.style.borderColor = "#0095f6";
    input.style.boxShadow = "0 2px 8px rgba(0, 149, 246, 0.15)";
  });
  input.addEventListener("blur", () => {
    input.style.background = "#f8f8f8";
    input.style.borderColor = "transparent";
    input.style.boxShadow = "none";
  });

  // Changed: Update output with the AI response on Enter instead of echoing the input
  let conversationId = null; // Add this to track conversation

  // Add loading animation styles
  const style = document.createElement("style");
  style.textContent = `
    @keyframes loadingDots {
      0%, 20% { content: '.'; }
      40%, 60% { content: '..'; }
      80%, 100% { content: '...'; }
    }
    @keyframes fadeInUp {
      from { 
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .loading-dots::after {
      content: '';
      animation: loadingDots 1.5s infinite;
    }
    .new-response {
      animation: fadeInUp 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);

  input.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      const question = input.value;
      input.value = "";

      // Show loading animation
      outputContainer.textContent = "";
      outputContainer.className = "loading-dots";

      try {
        const response = await fetch("http://localhost:3000/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-conversation-id": conversationId, // Add this header
          },
          body: JSON.stringify({ question, context: prefetchedSummary }),
        });
        const data = await response.json();
        if (data.conversationId) {
          conversationId = data.conversationId;
        }

        // Show response with fade-in animation
        outputContainer.className = "new-response";
        outputContainer.textContent = data?.response || "No response received.";
      } catch (error) {
        outputContainer.className = "new-response";
        outputContainer.textContent = "Error fetching AI response.";
      }
    }
  });

  chatInterface.appendChild(outputContainer);
  chatInterface.appendChild(input);
  return chatInterface;
}

// Enhanced summary display with animation
function showFullPageSummary(summary) {
  if (isSummaryBoxOpen) return;
  isSummaryBoxOpen = true;
  document.body.style.overflow = "hidden";

  // Create wrapper for animation
  const wrapper = document.createElement("div");
  wrapper.id = "reader-mode-wrapper";
  wrapper.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgb(250, 250, 250);
    transform: translateY(100%);
    transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
    z-index: 9999;
    overflow-y: auto;
  `;

  // Create content container with max-width
  const container = document.createElement("div");
  container.style.cssText = `
    max-width: 680px;
    margin: 0 auto;
    padding: 40px 20px;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    transition-delay: 0.2s;
  `;

  // Create header with continue reading button
  const header = document.createElement("div");
  header.style.cssText = `
    position: sticky;
    top: 0;
    background: linear-gradient(to bottom, rgb(250, 250, 250) 80%, rgba(250, 250, 250, 0));
    padding: 20px 0;
    margin-bottom: 30px;
    z-index: 2;
  `;

  const continueButton = document.createElement("button");
  continueButton.textContent = "Continue Reading";
  continueButton.style.cssText = `
    font-size: 13px;
    color: #666;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 4px;
    transition: all 0.2s ease;
  `;

  // Insert summary content
  const content = document.createElement("div");
  content.style.cssText = `
    font-family: Georgia, serif;
    font-size: 18px;
    line-height: 1.7;
    color: #333;
  `;

  // Revert back to original highlight style
  const style = document.createElement("style");
  style.textContent = `
    mark {
      background: linear-gradient(120deg, rgba(255, 242, 0, 0.4) 0%, rgba(255, 242, 0, 0.2) 100%);
      padding: 0 2px;
      border-radius: 2px;
      color: inherit;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);

  const paragraphs = summary.split("\n").filter((p) => p.trim().length > 0);
  paragraphs.forEach((p) => {
    const para = document.createElement("p");
    para.innerHTML = p; // Using innerHTML to parse the <mark> tags
    para.style.marginBottom = "24px";
    content.appendChild(para);
  });

  // Assemble the DOM
  header.appendChild(continueButton);
  container.appendChild(header);
  container.appendChild(content);

  // Instead of appending the chat interface inside container,
  // remove the original line:
  // container.appendChild(chatInterface);
  // Create and append the chat interface in its own fixed container

  const chatInterface = createChatInterface();
  const chatWrapper = document.createElement("div");
  chatWrapper.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    width: 680px;
    max-width: 100%;
    z-index: 10000;
  `;
  chatWrapper.appendChild(chatInterface);
  wrapper.appendChild(chatWrapper);

  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  // Trigger animations
  requestAnimationFrame(() => {
    wrapper.style.transform = "translateY(0)";
    container.style.opacity = "1";
    container.style.transform = "translateY(0)";
  });

  // Event handlers
  function closeReader() {
    isSummaryBoxOpen = false;
    wrapper.style.transform = "translateY(100%)";
    container.style.opacity = "0";
    container.style.transform = "translateY(20px)";
    document.body.style.overflow = "";

    // Remove the indicator show-again logic
    document.removeEventListener("keydown", handleEscapeKey);

    setTimeout(() => wrapper.remove(), 500);
  }

  // Separate escape key handler
  function handleEscapeKey(e) {
    if (e.key === "Escape" && isSummaryBoxOpen) {
      closeReader();
    }
  }

  // Add persistent escape key listener
  document.addEventListener("keydown", handleEscapeKey);

  continueButton.addEventListener("mouseover", () => {
    continueButton.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
  });
  continueButton.addEventListener("mouseout", () => {
    continueButton.style.backgroundColor = "transparent";
  });
  continueButton.addEventListener("click", closeReader);
}

// Expose the trigger function for use by background script
window.triggerPrefetchedSummary = triggerPrefetchedSummary;
