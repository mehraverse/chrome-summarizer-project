class ContentAnalyzer {
  static MINIMUM_WORD_COUNT = 150; // Increased minimum
  static MINIMUM_PARAGRAPH_COUNT = 2; // Reduced for better coverage
  static MAX_LINK_DENSITY = 0.5; // Increased slightly
  static CACHE_KEY = "analyzer_cache";

  static async analyze() {
    // Check cache first
    const cache = this.getCache();
    if (cache?.url === window.location.href) {
      return cache.result;
    }

    if (this.isUnsupportedPage()) return false;

    try {
      const article = new Readability(document.cloneNode(true)).parse();
      if (!article || !article.textContent) return false;

      const stats = this.getContentStats(article);
      const metadata = this.getMetadata();
      const result =
        this.isValidContent(stats) && this.hasGoodMetadata(metadata);

      // Cache the result
      this.setCache(result);
      return result;
    } catch (error) {
      console.error("Content analysis failed:", error);
      return false;
    }
  }

  static isUnsupportedPage() {
    // Skip pages that shouldn't show summary mode
    const unsupportedPatterns = [
      /^about:/,
      /^chrome:/,
      /^chrome-extension:/,
      /^moz-extension:/,
      /^file:/,
      /^view-source:/,
      /^https:\/\/([^\/]+\.)?google\.[^\/]+\/search/,
    ];

    return (
      unsupportedPatterns.some((pattern) =>
        pattern.test(window.location.href)
      ) || document.querySelector('form[role="search"]') !== null
    );
  }

  static getContentStats(article) {
    return {
      wordCount: article.textContent.split(/\s+/).filter((w) => w.length > 0)
        .length,
      paragraphCount: article.content.match(/<p[^>]*>/g)?.length || 0,
      linkDensity: this.calculateLinkDensity(),
      hasArticleStructure: this.checkArticleStructure(),
      contentScore: this.calculateContentScore(article),
    };
  }

  static calculateLinkDensity() {
    const mainContent =
      document.querySelector('main, article, [role="main"]') || document.body;
    const totalText = mainContent.textContent.length;
    const linkText = Array.from(mainContent.getElementsByTagName("a")).reduce(
      (acc, link) => acc + link.textContent.length,
      0
    );

    return totalText ? linkText / totalText : 1;
  }

  static checkArticleStructure() {
    const hasArticleTag = document.querySelector("article") !== null;
    const hasHeading = document.querySelector("h1, h2") !== null;
    const hasParagraphs =
      document.querySelectorAll("p").length >= this.MINIMUM_PARAGRAPH_COUNT;

    return hasArticleTag || (hasHeading && hasParagraphs);
  }

  static calculateContentScore(article) {
    let score = 0;
    score += article.textContent.length / 100;
    score += (article.content.match(/<p[^>]*>/g)?.length || 0) * 5;
    score += (article.content.match(/<h[1-6][^>]*>/g)?.length || 0) * 10;
    return score;
  }

  static getMetadata() {
    return {
      hasTitle: document.title.length > 10,
      hasDescription: !!document.querySelector('meta[name="description"]'),
      hasHeading: !!document.querySelector("h1, h2"),
      readTime: this.estimateReadTime(),
    };
  }

  static estimateReadTime(wordCount) {
    const WPM = 200; // Average reading speed
    return Math.ceil(wordCount / WPM);
  }

  static isValidContent(stats) {
    return (
      stats.wordCount >= this.MINIMUM_WORD_COUNT &&
      stats.paragraphCount >= this.MINIMUM_PARAGRAPH_COUNT &&
      stats.linkDensity <= this.MAX_LINK_DENSITY &&
      stats.hasArticleStructure
    );
  }

  static hasGoodMetadata(metadata) {
    return (
      metadata.hasTitle && (metadata.hasDescription || metadata.hasHeading)
    );
  }

  // Cache management
  static getCache() {
    try {
      return JSON.parse(sessionStorage.getItem(this.CACHE_KEY));
    } catch {
      return null;
    }
  }

  static setCache(result) {
    try {
      sessionStorage.setItem(
        this.CACHE_KEY,
        JSON.stringify({
          url: window.location.href,
          result,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      console.warn("Cache setting failed:", e);
    }
  }
}

// Export for use in other files
window.ContentAnalyzer = ContentAnalyzer;
