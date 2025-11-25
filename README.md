# Olocus Website

Official website for Olocus - Privacy-preserving location infrastructure and decentralised trust protocol.

## 🌐 Live Site
[https://olocus.com](https://olocus.com)

## 🏗️ Project Structure

```
olocus-website/
├── *.html              # Main website pages
├── css/                # Stylesheets
├── images/             # Images and graphics
├── js/                 # JavaScript files
├── templates/          # HTML page templates
├── scripts/            # Build and validation scripts
├── docs/               # Documentation
├── .githooks/          # Git hooks for automation
├── .vscode/            # VS Code snippets and settings
├── robots.txt          # Search engine directives
├── sitemap.xml         # XML sitemap
└── manifest.json       # PWA manifest
```

## 🚀 SEO & AI Bot Standards

This website is optimized for maximum AI bot readability with a score of **9.5/10**.

### Every page includes:
- ✅ Complete meta tags (description, keywords, author)
- ✅ Open Graph tags for social sharing
- ✅ Twitter Card metadata
- ✅ Structured data (JSON-LD)
- ✅ Canonical URLs
- ✅ ARIA labels for accessibility
- ✅ Semantic HTML structure
- ✅ Mobile-responsive design

### 📋 Creating New Pages

1. **Use the template:**
   ```bash
   cp templates/page-template.html new-page.html
   ```

2. **Or use VS Code snippets:**
   - Type `olocus-page` for complete page template
   - Type `og-meta` for Open Graph tags
   - Type `schema-page` for structured data

3. **Follow the checklist:**
   See `docs/SEO-CHECKLIST.md` for complete requirements

4. **Validate before committing:**
   ```bash
   node scripts/validate-seo.js
   ```

## 🛠️ Development

### Prerequisites
- Node.js (for validation scripts)
- Git

### Setup
```bash
# Clone the repository
git clone https://github.com/olocus/olocus-website.git
cd olocus-website

# Enable git hooks
git config core.hooksPath .githooks
```

### Validation

#### Manual validation:
```bash
node scripts/validate-seo.js
```

#### Automatic validation:
The pre-commit hook automatically validates all HTML files before allowing commits.

#### Bypass validation (not recommended):
```bash
git commit --no-verify
```

## 📊 SEO Tools & Testing

### Recommended testing tools:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Facebook Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
- [WAVE Accessibility Checker](https://wave.webaim.org/)
- [PageSpeed Insights](https://pagespeed.web.dev/)

### Performance targets:
- PageSpeed Score: 90+ (mobile & desktop)
- Accessibility: WCAG AA compliance
- SEO Score: 95+
- Best Practices: 95+

## 🤖 AI Bot Optimization

### Supported AI bots:
- ✅ Google (Googlebot)
- ✅ Bing (Bingbot)
- ✅ OpenAI (GPTBot, ChatGPT-User)
- ✅ Anthropic (Claude-Web)
- ✅ Perplexity (PerplexityBot)
- ✅ Social platforms (Facebook, Twitter, LinkedIn)

### Key features:
- Comprehensive structured data for rich snippets
- Open Graph for beautiful social cards
- Semantic HTML for better understanding
- Accessibility compliance for all users
- Fast load times and mobile optimization

## 📝 Documentation

- `docs/SEO-CHECKLIST.md` - Complete SEO requirements checklist
- `templates/page-template.html` - Standard page template
- `.vscode/olocus-seo.code-snippets` - VS Code snippets for common patterns

## 🔄 Updating the Sitemap

When adding new pages:
1. Add the page URL to `sitemap.xml`
2. Set appropriate `changefreq` and `priority`
3. Update `lastmod` date

## 🚦 Status

All pages currently meet or exceed SEO standards:
- ✅ index.html
- ✅ enterprise.html
- ✅ about.html
- ✅ technology.html
- ✅ vision.html
- ✅ privacy.html
- ✅ terms.html

## 📄 License

© 2025 Olocus CIC. All rights reserved.

## 🤝 Contributing

1. Use the page template for new pages
2. Run SEO validation before committing
3. Follow the SEO checklist
4. Test with recommended tools
5. Maintain 9+ AI bot score

## 📧 Contact

- Email: hello@olocus.com
- Website: https://olocus.com
- GitHub: https://github.com/olocus