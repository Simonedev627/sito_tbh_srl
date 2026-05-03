function isInViewport(el, threshold = 0.5) {
    const rect = el.getBoundingClientRect();
    const elementHeight = rect.height;

    // Calcola quanto dell'elemento è visibile sullo schermo
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

    // Percentuale visibile
    const visibleRatio = visibleHeight / elementHeight;

    return visibleRatio >= threshold; // true se almeno threshold visibile
}

// Seleziona elementi
const botWrapper = document.querySelector('.bot-wrapper');
const dubbio = document.querySelector('.dubbio');

// Funzione per animare gli elementi quando entrano in viewport
function animateOnScroll() {
    if (botWrapper && isInViewport(botWrapper, 0.5)) { // almeno 50% visibile
        botWrapper.classList.add('show');
    }
    if (dubbio && isInViewport(dubbio, 0.5)) { // almeno 50% visibile
        dubbio.classList.add('show');
    }
}

// Ascolta scroll e load
window.addEventListener('scroll', animateOnScroll);
window.addEventListener('load', animateOnScroll);

