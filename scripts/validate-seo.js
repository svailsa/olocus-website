#!/usr/bin/env node

/**
 * SEO & AI Bot Optimization Validation Script
 * Ensures all HTML pages meet Olocus SEO standards
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Validation rules
const requiredMetaTags = [
  { name: 'description', type: 'meta', maxLength: 155 },
  { name: 'keywords', type: 'meta' },
  { name: 'author', type: 'meta' },
  { name: 'robots', type: 'meta' },
  { name: 'viewport', type: 'meta' }
];

const requiredOGTags = [
  'og:type',
  'og:url',
  'og:title',
  'og:description',
  'og:image',
  'og:site_name'
];

const requiredTwitterTags = [
  'twitter:card',
  'twitter:url',
  'twitter:title',
  'twitter:description',
  'twitter:image'
];

const requiredElements = [
  { selector: 'html[lang]', message: 'Missing lang attribute on html tag' },
  { selector: 'link[rel="canonical"]', message: 'Missing canonical URL' },
  { selector: 'title', message: 'Missing title tag' },
  { selector: 'main', message: 'Missing main element' },
  { selector: 'h1', message: 'Missing H1 tag', maxCount: 1 },
  { selector: 'script[type="application/ld+json"]', message: 'Missing structured data (JSON-LD)' }
];

const accessibilityChecks = [
  { selector: '.skip-link', message: 'Missing skip links for accessibility' },
  { selector: '[aria-label], [aria-labelledby]', message: 'Consider adding ARIA labels to sections' },
  { selector: 'img:not([alt])', message: 'Images without alt text found', shouldNotExist: true }
];

class SEOValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passes = [];
    this.currentFile = '';
  }

  validateFile(filePath) {
    this.currentFile = path.basename(filePath);
    this.errors = [];
    this.warnings = [];
    this.passes = [];

    console.log(`\n${colors.cyan}Validating: ${colors.bold}${this.currentFile}${colors.reset}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Run all validation checks
      this.checkMetaTags(content);
      this.checkOpenGraphTags(content);
      this.checkTwitterTags(content);
      this.checkRequiredElements(content);
      this.checkAccessibility(content);
      this.checkStructuredData(content);
      this.checkHeadingHierarchy(content);
      this.checkCanonicalURL(content, filePath);
      
      // Report results
      this.reportResults();
      
    } catch (error) {
      console.error(`${colors.red}Error reading file: ${error.message}${colors.reset}`);
      return false;
    }
    
    return this.errors.length === 0;
  }

  checkMetaTags(content) {
    requiredMetaTags.forEach(tag => {
      const regex = new RegExp(`<meta\\s+name="${tag.name}"\\s+content="([^"]+)"`, 'i');
      const match = content.match(regex);
      
      if (!match) {
        this.errors.push(`Missing required meta tag: ${tag.name}`);
      } else {
        if (tag.maxLength && match[1].length > tag.maxLength) {
          this.warnings.push(`Meta ${tag.name} exceeds ${tag.maxLength} characters (${match[1].length})`);
        }
        this.passes.push(`✓ Meta tag: ${tag.name}`);
      }
    });
  }

  checkOpenGraphTags(content) {
    requiredOGTags.forEach(tag => {
      const regex = new RegExp(`<meta\\s+property="${tag}"\\s+content="([^"]+)"`, 'i');
      if (!content.match(regex)) {
        this.errors.push(`Missing Open Graph tag: ${tag}`);
      } else {
        this.passes.push(`✓ OG tag: ${tag}`);
      }
    });
  }

  checkTwitterTags(content) {
    requiredTwitterTags.forEach(tag => {
      const regex = new RegExp(`<meta\\s+name="${tag}"\\s+content="([^"]+)"`, 'i');
      if (!content.match(regex)) {
        this.errors.push(`Missing Twitter Card tag: ${tag}`);
      } else {
        this.passes.push(`✓ Twitter tag: ${tag}`);
      }
    });
  }

  checkRequiredElements(content) {
    requiredElements.forEach(element => {
      const regex = new RegExp(`<${element.selector.replace(/\[.*?\]/, '.*?')}`, 'gi');
      const matches = content.match(regex);
      
      if (!matches || matches.length === 0) {
        this.errors.push(element.message);
      } else {
        if (element.maxCount && matches.length > element.maxCount) {
          this.warnings.push(`Multiple ${element.selector} found (${matches.length}). Should have only ${element.maxCount}.`);
        } else {
          this.passes.push(`✓ ${element.selector} present`);
        }
      }
    });
  }

  checkAccessibility(content) {
    accessibilityChecks.forEach(check => {
      if (check.shouldNotExist) {
        const regex = new RegExp(`<img(?![^>]*\\salt=)`, 'gi');
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          this.errors.push(`${check.message} (${matches.length} instances)`);
        }
      } else {
        const regex = new RegExp(check.selector.replace(/[\[\]]/g, '\\$&'), 'gi');
        if (!content.match(regex)) {
          this.warnings.push(check.message);
        }
      }
    });
  }

  checkStructuredData(content) {
    const jsonLdRegex = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    const matches = content.match(jsonLdRegex);
    
    if (!matches) {
      this.errors.push('No structured data (JSON-LD) found');
      return;
    }

    matches.forEach(match => {
      try {
        const jsonContent = match.replace(/<\/?script[^>]*>/gi, '').trim();
        const data = JSON.parse(jsonContent);
        
        // Check for required schema types
        const hasOrganization = this.checkSchemaType(data, 'Organization');
        const hasWebSite = this.checkSchemaType(data, 'WebSite');
        const hasWebPage = this.checkSchemaType(data, 'WebPage');
        
        if (!hasOrganization) this.warnings.push('Missing Organization schema');
        if (!hasWebSite) this.warnings.push('Missing WebSite schema');
        if (!hasWebPage) this.warnings.push('Missing WebPage schema');
        
        this.passes.push('✓ Valid JSON-LD structured data');
      } catch (e) {
        this.errors.push('Invalid JSON-LD structured data: ' + e.message);
      }
    });
  }

  checkSchemaType(data, type) {
    if (data['@type'] === type) return true;
    if (data['@graph']) {
      return data['@graph'].some(item => item['@type'] === type);
    }
    return false;
  }

  checkHeadingHierarchy(content) {
    const h1Matches = content.match(/<h1[^>]*>/gi);
    if (!h1Matches) {
      this.errors.push('No H1 tag found');
    } else if (h1Matches.length > 1) {
      this.warnings.push(`Multiple H1 tags found (${h1Matches.length}). Should have only 1.`);
    }

    // Check for skipped heading levels
    const headings = [];
    for (let i = 1; i <= 6; i++) {
      const regex = new RegExp(`<h${i}[^>]*>`, 'gi');
      if (content.match(regex)) {
        headings.push(i);
      }
    }

    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i-1] > 1) {
        this.warnings.push(`Skipped heading level: H${headings[i-1]} to H${headings[i]}`);
      }
    }
  }

  checkCanonicalURL(content, filePath) {
    const canonicalRegex = /<link\s+rel="canonical"\s+href="([^"]+)"/i;
    const match = content.match(canonicalRegex);
    
    if (match) {
      const canonicalURL = match[1];
      if (!canonicalURL.startsWith('https://olocus.com/')) {
        this.warnings.push('Canonical URL should use absolute URL starting with https://olocus.com/');
      }
      this.passes.push('✓ Canonical URL present');
    }
  }

  reportResults() {
    console.log('\n' + '─'.repeat(60));
    
    // Show passes (collapsed by default in real output)
    if (this.passes.length > 0) {
      console.log(`${colors.green}✓ ${this.passes.length} checks passed${colors.reset}`);
    }
    
    // Show warnings
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠ Warnings (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach(warning => {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${warning}`);
      });
    }
    
    // Show errors
    if (this.errors.length > 0) {
      console.log(`\n${colors.red}✗ Errors (${this.errors.length}):${colors.reset}`);
      this.errors.forEach(error => {
        console.log(`  ${colors.red}✗${colors.reset} ${error}`);
      });
    }
    
    // Summary
    const status = this.errors.length === 0 ? 
      `${colors.green}${colors.bold}PASSED${colors.reset}` : 
      `${colors.red}${colors.bold}FAILED${colors.reset}`;
    
    console.log(`\n${colors.bold}Status: ${status}`);
  }
}

// Main execution
function main() {
  const validator = new SEOValidator();
  const htmlFiles = [];
  
  // Find all HTML files
  const rootDir = process.cwd();
  const files = fs.readdirSync(rootDir);
  
  files.forEach(file => {
    if (file.endsWith('.html') && !file.startsWith('_')) {
      htmlFiles.push(path.join(rootDir, file));
    }
  });
  
  // Also check templates directory if it exists
  const templatesDir = path.join(rootDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    const templateFiles = fs.readdirSync(templatesDir);
    templateFiles.forEach(file => {
      if (file.endsWith('.html')) {
        htmlFiles.push(path.join(templatesDir, file));
      }
    });
  }
  
  console.log(`${colors.blue}${colors.bold}SEO & AI Bot Optimization Validator${colors.reset}`);
  console.log(`${colors.blue}Found ${htmlFiles.length} HTML files to validate${colors.reset}`);
  
  let allPassed = true;
  const results = [];
  
  htmlFiles.forEach(file => {
    const passed = validator.validateFile(file);
    results.push({ file: path.basename(file), passed });
    if (!passed) allPassed = false;
  });
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bold}VALIDATION SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    const status = result.passed ? 
      `${colors.green}✓${colors.reset}` : 
      `${colors.red}✗${colors.reset}`;
    console.log(`${status} ${result.file}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${passedCount} passed, ${failedCount} failed`);
  
  if (allPassed) {
    console.log(`\n${colors.green}${colors.bold}🎉 All pages meet SEO standards!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ Some pages need attention${colors.reset}`);
    console.log(`\n📚 See docs/SEO-CHECKLIST.md for detailed requirements`);
    process.exit(1);
  }
}

// Run the validator
if (require.main === module) {
  main();
}