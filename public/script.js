//Globalt tasks array
let tasks = [];

//Fetch tasks fra start
loadTasks();

//When file input changes
const fileInputs = document.getElementsByClassName('fileInput');
Array.from(fileInputs).forEach((fileInput) => {
    fileInput.addEventListener('change', async () => {

        //tag fat i fil
        const file = fileInput.files[0];

        //opret ny formdata og append fil
        const formData = new FormData();
        formData.append('file', file);

        const fileExistsOnServerAlready = await checkForExistingXcel();

        if (fileExistsOnServerAlready) {
            const replaceFile = confirm(
                'Der er ellerede en eksisternde excel-fil på serveren. Vil du erstatte den eksisterende fil?'
            );

            if (!replaceFile) {
                fileInput.value = ''; //nulstil filinput
                return;
            }
        }

        uploadNewExcel(formData);
    })
});

//UPLOAD XCEL FIL
async function uploadNewExcel(file) {

    //send fil til server
    await fetch("http://localhost:3000/upload", {
        method: 'post',
        body: file
    });

    //fetch json efter upload
    loadTasks();
}

//fetch opgaver fra server
async function loadTasks() {
    const response = await fetch("http://localhost:3000/data");

    if (!response.ok) {
        if (response.status === 404) {
            //ingen xcel fil fundet
            console.log('ingen gemt excel fil blev fundet');
            renderStandardLandingPage();
            return [];
        }
    }

    tasks = await response.json(); //Opdaterer globalt array

    renderTasks(tasks);
    return tasks;
}

function renderTasks(tasksToRender) {
    const standardLandingPage = document.getElementById('standardLandingPage');
    standardLandingPage.style.display = 'none';

    const container = document.getElementById('renderedTasks');
    container.innerHTML = '';

    tasksToRender.forEach((task, i) => {
        const taskHTML =
            `<div class="taskContainer">
                <div class="taskPile">
                    <button class="pilOpKnap">
                        <img src="img/chevron.svg" id="arrowUp${i}" class="pil-op ${i === 0 ? 'hiddenArrow' : ''}" />
                    </button>
                    <p>${i + 1}</p>
                    <button class='pilNedKnap'>
                        <img src="img/chevron.svg" id="arrowDown${i}" class="pil-ned ${i === tasks.length - 1 ? 'hiddenArrow' : ''}" />
                    </button>
                </div>
                <div class='accordianTitel' id="taskInfoContainer${i}">
                    <p class="taskTitel">${task.Titel}</p>
                </div>
                <button id="toggleAccordian${i}" class="openAccordian">
                    <img src="img/plus.svg" id="toggleAccImg${i}" />
                </button>
            </div>`

        container.innerHTML += taskHTML;
    });

    //flyt item et index tilbage
    const arrowUpButtons = container.querySelectorAll('.pil-op');
    arrowUpButtons.forEach((button, i) => {
        button.addEventListener('click', () => {
            moveBack(tasks, i);
        })
    })

    function moveBack(arr, index) {
        if (index <= 0 || index >= arr.length) return; // kan ikke flytte første element tilbage
        const [item] = arr.splice(index, 1);  // fjern elementet
        arr.splice(index - 1, 0, item);      // indsæt det en position tilbage

        updateExcelOnServer(tasks);
        renderTasks(tasks);
    }

    //flyt item et index frem
    const arrowDownButtons = container.querySelectorAll('.pil-ned');
    arrowDownButtons.forEach((button, i) => {
        button.addEventListener('click', () => {
            moveForward(tasks, i);
        })
    })

    function moveForward(arr, index) {
        if (index >= arr.length - 1) return; // kan ikke flytte første element tilbage
        const [item] = arr.splice(index, 1);  // fjern elementet
        arr.splice(index + 1, 0, item);      // indsæt det en position tilbage

        updateExcelOnServer(tasks);
        renderTasks(tasks);
    }

    const openAccordianButtons = container.querySelectorAll('.openAccordian');

    openAccordianButtons.forEach((button, i) => {
        button.dataset.open = "false"; // toggle state

        button.addEventListener('click', () => {
            const isOpen = button.dataset.open === "true";

            if (isOpen) {
                closeTask(tasksToRender[i], i);
                button.dataset.open = "false";
            } else {
                openTask(tasksToRender[i], i);
                button.dataset.open = "true";
            }
        });
    });

    function openTask(task, index) {
        const taskInfoContainer = document.getElementById(`taskInfoContainer${index}`);

        const toggleImg = document.getElementById(`toggleAccImg${index}`);
        toggleImg.src = 'img/minus.svg';

        taskInfoContainer.innerHTML = `
            <div class="taskItem">
                <p class='label mini-header' >Titel:</p>
                <p class='fieldDisplay' >${task.Titel}</p>
            </div>

            <div class="taskItem">
                <p class='label mini-header' >Beskrivelse:</p>
                <p class='fieldDisplay' >${task.Beskrivelse || "-"}</p>
            </div>
            
            <div class="taskItem">
                <p class='label mini-header' >Type:</p>
                <p>${task.Type}</p>
            </div>
            
            <div class="taskItem">
               <p class='label mini-header' >Aktiveringsbetingelse:</p>
                <p>${task.Aktiveringsbetingelse || "-"}</p> 
            </div>
            
            <div class="taskItem">
                <p class='label mini-header' >Lokation:</p>
                <p>
                    Lon: ${task.Lokation?.[0] ?? "-"} <br>
                    Lat: ${task.Lokation?.[1] ?? "-"}
                </p>
            </div>

            <div class="taskItem">
                <p class='label mini-header' >Radius:</p>
                <p>${task.Radius ?? "-"}</p>
            </div>
            
            <div class="taskItem">
                <p class='label mini-header' >Valgmuligheder:</p>
                <ul>
                    ${task.Valgmuligheder?.length
                ? task.Valgmuligheder.map(v => `<li>${v}</li>`).join("")
                : "<li>-</li>"
            }
                </ul>
            </div>
            <div class="btnContainer">
                <button class='btn btn1' id="editTask${index}">Redigér opgave</button>
                <button class='btn btn2' id="deleteTask${index}">Slet opgave</button>
            </div>
        `;

        const editTaskButton = document.getElementById(`editTask${index}`);
        editTaskButton.addEventListener('click', () => {
            console.log("EDIT CLICK", task, index);
            editTask(task, index);
        });

        const deleteTaskButton = document.getElementById(`deleteTask${index}`);
        deleteTaskButton.addEventListener('click', async () => {

            const confirmDelete = confirm('Sikker på, at du vil slette opgave?');

            if (!confirmDelete) return;

            tasks.splice(index, 1);

            await updateExcelOnServer(tasks);
            await loadTasks();
        })
    }

    function closeTask(task, index) {
        const taskInfoContainer = document.getElementById(`taskInfoContainer${index}`);

        const toggleImg = document.getElementById(`toggleAccImg${index}`);
        toggleImg.src = 'img/plus.svg';

        taskInfoContainer.innerHTML = `<p class="taskTitel">${task.Titel}</p>`;
    }

    function editTask(task, index) {
        const taskInfoContainer = document.getElementById(`taskInfoContainer${index}`);

        taskInfoContainer.innerHTML = `
            <div class="editItem">
                <label>Titel:</label >
                <input id="editTitle${index}" type="text" value="${task.Titel}">
            </div>

            <div class="editItem">
                <label>Beskrivelse:</label>
                <textarea id="editDescription${index}">${task.Beskrivelse || ""}</textarea>
            </div>

            <div class="editItem">
                <label>Type:</label>

                <label>
                    <input
                        type="radio"
                        name="editType${index}"
                        value="Land"
                        ${task.Type === "Land" ? "checked" : ""}
                    >
                    Land
                </label>

                <label>
                    <input
                        type="radio"
                        name="editType${index}"
                        value="Sø"
                        ${task.Type === "Sø" ? "checked" : ""}
                    >
                    Sø
                </label>
            </div>

            <div class="editItem">
                <label>Aktiveringsbetingelse:</label>
                <input id="editAktiveringsbetingelse${index}" type="text" value="${task.Aktiveringsbetingelse}">
            </div>

            <div class="editItem">
                <label>Lokation</label>
                <input id="editLokationLon${index}" type="number" value="${task.Lokation[0]}">
                <input id="editLokationLat${index}" type="number" value="${task.Lokation[1]}">
            </div>

            <div class="editItem">
                <label>Radius:</label>
                <input id="editRadius${index}" type="number" value="${task.Radius}">
            </div>

            <div class="editItem">
                <label>Valgmuligheder (adskild items med ;):</label>
                <input
                    type="text"
                    id="editValgmuligheder${index}"
                    value="${task.Valgmuligheder?.join("; ") || ""}"
                >
            </div>

            <div class="editButtons">
                <button id="saveTask${index}">Gem</button>
                <button id="cancelEdit${index}">Annuller</button>
            </div>
        `;

        const saveTaskButton = document.getElementById(`saveTask${index}`);
        saveTaskButton.addEventListener('click', () => saveEditedTask(task, index));

        const cancelEditButton = document.getElementById(`cancelEdit${index}`);
        cancelEditButton.addEventListener('click', () => openTask(task, index));
    }

    async function saveEditedTask(task, index) {

        const updatedTask = {
            ...task,
            Titel: document.getElementById(`editTitle${index}`).value,
            Beskrivelse: document.getElementById(`editDescription${index}`).value,
            Type: document.querySelector(
                `input[name="editType${index}"]:checked`
            )?.value,
            Aktiveringsbetingelse: document.getElementById(`editAktiveringsbetingelse${index}`).value,
            Lokation: [
                Number(document.getElementById(`editLokationLon${index}`).value),
                Number(document.getElementById(`editLokationLat${index}`).value)
            ],
            Radius: Number(document.getElementById(`editRadius${index}`).value),
            Valgmuligheder: document.getElementById(`editValgmuligheder${index}`).value.split('; ').map(v => v.trim())
                .filter(Boolean)
        };

        // Opdatér arrayet
        tasks[index] = updatedTask;

        //Send opdateret array til server
        await updateExcelOnServer(tasks);

        renderTasks(tasks);

        const toggleButton = document.getElementById(`toggleAccordian${index}`);
        toggleButton.dataset.open = "true";

        // Vis opgaven igen
        openTask(updatedTask, index);

        console.log("Opgave opdateret:", updatedTask);
    }
}

//Tilføj ny opgave i frontend
const saveNewTaskButton = document.getElementById('gemBtn');
saveNewTaskButton.addEventListener('click', addNewTaskInUI);

const openNewTaskFormButton = document.getElementById('tilføjNyBtn');

openNewTaskFormButton.addEventListener('click', () => {
    const newTaskFormContainer = document.getElementById('task-form');

    const closeTaskButton = document.getElementById('closeTaskForm');
    closeTaskButton.addEventListener('click', () => {
        newTaskFormContainer.style.display = 'none';
    })

    newTaskFormContainer.style.display = 'flex';
})


async function addNewTaskInUI() {
    const newTask = {
        Titel: document.getElementById("title").value,
        Beskrivelse: document.getElementById("desc").value,
        Type: document.querySelector('.nyOpgWrapper .typeRadio:checked').value,
        Aktiveringsbetingelse: document.getElementById("condition").value,
        Lokation: [
            Number(document.getElementById("longitudeInput").value),
            Number(document.getElementById("latitudeInput").value)
        ],
        Radius: Number(document.getElementById("radiusInput").value),
        Valgmuligheder: document
            .getElementById("options")
            .value
            .split(";")
            .map(v => v.trim())
            .filter(Boolean)
    };

    // push til array
    tasks.push(newTask);

    // send HELE arrayet til server
    await updateExcelOnServer(tasks);

    // re-render
    renderTasks(tasks);

    console.log("Ny opgave tilføjet:", newTask);

    //Skjul form container
    const newTaskFormContainer = document.getElementById('task-form');
    newTaskFormContainer.style.display = 'none';

    //Nulstil input felter
    resetNewTaskForm();
}

function resetNewTaskForm() {
    document.getElementById("title").value = "";
    document.getElementById("desc").value = "";

    // Type → tilbage til Land
    document.getElementById("landRadio").checked = true;

    document.getElementById("longitudeInput").value = "";
    document.getElementById("latitudeInput").value = "";

    document.getElementById("radiusInput").value = 0;

    document.getElementById("options").value = "";
    document.getElementById("condition").value = "";
}



//Opdater excel-fil på server
async function updateExcelOnServer(tasks) {
    const res = await fetch("http://localhost:3000/update-excel", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(tasks)
    });

    if (!res.ok) {
        console.error("Kunne ikke opdatere Excel");
    }
}


//Check for existing excel file on server
async function checkForExistingXcel() {
    const res = await fetch('http://localhost:3000/checkForExistingXcel');
    if (res.ok) {
        // Fil findes → spørg bruger: merge eller erstat
        return true;
    } else {
        // Fil findes ikke → upload direkte
        return false;
    }
}

//RENDER STANDARD LANDING PAGE
function renderStandardLandingPage() {
    const standardLandingPage = document.getElementById('standardLandingPage');
    standardLandingPage.style.display = 'block';

    //download template button
    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    downloadTemplateButton.addEventListener("click", async () => {
        try {
            const res = await fetch("http://localhost:3000/template");
            if (!res.ok) {
                console.error("Kunne ikke hente skabelon:", res.status);
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            // Hvis server sætter Content-Disposition med filnavn, kan du lade browser bestemme.
            // Ellers tving et navn:
            a.download = "skabelon.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();

            // Frigør blob URL efter kort tid
            setTimeout(() => URL.revokeObjectURL(url), 10000);

        } catch (err) {
            console.error("Fejl ved download af skabelon:", err);
        }
    });
}
