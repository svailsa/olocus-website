// Function to load HTML components
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.status}`);
        }
        const html = await response.text();
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error loading component ${filePath}:`, error);
        return false;
    }
}

// Function to initialize mobile menu after header loads
function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
}

// Function to initialize navigation scroll effect
function initializeNavScroll() {
    window.addEventListener('scroll', function() {
        const nav = document.getElementById('navbar');
        if (nav) {
            if (window.scrollY > 50) {
                nav.style.background = 'rgba(18, 18, 18, 0.98)';
                nav.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
            } else {
                nav.style.background = 'rgba(18, 18, 18, 0.95)';
                nav.style.boxShadow = 'none';
            }
        }
    });
}

// Function to load common CSS if not already loaded
function loadCommonCSS() {
    // Check if common CSS is already loaded
    const existingLink = document.querySelector('link[href="/css/common.css"]');
    if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/common.css';
        document.head.appendChild(link);
    }
}

// Function to detect iOS standalone mode
function detectIOSStandalone() {
    // Check if running as iOS webapp
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || 
                        window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && isStandalone) {
        document.documentElement.classList.add('pwa-standalone');
    }
}

// Function to handle back to top button
function initializeBackToTop() {
    // Create back to top button
    const backToTopBtn = document.createElement('button');
    backToTopBtn.className = 'back-to-top';
    backToTopBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
    `;
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    document.body.appendChild(backToTopBtn);
    
    // Show/hide based on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    // Scroll to top on click
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Function to handle scroll animations
function initializeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe all elements with fade-in-up class
    document.querySelectorAll('.fade-in-up').forEach(element => {
        observer.observe(element);
    });
}

// Function to load search functionality
function loadSearchScript() {
    const script = document.createElement('script');
    script.src = '/js/search.js?v=' + Date.now(); // Add cache-busting parameter
    script.async = true;
    document.head.appendChild(script);
}

// Load components when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Detect iOS standalone mode
    detectIOSStandalone();
    
    // Load common CSS
    loadCommonCSS();
    
    // Initialize back to top button
    initializeBackToTop();
    
    // Initialize scroll animations
    initializeScrollAnimations();
    
    // Load header and footer
    const headerLoaded = await loadComponent('header-container', '/header.html');
    await loadComponent('footer-container', '/footer.html');
    
    // Load search functionality after header loads
    if (headerLoaded) {
        loadSearchScript();
    }
    
    // Initialize functionality after header loads
    if (headerLoaded) {
        initializeMobileMenu();
        initializeNavScroll();
    }
    
    // Initialize smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            // Skip if href is just '#' or empty
            if (!href || href === '#') {
                return;
            }
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offset = 80; // Account for fixed nav
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                // Close mobile menu if open
                const navMenu = document.getElementById('navMenu');
                if (navMenu) {
                    navMenu.classList.remove('active');
                }
            }
        });
    });
});