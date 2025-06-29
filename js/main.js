// Main JavaScript for House Lot & Land Sales Co. LLC Website

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all functionality
    initMobileNavigation();
    initFAQ();
    initSmoothScrolling();
    initFormHandling();
    initScrollEffects();
    initContactForm();
    initHeroCarousel();
});

// Mobile Navigation
function initMobileNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            
            // Animate hamburger menu
            const bars = navToggle.querySelectorAll('.bar');
            bars.forEach((bar, index) => {
                if (navToggle.classList.contains('active')) {
                    if (index === 0) bar.style.transform = 'rotate(45deg) translate(5px, 5px)';
                    if (index === 1) bar.style.opacity = '0';
                    if (index === 2) bar.style.transform = 'rotate(-45deg) translate(7px, -6px)';
                } else {
                    bar.style.transform = 'none';
                    bar.style.opacity = '1';
                }
            });
        });

        // Close mobile menu when clicking on a link
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                
                const bars = navToggle.querySelectorAll('.bar');
                bars.forEach(bar => {
                    bar.style.transform = 'none';
                    bar.style.opacity = '1';
                });
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                
                const bars = navToggle.querySelectorAll('.bar');
                bars.forEach(bar => {
                    bar.style.transform = 'none';
                    bar.style.opacity = '1';
                });
            }
        });
    }
}

// FAQ Functionality
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            const isActive = item.classList.contains('active');
            
            // Close all other FAQ items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            if (isActive) {
                item.classList.remove('active');
            } else {
                item.classList.add('active');
            }
        });
    });
}

// Smooth Scrolling for Navigation Links
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Form Handling
function initFormHandling() {
    const offerForm = document.getElementById('offer-form');
    
    if (offerForm) {
        // Add form validation
        addFormValidation(offerForm);
        
        offerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (validateForm(this)) {
                handleFormSubmission(this, 'Cash Offer Request');
            }
        });
    }
}

// Contact Form Handling
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        // Add form validation
        addFormValidation(contactForm);
        
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (validateForm(this)) {
                handleFormSubmission(this, 'Contact Form Submission');
            }
        });
    }
}

// Add form validation
function addFormValidation(form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        // Real-time validation
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
}

// Validate individual field
function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';
    
    // Remove existing error styling
    field.classList.remove('error');
    removeFieldError(field);
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'This field is required';
    }
    
    // Email validation
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    // Phone validation
    if (field.type === 'tel' && value) {
        const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        if (!phoneRegex.test(value.replace(/\D/g, ''))) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }
    }
    
    // Name validation
    if (fieldName === 'name' && value) {
        if (value.length < 2) {
            isValid = false;
            errorMessage = 'Name must be at least 2 characters';
        }
    }
    
    // Show error if invalid
    if (!isValid) {
        field.classList.add('error');
        showFieldError(field, errorMessage);
    }
    
    return isValid;
}

// Show field error
function showFieldError(field, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        color: #ef4444;
        font-size: 0.75rem;
        margin-top: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    `;
    
    field.parentNode.appendChild(errorDiv);
}

// Remove field error
function removeFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

// Validate entire form
function validateForm(form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Generic Form Submission Handler
function handleFormSubmission(form, formType) {
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    // Show loading state
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Track form submission
    trackEvent('form_submit', {
        form_id: form.id,
        form_type: formType,
        property_type: formData.get('property-type'),
        timeline: formData.get('timeline')
    });
    
    // Prepare data for submission
    const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        'property-address': formData.get('property-address'),
        'property-type': formData.get('property-type'),
        'property-condition': formData.get('property-condition'),
        timeline: formData.get('timeline'),
        'property-details': formData.get('property-details'),
        consent: formData.get('consent'),
        source: 'Website'
    };
    
    // Send to Google Apps Script Web App (Google Sheets)
    fetch('https://script.google.com/macros/s/AKfycbyBdPlRRf1LAzOt8_eQth6Z_72SpPNhuaNbjPmYBu767Bh5Gpm0nCS5_jVViillYynV/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.result === 'success' || result.success) {
            showFormSuccess(form);
            trackEvent('form_success', {
                form_id: form.id,
                form_type: formType
            });
            setTimeout(() => {
                form.reset();
                resetFormToOriginal(form, submitButton, originalText);
            }, 8000);
        } else {
            showNotification(result.message || 'There was an error. Please try again.', 'error');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            trackEvent('form_error', {
                form_id: form.id,
                form_type: formType,
                error: result.message
            });
        }
    })
    .catch(error => {
        console.error('Form submission error:', error);
        showNotification('Network error. Please call us at 214-702-1519 or try again later.', 'error');
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        trackEvent('form_error', {
            form_id: form.id,
            form_type: formType,
            error: 'Network error'
        });
    });
}

// Show form success state
function showFormSuccess(form) {
    const formCard = form.closest('.form-card');
    const originalContent = formCard.innerHTML;
    
    formCard.innerHTML = `
        <div class="form-success">
            <i class="fas fa-check-circle"></i>
            <h3>Thank You!</h3>
            <p>We've received your information and will contact you within 24 hours with your cash offer.</p>
            <p><strong>What happens next?</strong></p>
            <ul style="text-align: left; margin-top: 1rem;">
                <li>We'll review your property details</li>
                <li>You'll receive a fair cash offer within 24 hours</li>
                <li>No obligation - you decide if the offer works for you</li>
            </ul>
        </div>
    `;
    
    // Store original content for restoration
    formCard.dataset.originalContent = originalContent;
}

// Reset form to original state
function resetFormToOriginal(form, submitButton, originalText) {
    const formCard = form.closest('.form-card');
    
    if (formCard.dataset.originalContent) {
        formCard.innerHTML = formCard.dataset.originalContent;
        delete formCard.dataset.originalContent;
    }
    
    submitButton.textContent = originalText;
    submitButton.disabled = false;
}

// Enhanced phone number formatting
function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    
    if (value.length >= 6) {
        value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (value.length >= 3) {
        value = value.replace(/(\d{3})(\d{0,3})/, '($1) $2');
    }
    
    input.value = value;
}

// Initialize phone number formatting
document.addEventListener('DOMContentLoaded', function() {
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
        
        // Format on paste
        input.addEventListener('paste', function() {
            setTimeout(() => {
                formatPhoneNumber(this);
            }, 100);
        });
    });
    
    // Add focus effects to form fields
    const formFields = document.querySelectorAll('.form-group input, .form-group textarea, .form-group select');
    formFields.forEach(field => {
        field.addEventListener('focus', function() {
            this.parentNode.classList.add('focused');
        });
        
        field.addEventListener('blur', function() {
            this.parentNode.classList.remove('focused');
        });
    });
});

// Enhanced analytics tracking
function trackEvent(eventName, eventData = {}) {
    // Add timestamp and session info
    const enhancedData = {
        ...eventData,
        timestamp: new Date().toISOString(),
        session_id: getSessionId(),
        page_url: window.location.href,
        user_agent: navigator.userAgent
    };
    
    // Log for development
    console.log('Event tracked:', eventName, enhancedData);
    
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, enhancedData);
    }
    
    // Facebook Pixel (if available)
    if (typeof fbq !== 'undefined') {
        fbq('track', eventName, enhancedData);
    }
    
    // Store in localStorage for offline tracking
    storeEventForOffline(eventName, enhancedData);
}

// Generate session ID
function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

// Store events for offline tracking
function storeEventForOffline(eventName, eventData) {
    const events = JSON.parse(localStorage.getItem('offline_events') || '[]');
    events.push({
        event: eventName,
        data: eventData,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 events
    if (events.length > 50) {
        events.splice(0, events.length - 50);
    }
    
    localStorage.setItem('offline_events', JSON.stringify(events));
}

// Track form interactions
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        // Track form start
        const formFields = form.querySelectorAll('input, textarea, select');
        let hasInteracted = false;
        
        formFields.forEach(field => {
            field.addEventListener('focus', function() {
                if (!hasInteracted) {
                    trackEvent('form_start', {
                        form_id: form.id,
                        form_type: form.classList.contains('offer-form') ? 'cash_offer' : 'contact'
                    });
                    hasInteracted = true;
                }
            });
        });
        
        // Track form abandonment
        let abandonTimer;
        form.addEventListener('mouseleave', function() {
            abandonTimer = setTimeout(() => {
                trackEvent('form_abandon', {
                    form_id: form.id,
                    form_type: form.classList.contains('offer-form') ? 'cash_offer' : 'contact'
                });
            }, 30000); // 30 seconds
        });
        
        form.addEventListener('mouseenter', function() {
            if (abandonTimer) {
                clearTimeout(abandonTimer);
            }
        });
    });
    
    // Track phone clicks with enhanced data
    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    phoneLinks.forEach(link => {
        link.addEventListener('click', function() {
            trackEvent('phone_click', {
                phone_number: this.href.replace('tel:', ''),
                location: this.closest('section')?.id || 'unknown',
                text_content: this.textContent.trim()
            });
        });
    });
    
    // Track scroll depth
    let maxScroll = 0;
    window.addEventListener('scroll', function() {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            if (maxScroll % 25 === 0) { // Track at 25%, 50%, 75%, 100%
                trackEvent('scroll_depth', {
                    depth: maxScroll
                });
            }
        }
    });
});

// Scroll Effects
function initScrollEffects() {
    // Header scroll effect
    const header = document.querySelector('.header');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add/remove scrolled class for styling
        if (scrollTop > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Hide/show header on scroll (optional)
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.service-card, .step-card, .faq-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });
}

// Lazy loading for images (if needed)
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => imageObserver.observe(img));
    }
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Close button functionality
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Performance monitoring
window.addEventListener('load', function() {
    // Track page load time
    const loadTime = performance.now();
    trackEvent('page_load', {
        load_time: Math.round(loadTime)
    });
});

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    trackEvent('javascript_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno
    });
});

// Carousel functionality for hero section
function initHeroCarousel() {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) return;
    const slides = carousel.querySelectorAll('.carousel-slide');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const dotsContainer = document.getElementById('carousel-dots');
    let current = 0;
    let interval = null;

    // Create dots
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.className = idx === 0 ? 'active' : '';
        dot.setAttribute('aria-label', `Go to slide ${idx + 1}`);
        dot.addEventListener('click', () => goToSlide(idx));
        dotsContainer.appendChild(dot);
    });
    const dots = dotsContainer.querySelectorAll('button');

    function showSlide(idx) {
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === idx);
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === idx);
        });
        current = idx;
    }

    function goToSlide(idx) {
        showSlide(idx);
        resetInterval();
    }

    function nextSlide() {
        let next = (current + 1) % slides.length;
        showSlide(next);
    }

    function prevSlide() {
        let prev = (current - 1 + slides.length) % slides.length;
        showSlide(prev);
    }

    function resetInterval() {
        if (interval) clearInterval(interval);
        interval = setInterval(nextSlide, 4000);
    }

    // Event listeners
    nextBtn.addEventListener('click', () => {
        nextSlide();
        resetInterval();
    });
    prevBtn.addEventListener('click', () => {
        prevSlide();
        resetInterval();
    });

    // Start auto-slide
    resetInterval();

    // Pause on hover
    carousel.addEventListener('mouseenter', () => clearInterval(interval));
    carousel.addEventListener('mouseleave', resetInterval);
} 