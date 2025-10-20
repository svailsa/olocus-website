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

// Load components when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Load header and footer
    const headerLoaded = await loadComponent('header-container', '/header.html');
    await loadComponent('footer-container', '/footer.html');
    
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