const infoButtons = document.querySelectorAll('.info-btn');

// Klik på ikon → toggle tooltip
infoButtons.forEach(btn => {
  btn.addEventListener('click', (event) => {
    event.stopPropagation();

    const isOpen = btn.classList.contains('show-info');

    // Luk alle først
    infoButtons.forEach(b => b.classList.remove('show-info'));

    // Hvis den ikke var åben → åbn den
    if (!isOpen) {
      btn.classList.add('show-info');
    }
  });
});

// Klik på dokumentet → luk alle tooltips
document.addEventListener('click', () => {
  infoButtons.forEach(b => b.classList.remove('show-info'));
});