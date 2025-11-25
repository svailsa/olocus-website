// Search functionality for Olocus website
(function() {
    // Search index - content from all pages
    const searchIndex = [
        // Homepage
        {
            title: "Home - Olocus",
            url: "/",
            content: "Privacy-preserving location infrastructure. Trust, Owned by You. Olocus is redefining trust for the digital age with a decentralised protocol that turns your real-world interactions into verifiable, privacy-protected digital assets.",
            keywords: ["home", "privacy", "location", "trust", "decentralized", "digital assets"]
        },
        // About
        {
            title: "About Olocus",
            url: "/about",
            content: "A Community Interest Company building trust infrastructure for the digital age. Learn about our mission to create a privacy-first location verification system.",
            keywords: ["about", "mission", "community interest company", "CIC", "social benefit"]
        },
        // Technology
        {
            title: "Technology",
            url: "/technology",
            content: "Zero-knowledge proofs and cryptographic verification. Learn how our privacy-preserving verification system works using decentralised architecture.",
            keywords: ["technology", "zero-knowledge proofs", "zkp", "cryptography", "blockchain"]
        },
        // Vision
        {
            title: "Our Vision",
            url: "/vision",
            content: "Building a trust graph owned by you. A future where trust is human, decentralised, and enduring. 2-5 million users in 10 years.",
            keywords: ["vision", "future", "trust graph", "roadmap", "mission"]
        },
        // Enterprise
        {
            title: "Enterprise Solutions",
            url: "/enterprise",
            content: "Verification without surveillance. The future of location intelligence is cryptographic verification, not data collection. Zero liability, automatic compliance.",
            keywords: ["enterprise", "business", "verification", "compliance", "GDPR", "liability"]
        },
        // Privacy
        {
            title: "Privacy Policy",
            url: "/privacy",
            content: "How we protect your privacy and handle your data. Complete privacy policy, GDPR compliance, data protection measures.",
            keywords: ["privacy", "privacy policy", "GDPR", "data protection", "compliance"]
        },
        // Terms
        {
            title: "Terms of Service",
            url: "/terms",
            content: "Terms and conditions for using Olocus platform and services. User agreement, platform terms, mobile app terms.",
            keywords: ["terms", "conditions", "legal", "agreement", "terms of service"]
        },
        // Use Cases
        {
            title: "Use Cases",
            url: "/#use-cases",
            content: "Fitness tracking, sustainable commutes, work attendance, dating verification, financial credit building, legal alibis.",
            keywords: ["use cases", "fitness", "sustainability", "work", "dating", "finance", "legal"]
        },
        // How It Works
        {
            title: "How It Works",
            url: "/#how-it-works",
            content: "Passive tracking, co-signing trust, earn and control, portable reputation, blockchain security.",
            keywords: ["how it works", "tracking", "co-signing", "reputation", "blockchain"]
        },
        // FAQ
        {
            title: "FAQ",
            url: "/#faq",
            content: "Frequently asked questions about battery usage, earnings, privacy protection, age requirements, trust scores.",
            keywords: ["faq", "questions", "battery", "earnings", "privacy", "trust score"]
        }
    ];

    // Initialize search when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        setupSearch();
    });

    function setupSearch() {
        // Wait for header to load, then setup search
        setTimeout(() => {
            const searchInput = document.querySelector('.search-input');
            const searchBtn = document.querySelector('.search-btn');
            const mobileSearchInput = document.querySelector('.mobile-search-input');
            const mobileSearchBtn = document.querySelector('.mobile-search-btn');
            
            if (searchInput && searchBtn) {
                // Create search results container
                createSearchResultsContainer();
                
                // Handle search input
                searchInput.addEventListener('input', debounce(handleSearch, 300));
                searchInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        handleSearch();
                    }
                });
                
                // Handle search button click
                searchBtn.addEventListener('click', handleSearch);
                
                // Setup mobile search if present
                if (mobileSearchInput && mobileSearchBtn) {
                    mobileSearchInput.addEventListener('input', debounce(handleMobileSearch, 300));
                    mobileSearchInput.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            handleMobileSearch();
                        }
                    });
                    mobileSearchBtn.addEventListener('click', handleMobileSearch);
                }
                
                // Close search results when clicking outside
                document.addEventListener('click', function(e) {
                    const searchContainer = document.querySelector('.search-container');
                    const resultsContainer = document.getElementById('search-results');
                    if (!searchContainer.contains(e.target) && resultsContainer) {
                        resultsContainer.style.display = 'none';
                    }
                });
            }
        }, 500);
    }

    function createSearchResultsContainer() {
        if (!document.getElementById('search-results')) {
            const resultsDiv = document.createElement('div');
            resultsDiv.id = 'search-results';
            resultsDiv.className = 'search-results-container';
            resultsDiv.style.cssText = `
                position: fixed;
                top: 70px;
                right: 20px;
                width: 400px;
                max-width: 90vw;
                max-height: 70vh;
                overflow-y: auto;
                background: var(--bg-dark-elevated);
                border: 1px solid var(--border-dark);
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                z-index: 1001;
                display: none;
                padding: 16px;
            `;
            document.body.appendChild(resultsDiv);
        }
    }

    function handleSearch() {
        const searchInput = document.querySelector('.search-input');
        const query = searchInput.value.toLowerCase().trim();
        performSearch(query);
    }
    
    function handleMobileSearch() {
        const mobileSearchInput = document.querySelector('.mobile-search-input');
        const query = mobileSearchInput.value.toLowerCase().trim();
        performSearch(query);
    }
    
    function performSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        
        if (!query) {
            resultsContainer.style.display = 'none';
            return;
        }
        
        // Search through index
        const results = searchIndex.filter(page => {
            const inTitle = page.title.toLowerCase().includes(query);
            const inContent = page.content.toLowerCase().includes(query);
            const inKeywords = page.keywords.some(keyword => keyword.toLowerCase().includes(query));
            return inTitle || inContent || inKeywords;
        });
        
        // Display results
        displaySearchResults(results, query);
    }

    function displaySearchResults(results, query) {
        const resultsContainer = document.getElementById('search-results');
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                    <p>No results found for "<strong>${escapeHtml(query)}</strong>"</p>
                    <p style="font-size: 14px; margin-top: 10px;">Try different keywords or check spelling</p>
                </div>
            `;
        } else {
            let html = `
                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-dark);">
                    <h3 style="font-size: 14px; color: var(--text-secondary); margin: 0;">
                        Found ${results.length} result${results.length > 1 ? 's' : ''} for "<strong style="color: var(--primary);">${escapeHtml(query)}</strong>"
                    </h3>
                </div>
                <div class="search-results-list">
            `;
            
            results.forEach(result => {
                const excerpt = getExcerpt(result.content, query);
                html += `
                    <a href="${result.url}" class="search-result-item" style="
                        display: block;
                        padding: 12px;
                        margin-bottom: 8px;
                        background: var(--bg-dark-card);
                        border-radius: 8px;
                        text-decoration: none;
                        border: 1px solid transparent;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateX(4px)';" 
                       onmouseout="this.style.borderColor='transparent'; this.style.transform='translateX(0)';">
                        <h4 style="color: var(--primary); margin: 0 0 4px 0; font-size: 16px;">${highlightMatch(result.title, query)}</h4>
                        <p style="color: var(--text-secondary); margin: 0; font-size: 14px; line-height: 1.4;">
                            ${highlightMatch(excerpt, query)}
                        </p>
                    </a>
                `;
            });
            
            html += '</div>';
            resultsContainer.innerHTML = html;
        }
        
        resultsContainer.style.display = 'block';
        
        // Add click handlers to close search on result click
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                resultsContainer.style.display = 'none';
                document.querySelector('.search-input').value = '';
            });
        });
    }

    function getExcerpt(content, query) {
        const queryIndex = content.toLowerCase().indexOf(query.toLowerCase());
        if (queryIndex === -1) return content.substring(0, 100) + '...';
        
        const start = Math.max(0, queryIndex - 40);
        const end = Math.min(content.length, queryIndex + query.length + 40);
        let excerpt = content.substring(start, end);
        
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
        
        return excerpt;
    }

    function highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark style="background: rgba(76, 175, 80, 0.3); color: var(--text-primary-dark); padding: 2px; border-radius: 2px;">$1</mark>');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Mobile responsive adjustments
    if (window.innerWidth < 768px) {
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                #search-results {
                    position: fixed !important;
                    top: 60px !important;
                    left: 10px !important;
                    right: 10px !important;
                    width: auto !important;
                    max-width: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
})();