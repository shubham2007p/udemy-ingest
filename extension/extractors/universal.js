/**
 * Universal Website Ingestion Extractor
 * Accepts any DOM Document and extracts metadata, statistics, semantic layout sections,
 * and a deterministic nested heading hierarchy tree suited for LLM ingestion.
 */
const UniversalExtractor = {
  /**
   * Scrapes DOM metadata from standard, OpenGraph, Twitter, and JSON-LD tags.
   */
  scrapeMetadata(doc, url) {
    const metadata = {
      title: doc.title || "",
      description: "",
      canonicalUrl: url,
      favicon: "",
      author: "",
      publishDate: "",
      language: doc.documentElement.lang || "",
      og: {},
      twitter: {},
      jsonLd: []
    };

    try {
      const urlObj = new URL(url);
      metadata.favicon = `${urlObj.origin}/favicon.ico`;
    } catch (e) {}

    // Find all meta and link tags
    const metas = doc.querySelectorAll('meta');
    metas.forEach(meta => {
      const name = meta.getAttribute('name');
      const property = meta.getAttribute('property');
      const content = meta.getAttribute('content');

      if (!content) return;

      if (name) {
        const lowerName = name.toLowerCase();
        if (lowerName === 'description') {
          metadata.description = content;
        } else if (lowerName === 'author') {
          metadata.author = content;
        } else if (lowerName === 'publish-date' || lowerName === 'date' || lowerName === 'pubdate') {
          metadata.publishDate = content;
        } else if (lowerName.startsWith('twitter:')) {
          metadata.twitter[name] = content;
        }
      }

      if (property) {
        const lowerProp = property.toLowerCase();
        if (lowerProp.startsWith('og:')) {
          metadata.og[property] = content;
        } else if (lowerProp === 'article:published_time') {
          metadata.publishDate = content;
        } else if (lowerProp === 'article:author') {
          metadata.author = content;
        }
      }
    });

    // Check OpenGraph and Twitter fallback titles & descriptions
    if (!metadata.title) {
      metadata.title = metadata.og['og:title'] || metadata.twitter['twitter:title'] || doc.querySelector('h1')?.innerText.trim() || "Untitled Page";
    }
    if (!metadata.description) {
      metadata.description = metadata.og['og:description'] || metadata.twitter['twitter:description'] || "";
    }

    // Canonical link tag
    const canonicalEl = doc.querySelector('link[rel="canonical"]');
    if (canonicalEl && canonicalEl.getAttribute('href')) {
      metadata.canonicalUrl = canonicalEl.getAttribute('href');
    }

    // Favicon link tag
    const faviconEl = doc.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
    if (faviconEl && faviconEl.getAttribute('href')) {
      try {
        metadata.favicon = new URL(faviconEl.getAttribute('href'), url).href;
      } catch (e) {
        metadata.favicon = faviconEl.getAttribute('href');
      }
    }

    // Parse JSON-LD
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.innerText);
        if (data) {
          metadata.jsonLd.push(data);
          // Look for author/publishDate in JSON-LD
          if (!metadata.author && data.author) {
            metadata.author = typeof data.author === 'string' ? data.author : (data.author.name || "");
          }
          if (!metadata.publishDate && data.datePublished) {
            metadata.publishDate = data.datePublished;
          }
        }
      } catch (e) {}
    });

    return metadata;
  },

  /**
   * Cleans DOM tree recursively, deleting scripts, styles, ads, cookies, tracking, and hidden layers.
   * Returns a cloned body node.
   */
  cleanDOM(doc) {
    const body = doc.body.cloneNode(true);

    const noiseKeywords = [
      'cookie', 'consent', 'banner', 'privacy-notice', 'gdpr',
      'adsbygoogle', 'banner-ad', 'ad-box', 'ad-wrapper', 'ad-container', 'advertisement', 'sponsor',
      'social-share', 'share-button', 'sharing', 'share-container',
      'tracker', 'analytics', 'telemetry', 'pixel', 'search-box', 'search-form'
    ];

    const removeQueue = [];

    // Helper to evaluate and queue element for removal
    function checkNode(node) {
      if (node.nodeType !== 1) return; // Only process element nodes

      const tagName = node.tagName.toLowerCase();
      
      // 1. Tags to strip immediately
      const forbiddenTags = ['script', 'style', 'noscript', 'iframe', 'svg', 'embed', 'object', 'link', 'meta'];
      if (forbiddenTags.includes(tagName)) {
        removeQueue.push(node);
        return;
      }

      // 2. Hidden elements
      if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') {
        removeQueue.push(node);
        return;
      }
      if (node.style.display === 'none' || node.style.visibility === 'hidden') {
        removeQueue.push(node);
        return;
      }

      // 3. Tracking pixel images
      if (tagName === 'img') {
        const width = node.getAttribute('width');
        const height = node.getAttribute('height');
        if (width === '1' || height === '1') {
          removeQueue.push(node);
          return;
        }
      }

      // 4. Clutter and noise keyword matching
      const id = (node.id || "").toLowerCase();
      const className = typeof node.className === 'string' ? node.className.toLowerCase() : "";
      
      const isNoise = noiseKeywords.some(kw => id.includes(kw) || className.includes(kw));
      if (isNoise) {
        // Protect main contents or article nodes if they happen to contain a keyword in their wrapper class
        const isMainContentTag = ['main', 'article', 'section'].includes(tagName);
        if (!isMainContentTag) {
          removeQueue.push(node);
          return;
        }
      }

      // Recursively check children
      for (let i = 0; i < node.childNodes.length; i++) {
        checkNode(node.childNodes[i]);
      }
    }

    // Traverse and queue
    checkNode(body);

    // Perform removals
    removeQueue.forEach(node => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });

    // Strip inline formatting attributes but preserve content anchors
    function stripAttributes(node) {
      if (node.nodeType !== 1) return;
      
      const allowedAttrs = ['href', 'src', 'alt', 'title', 'action', 'method', 'type', 'name', 'placeholder', 'class', 'id'];
      const attrs = Array.from(node.attributes);
      attrs.forEach(attr => {
        if (!allowedAttrs.includes(attr.name)) {
          node.removeAttribute(attr.name);
        }
      });

      // Recurse
      for (let i = 0; i < node.childNodes.length; i++) {
        stripAttributes(node.childNodes[i]);
      }
    }
    
    stripAttributes(body);

    // Prune empty elements (e.g. empty divs or containers)
    function pruneEmpty(node) {
      if (node.nodeType !== 1) return;

      // Recurse first so inner empty nodes get pruned
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        pruneEmpty(node.childNodes[i]);
      }

      const tagName = node.tagName.toLowerCase();
      const isSelfClosing = ['img', 'input', 'br', 'hr'].includes(tagName);
      
      if (!isSelfClosing && node.childNodes.length === 0 && !node.innerText.trim()) {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    }
    pruneEmpty(body);

    return body;
  },

  /**
   * Parsers for specific DOM structures
   */
  parseTableElement(tableNode) {
    const headers = [];
    const rows = [];
    
    tableNode.querySelectorAll('tr').forEach(tr => {
      const rowData = [];
      const ths = tr.querySelectorAll('th');
      if (ths.length > 0) {
        ths.forEach(th => headers.push(th.innerText.trim()));
      } else {
        tr.querySelectorAll('td').forEach(td => rowData.push(td.innerText.trim()));
        if (rowData.length > 0) {
          rows.push(rowData);
        }
      }
    });
    
    return { type: "table", headers, rows };
  },

  parseFormElement(formNode) {
    const fields = [];
    const action = formNode.getAttribute('action') || "";
    const method = formNode.getAttribute('method') || "get";
    
    formNode.querySelectorAll('input, textarea, select, button').forEach(input => {
      const type = input.getAttribute('type') || input.tagName.toLowerCase();
      const name = input.getAttribute('name') || "";
      const placeholder = input.getAttribute('placeholder') || "";
      
      let label = "";
      if (input.id) {
        const labelEl = formNode.querySelector(`label[for="${input.id}"]`);
        if (labelEl) label = labelEl.innerText.trim();
      }
      if (!label) {
        const parent = input.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'label') {
          label = parent.innerText.trim();
        } else {
          const sibling = input.previousElementSibling;
          if (sibling && sibling.tagName.toLowerCase() === 'label') {
            label = sibling.innerText.trim();
          }
        }
      }
      
      fields.push({
        label: label || name || type,
        name,
        type,
        placeholder
      });
    });
    
    return { type: "form", action, method, fields };
  },

  parseListElement(listNode) {
    const listType = listNode.tagName.toLowerCase();
    const items = [];
    listNode.querySelectorAll('li').forEach(li => {
      items.push(li.innerText.trim());
    });
    return { type: "list", listType, items };
  },

  extractFaqData(node) {
    const faqs = [];
    const details = node.querySelectorAll('details');
    if (details.length > 0) {
      details.forEach(d => {
        const summary = d.querySelector('summary');
        if (summary) {
          const question = summary.innerText.trim();
          const clone = d.cloneNode(true);
          const sClone = clone.querySelector('summary');
          if (sClone) clone.removeChild(sClone);
          const answer = clone.innerText.trim();
          if (question && answer) faqs.push({ question, answer });
        }
      });
    }
    
    if (faqs.length === 0) {
      const headings = node.querySelectorAll('h1, h2, h3, h4, h5, h6, dt, strong');
      headings.forEach(h => {
        const text = h.innerText.trim();
        if (text.endsWith('?')) {
          let sibling = h.nextElementSibling;
          const answerParts = [];
          while (sibling && !/^h[1-6]$/i.test(sibling.tagName) && sibling.tagName.toLowerCase() !== 'dt') {
            if (sibling.innerText.trim()) {
              answerParts.push(sibling.innerText.trim());
            }
            sibling = sibling.nextElementSibling;
          }
          if (answerParts.length > 0) {
            faqs.push({ question: text, answer: answerParts.join('\n\n') });
          }
        }
      });
    }
    
    return { faqs };
  },

  extractPricingData(node) {
    const tiers = [];
    const elements = node.querySelectorAll('[class*="tier"], [class*="plan"], [class*="card"], [class*="price"], [class*="option"]');
    
    elements.forEach(el => {
      if (el.querySelector('[class*="tier"], [class*="plan"], [class*="card"], [class*="price"]')) return;
      
      const text = el.innerText.trim();
      if (!text) return;
      
      const priceMatch = text.match(/[\$\u00A2-\u00A5\u058F\u060B\u09F2\u09F3\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6]\s*\d+(?:\.\d{2})?/);
      if (priceMatch) {
        const price = priceMatch[0];
        const titleEl = el.querySelector('h1, h2, h3, h4, h5, h6, strong, [class*="title"], [class*="name"]');
        const title = titleEl ? titleEl.innerText.trim() : "Plan";
        
        const features = [];
        el.querySelectorAll('li').forEach(li => {
          features.push(li.innerText.trim());
        });
        
        tiers.push({
          title,
          price,
          features,
          description: text.replace(title, "").replace(price, "").trim().split('\n')[0] || ""
        });
      }
    });
    
    return { tiers };
  },

  /**
   * Walks the clean DOM and returns a flat array of content elements (sequential).
   */
  buildOutline(element) {
    const items = [];
    const self = this;
    
    function walk(node) {
      if (node.nodeType === 1) { // ELEMENT_NODE
        const tag = node.tagName.toLowerCase();
        
        if (/^h[1-6]$/.test(tag)) {
          items.push({
            type: "heading",
            level: parseInt(tag.charAt(1), 10),
            text: node.innerText.trim()
          });
          return;
        }
        
        if (tag === 'p') {
          const text = node.innerText.trim();
          if (text) {
            items.push({ type: "paragraph", text });
          }
          return;
        }
        
        if (tag === 'pre' || tag === 'code') {
          const code = node.innerText;
          let language = "";
          const langMatch = node.className.match(/(?:lang|language)-(\w+)/i);
          if (langMatch) language = langMatch[1];
          
          // Avoid duplicate code blocks if nesting pre > code
          if (tag === 'pre' && node.querySelector('code')) {
            const codeEl = node.querySelector('code');
            const innerCode = codeEl.innerText;
            const innerLangMatch = codeEl.className.match(/(?:lang|language)-(\w+)/i);
            const innerLang = innerLangMatch ? innerLangMatch[1] : language;
            items.push({ type: "code", language: innerLang, code: innerCode });
          } else {
            items.push({ type: "code", language, code });
          }
          return;
        }
        
        if (tag === 'table') {
          const tableData = self.parseTableElement(node);
          items.push(tableData);
          return;
        }
        
        if (tag === 'form') {
          const formData = self.parseFormElement(node);
          items.push(formData);
          return;
        }
        
        if (tag === 'ul' || tag === 'ol') {
          const listData = self.parseListElement(node);
          items.push(listData);
          return;
        }
        
        if (tag === 'img') {
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || "";
          const title = node.getAttribute('title') || "";
          if (src) {
            items.push({ type: "image", src, alt, title });
          }
          return;
        }

        if (tag === 'blockquote') {
          items.push({ type: "blockquote", text: node.innerText.trim() });
          return;
        }
        
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          walk(children[i]);
        }
      }
    }

    walk(element);
    return items;
  },

  /**
   * Helper: converts flat outlines back into markdown strings.
   */
  generateMarkdownFromItems(items) {
    let md = "";
    items.forEach(item => {
      if (item.type === "heading") {
        md += `${"#".repeat(item.level)} ${item.text}\n\n`;
      } else if (item.type === "paragraph") {
        md += `${item.text}\n\n`;
      } else if (item.type === "blockquote") {
        md += `> ${item.text.replace(/\n/g, '\n> ')}\n\n`;
      } else if (item.type === "code") {
        md += `\`\`\`${item.language || ""}\n${item.code}\n\`\`\`\n\n`;
      } else if (item.type === "image") {
        md += `![${item.alt}](${item.src} "${item.title}")\n\n`;
      } else if (item.type === "list") {
        item.items.forEach((li, idx) => {
          const bullet = item.listType === "ol" ? `${idx + 1}.` : "*";
          md += `${bullet} ${li}\n`;
        });
        md += "\n";
      } else if (item.type === "table") {
        if (item.headers.length > 0 || item.rows.length > 0) {
          const headers = item.headers.length > 0 ? item.headers : Array(item.rows[0]?.length || 0).fill("");
          md += `| ${headers.join(" | ")} |\n`;
          md += `| ${headers.map(() => "---").join(" | ")} |\n`;
          item.rows.forEach(row => {
            md += `| ${row.join(" | ")} |\n`;
          });
          md += "\n";
        }
      } else if (item.type === "form") {
        md += `### Form: ${item.action || "Submit"}\n`;
        item.fields.forEach(f => {
          md += `* [ ] ${f.label} (${f.type})${f.placeholder ? ` [Placeholder: ${f.placeholder}]` : ""}\n`;
        });
        md += "\n";
      }
    });
    return md.trim();
  },

  /**
   * Organizes the flat outline array into a nested JSON hierarchy tree.
   */
  nestItems(flatItems) {
    const root = { type: "root", children: [] };
    const stack = [root];

    flatItems.forEach(item => {
      if (item.type === "heading") {
        while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
          stack.pop();
        }
        const parent = stack[stack.length - 1];
        const newNode = { ...item, children: [] };
        parent.children.push(newNode);
        stack.push(newNode);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.children) parent.children = [];
        parent.children.push(item);
      }
    });

    return root.children;
  },

  /**
   * Scrapes and groups elements by structural semantic blocks.
   */
  detectSemanticSections(element, url) {
    const sections = [];
    const self = this;
    
    function checkSemanticType(el) {
      const tag = el.tagName.toLowerCase();
      const id = (el.id || "").toLowerCase();
      const className = typeof el.className === 'string' ? el.className.toLowerCase() : "";
      
      if (tag === 'header') return 'header';
      if (tag === 'nav') return 'navigation';
      if (tag === 'footer') return 'footer';
      if (tag === 'aside') return 'sidebar';
      if (tag === 'table') return 'table';
      if (tag === 'form') return 'form';
      if (tag === 'pre' || tag === 'code') return 'code_example';
      
      if (id.includes('header') || className.includes('header')) return 'header';
      if (id.includes('footer') || className.includes('footer')) return 'footer';
      if (id.includes('sidebar') || className.includes('sidebar') || id.includes('aside') || className.includes('aside')) return 'sidebar';
      if (id.includes('nav') || className.includes('nav') || className.includes('menu')) return 'navigation';
      
      if (id.includes('hero') || className.includes('hero') || className.includes('jumbotron') || id.includes('jumbotron')) return 'hero';
      
      if (tag === 'details' || id.includes('faq') || className.includes('faq') || id.includes('q-and-a') || className.includes('q-and-a') || id.includes('accordion') || className.includes('accordion') || el.querySelector(':scope > details')) {
        return 'faq';
      }
      
      if (id.includes('pricing') || className.includes('pricing') || id.includes('plans') || className.includes('plans') || className.includes('pricing-table')) {
        return 'pricing';
      }
      
      if (id.includes('features') || className.includes('features') || id.includes('benefits') || className.includes('benefits') || className.includes('services')) {
        return 'features';
      }
      
      if (id.includes('timeline') || className.includes('timeline') || id.includes('roadmap') || className.includes('roadmap') || id.includes('history') || className.includes('history')) {
        return 'timeline';
      }
      
      if (id.includes('cards') || className.includes('cards') || className.includes('card-grid') || className.includes('card-list') || className.includes('grid-layout')) {
        return 'cards';
      }
      
      return null;
    }
    
    function extract(node) {
      if (node.nodeType !== 1) return;
      
      const type = checkSemanticType(node);
      if (type) {
        const headingEl = node.querySelector('h1, h2, h3, h4, h5, h6');
        const heading = headingEl ? headingEl.innerText.trim() : "";
        const flatContentItems = self.buildOutline(node);
        const contentMarkdown = self.generateMarkdownFromItems(flatContentItems);
        
        let elements = {};
        if (type === 'table') {
          elements = self.parseTableElement(node);
        } else if (type === 'form') {
          elements = self.parseFormElement(node);
        } else if (type === 'code_example') {
          const code = node.innerText;
          let language = "";
          const langMatch = node.className.match(/(?:lang|language)-(\w+)/i);
          if (langMatch) language = langMatch[1];
          elements = { code, language };
        } else if (type === 'pricing') {
          elements = self.extractPricingData(node);
        } else if (type === 'faq') {
          elements = self.extractFaqData(node);
        }
        
        sections.push({
          type: type,
          heading: heading,
          content: contentMarkdown,
          elements: elements
        });
        
        // Skip recursing child structures for atomic sections to prevent duplication
        if (['table', 'form', 'code_example', 'navigation', 'footer', 'header', 'faq', 'pricing'].includes(type)) {
          return;
        }
      }
      
      const children = node.childNodes;
      for (let i = 0; i < children.length; i++) {
        extract(children[i]);
      }
    }
    
    extract(element);
    
    // Fallback if no specific structures identified
    if (sections.length === 0) {
      const flatContentItems = self.buildOutline(element);
      const contentMarkdown = self.generateMarkdownFromItems(flatContentItems);
      sections.push({
        type: "main_content",
        heading: element.querySelector('h1, h2')?.innerText.trim() || "",
        content: contentMarkdown,
        elements: {}
      });
    }
    
    return sections;
  },

  /**
   * Main entry point: Extracts structured details from DOM Document.
   */
  extract(doc, url) {
    let domain = "unknown.com";
    try {
      domain = new URL(url).hostname;
    } catch(e) {}

    const meta = this.scrapeMetadata(doc, url);
    const cleanBody = this.cleanDOM(doc);
    
    const flatOutline = this.buildOutline(cleanBody);
    const tree = this.nestItems(flatOutline);
    const sections = this.detectSemanticSections(cleanBody, url);

    // Compute basic statistics
    let wordCount = 0;
    let imageCount = 0;
    let linkCount = 0;
    let tableCount = 0;
    let formCount = 0;

    flatOutline.forEach(item => {
      if (item.type === "paragraph" || item.type === "heading" || item.type === "blockquote") {
        wordCount += (item.text || "").split(/\s+/).filter(Boolean).length;
      } else if (item.type === "image") {
        imageCount++;
      } else if (item.type === "table") {
        tableCount++;
      } else if (item.type === "form") {
        formCount++;
      }
    });

    // Walk clean body to count link anchors
    linkCount = cleanBody.querySelectorAll('a').length;

    return {
      platform: "universal",
      type: "website",
      url: url,
      domain: domain,
      title: meta.title,
      description: meta.description,
      metadata: meta,
      stats: {
        wordCount,
        sectionCount: sections.length,
        imageCount,
        linkCount,
        tableCount,
        formCount
      },
      sections: sections,
      structuredContentTree: tree,
      flatOutline: flatOutline
    };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = UniversalExtractor;
}
