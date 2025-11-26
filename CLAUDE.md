# CLAUDE.md - AI Assistant Guide

## Project Overview
Static HTML website for Olocus with PWA capabilities. SEO-optimized with strict validation requirements.

## Tech Stack
- **Framework**: None - vanilla HTML/CSS/JS
- **Build**: No compilation - direct HTML deployment
- **Validation**: Node.js scripts + pre-commit hooks

## Directory Structure
```
*.html              # Main pages (index, about, enterprise, technology, vision, privacy, terms, 404)
css/                # Stylesheets (common.css)
js/                 # JavaScript modules (load-components.js, search.js, pwa-init.js)
images/             # Image assets
templates/          # page-template.html
scripts/            # validate-seo.js
docs/               # SEO-CHECKLIST.md, documentation
.githooks/          # pre-commit hook
```

## Commands
```bash
node scripts/validate-seo.js        # SEO validation (run before commit)
git config core.hooksPath .githooks # Enable pre-commit hook
```

## Page Requirements (Every HTML Page)
**Required Meta Tags**:
- `<title>` (50-60 chars, format: "[Title] - Olocus")
- `<meta name="description">` (155 chars max, unique per page)
- `<meta name="keywords">`
- Open Graph tags: og:type, og:url, og:title, og:description, og:image
- Twitter Card tags
- `<link rel="canonical">`

**Required Structure**:
- Semantic HTML: `<main>`, `<section>`, `<header>`, `<footer>`
- Skip links for accessibility
- ARIA labels and roles on major sections
- JSON-LD structured data (Organization + WebSite + WebPage)
- Single H1 per page

## Key Patterns
- Header/footer loaded dynamically via `load-components.js`
- CSS custom properties for theming (--primary, --primary-dark)
- Fonts: Plus Jakarta Sans (headings) + Inter (body)
- OG images: 1200x630px PNG/JPG
- PWA: manifest.json + service-worker.js

## Creating New Pages
1. Copy `templates/page-template.html`
2. Update all meta tags per docs/SEO-CHECKLIST.md
3. Run `node scripts/validate-seo.js`
4. Update `sitemap.xml`
