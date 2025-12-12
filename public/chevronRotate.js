const typeFilterBtn = document.getElementById('typeFilterBtn')
const typeChevron = document.getElementById('typeChevron')
const typeDropdown = document.getElementById('typeDropdown')

const sorteringFilterBtn = document.getElementById('sorteringFilterBtn')
const sorteringChevron = document.getElementById('sorteringChevron')
const sorteringDropdown = document.getElementById('sorteringDropdown')

//let typeChevronOpen = false;
//let sorteringChevronOpen = false;

function setupToggle(btn, chevron, dropdown, state) {
    btn.addEventListener('click', () => {
        state.open = !state.open;
        chevron.classList.toggle('rotate-up', state.open);
        chevron.classList.toggle('rotate-down', !state.open);
        dropdown.classList.toggle('open');
        //dropdown.style.display = state.open ? 'flex' : 'none';
    });
}

setupToggle(typeFilterBtn, typeChevron, typeDropdown, {open: false});
setupToggle(sorteringFilterBtn, sorteringChevron, sorteringDropdown, {open: false});


