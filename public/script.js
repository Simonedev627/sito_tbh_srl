document.addEventListener('DOMContentLoaded', () => {
  const vantaggi = document.querySelectorAll('.vantaggio');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.style.opacity = 1;
        entry.target.style.transform = 'translateY(0)';
        entry.target.style.transition = 'all 0.6s ease-out';
        observer.unobserve(entry.target); // animazione una sola volta
      }
    });
  }, { threshold: 0.2 });

  vantaggi.forEach(v => observer.observe(v));
});



const elements = document.querySelectorAll('.dubbio');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('show');
    }
  });
}, { threshold: 0.2 });

elements.forEach(el => observer.observe(el));


// Seleziona tutti i paragrafi all'interno di .bot-description
const paragraphs = document.querySelectorAll('.bot-description p');

// Funzione per controllare se un elemento è in viewport
function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.bottom >= 0
    );
}

// Funzione da eseguire allo scroll
function checkScroll() {
    paragraphs.forEach(p => {
        if (isInViewport(p)) {
            p.classList.add('in-view');
        }
    });
}

// Ascolta l'evento scroll e al load
window.addEventListener('scroll', checkScroll);
window.addEventListener('load', checkScroll);



// Funzione per verificare se un elemento è in viewport
// Funzione per verificare se un elemento è abbastanza visibile nel viewport
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

