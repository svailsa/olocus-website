# SEO & AI Bot Optimization Checklist

## 🚀 New Page Creation Checklist

When creating a new page for the Olocus website, ensure ALL of the following requirements are met:

### ✅ Required Meta Tags

- [ ] **Page Title**: Unique, descriptive, 50-60 characters
  ```html
  <title>[Page Title] - Olocus</title>
  ```

- [ ] **Meta Description**: Unique, compelling, 155 characters max
  ```html
  <meta name="description" content="[Unique description]">
  ```

- [ ] **Meta Keywords**: Relevant to page content
  ```html
  <meta name="keywords" content="keyword1, keyword2, keyword3">
  ```

- [ ] **Canonical URL**: Prevent duplicate content issues
  ```html
  <link rel="canonical" href="https://olocus.com/[page-url]">
  ```

- [ ] **Language Declaration**: On HTML tag
  ```html
  <html lang="en">
  ```

### ✅ Open Graph Tags (Required)

- [ ] **og:type**: Usually "website" or "article"
- [ ] **og:url**: Full URL of the page
- [ ] **og:title**: Can differ slightly from page title
- [ ] **og:description**: Can be longer than meta description
- [ ] **og:image**: 1200x630px recommended
- [ ] **og:site_name**: Always "Olocus"

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://olocus.com/[page]">
<meta property="og:title" content="[Title]">
<meta property="og:description" content="[Description]">
<meta property="og:image" content="https://olocus.com/images/[page]-og-image.png">
<meta property="og:site_name" content="Olocus">
```

### ✅ Twitter Card Tags (Required)

- [ ] **twitter:card**: "summary_large_image"
- [ ] **twitter:url**: Same as og:url
- [ ] **twitter:title**: Same as og:title
- [ ] **twitter:description**: Same as og:description
- [ ] **twitter:image**: Same as og:image

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="https://olocus.com/[page]">
<meta name="twitter:title" content="[Title]">
<meta name="twitter:description" content="[Description]">
<meta name="twitter:image" content="https://olocus.com/images/[page]-og-image.png">
```

### ✅ Structured Data (JSON-LD)

Every page MUST include at minimum:

```javascript
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://olocus.com/#organization",
      // ... organization details
    },
    {
      "@type": "WebSite",
      "@id": "https://olocus.com/#website",
      // ... website details
    },
    {
      "@type": "WebPage",
      "@id": "https://olocus.com/[page]#webpage",
      // ... page-specific details
    }
  ]
}
```

#### Page-Specific Schema Types:
- **Product pages**: Use `Product` or `Service` schema
- **Blog/Articles**: Use `Article` or `BlogPosting` schema
- **FAQ sections**: Use `FAQPage` schema
- **About page**: Use `AboutPage` schema
- **Contact page**: Use `ContactPage` schema
- **Legal pages**: Use appropriate legal schemas

### ✅ Accessibility Requirements

- [ ] **Skip Links**: At least to main content and footer
  ```html
  <a href="#main-content" class="skip-link">Skip to main content</a>
  ```

- [ ] **ARIA Labels**: On all major sections
  ```html
  <section aria-label="Section name" role="region">
  ```

- [ ] **Semantic HTML**: Use proper elements
  - `<main>` for main content
  - `<section>` for content sections
  - `<article>` for self-contained content
  - `<nav>` for navigation
  - `<aside>` for sidebar content

- [ ] **Alt Text**: On ALL images
  ```html
  <img src="image.jpg" alt="Descriptive text">
  ```

- [ ] **Heading Hierarchy**: Only one H1, logical H2-H6 structure

### ✅ Technical Requirements

- [ ] **Mobile Responsive**: Test on multiple devices
- [ ] **Page Speed**: Optimize images, minimize CSS/JS
- [ ] **HTTPS**: All resources must use HTTPS
- [ ] **No Broken Links**: Verify all internal and external links
- [ ] **Favicon**: Include favicon link
- [ ] **Manifest**: Link to manifest.json

### ✅ Content Requirements

- [ ] **Unique Content**: No duplicate content from other pages
- [ ] **Minimum Length**: At least 300 words of meaningful content
- [ ] **Internal Linking**: Link to relevant internal pages
- [ ] **External Linking**: Link to authoritative sources where appropriate
- [ ] **CTA Elements**: Clear calls-to-action

## 📋 Pre-Launch Checklist

Before deploying a new page:

1. [ ] Run validation script: `npm run validate-seo`
2. [ ] Test with Google Rich Results Test
3. [ ] Check with WAVE accessibility tool
4. [ ] Validate HTML with W3C validator
5. [ ] Test page speed with PageSpeed Insights
6. [ ] Preview social sharing with debugger tools:
   - [Facebook Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
7. [ ] Update sitemap.xml with new page
8. [ ] Add page to navigation if needed

## 🔧 Common Schema.org Types

### Article Page
```json
{
  "@type": "Article",
  "headline": "Article Title",
  "description": "Article description",
  "author": {
    "@type": "Organization",
    "name": "Olocus"
  },
  "datePublished": "2025-11-25",
  "dateModified": "2025-11-25"
}
```

### Product/Service Page
```json
{
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
```

### FAQ Section
```json
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Question text?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Answer text"
    }
  }]
}
```

## 🚨 Red Flags to Avoid

- ❌ Missing meta descriptions
- ❌ Duplicate title tags
- ❌ No structured data
- ❌ Missing alt text on images
- ❌ Broken internal links
- ❌ Inline styles instead of classes
- ❌ No mobile optimization
- ❌ Missing canonical tags
- ❌ No Open Graph tags
- ❌ Poor heading hierarchy

## 📚 Resources

- [Schema.org Documentation](https://schema.org/)
- [Google Structured Data Guidelines](https://developers.google.com/search/docs/advanced/structured-data/intro-structured-data)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 🎯 Goal

Every page should achieve:
- **AI Bot Score**: 9+/10
- **Accessibility Score**: AA compliance minimum
- **Page Speed**: 90+ on mobile and desktop
- **Rich Snippets**: Eligible for enhanced search results
- **Social Sharing**: Beautiful preview cards on all platforms