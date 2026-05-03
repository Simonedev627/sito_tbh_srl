 const btn = document.querySelector('.bot');

  function checkScroll() {
    const rect = btn.getBoundingClientRect();
    if (rect.top < window.innerHeight - 50) {
      btn.classList.add('show');
      window.removeEventListener('scroll', checkScroll);
    }
  }

  window.addEventListener('scroll', checkScroll);
  window.addEventListener('load', checkScroll);