
//Fetch tasks fra start
loadTasks();

//When file input changes
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', async () => {

    //tag fat i fil
    const file = fileInput.files[0];

    //opret ny formdata og append fil
    const formData = new FormData();
    formData.append('file', file);

    const fileExistsOnServerAlready = await checkForExistingXcel();

    if (fileExistsOnServerAlready) {
        askToMergeOrReplace(formData);
    } else uploadNewExcel(formData);
})

//UPLOAD XCEL FIL
async function uploadNewExcel(file) {

    //send fil til server
    await fetch("http://localhost:3000/upload", {
        method: 'post',
        body: file
    });

    //fetch json efter upload
    //const tasks = await loadTasks();
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

    const tasks = await response.json();

    renderTasks(tasks);

    return tasks;
}

function renderTasks(tasksToRender) {
    const standardLandingPage = document.getElementById('standardLandingPage');
    standardLandingPage.style.display = 'none';

    const container = document.getElementById('renderedTasks');

    tasksToRender.forEach((task, i) => {
        const taskHTML =
            `<div class="taskContainer">
                <div class="taskPile">
                    <button>pil op</button>
                    <p>${i + 1}</p>
                    <button>pil ned</button>
                </div>
                <div id="taskInfoContainer${i}">
                    <p class="taskTitel">${task.Titel}</p>
                </div>
                <button id="toggleAccordian${i}" class="openAccordian">Plus</button>
            </div>`

        container.innerHTML += taskHTML;
    });

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

        taskInfoContainer.innerHTML = `
            <div class="taskItem">
                <p>Titel:</p>
                <p>${task.Titel}</p>
            </div>

            <div class="taskItem">
                <p>Beskrivelse:</p>
                <p>${task.Beskrivelse || "-"}</p>
            </div>
            
            <div class="taskItem">
                <p>Type:</p>
                <p>${task.Type}</p>
            </div>
            
            <div class="taskItem">
               <p>Aktiveringsbetingelse:</p>
                <p>${task.Aktiveringsbetingelse || "-"}</p> 
            </div>
            
            <div class="taskItem">
                <p>Lokation:</p>
                <p>
                    Lon: ${task.Lokation?.[0] ?? "-"} <br>
                    Lat: ${task.Lokation?.[1] ?? "-"}
                </p>
            </div>

            <div class="taskItem">
                <p>Radius:</p>
                <p>${task.Radius ?? "-"}</p>
            </div>
            
            <div class="taskItem">
                <p>Valgmuligheder:</p>
                <ul>
                    ${task.Valgmuligheder?.length
                ? task.Valgmuligheder.map(v => `<li>${v}</li>`).join("")
                : "<li>-</li>"
            }
                </ul>
            </div>

            <button id="editTask${index}">Redigér opgave</button>
        `;

        const editTaskButton = document.getElementById(`editTask${index}`);
        editTaskButton.addEventListener('click', () => {
            console.log("EDIT CLICK", task, index);
            editTask(task, index);
        });

    }

    function closeTask(task, index) {
        const taskInfoContainer = document.getElementById(`taskInfoContainer${index}`);

        taskInfoContainer.innerHTML = `<p>${task.Titel}</p>`;
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
                <select id="editType${index}">
                    <option value="Land" ${task.Type === "Land" ? "selected" : ""}>Land</option>
                    <option value="Sø" ${task.Type === "Sø" ? "selected" : ""}>Sø</option>
                </select>
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
                <label>Valgmuligheder:</label>
                ${task.Valgmuligheder.map((valgmulighed, vIndex) => `
                    <input id="editValgmulighed${index}-${vIndex}" type="text" value="${valgmulighed}">
                `).join("")}
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
            Type: document.getElementById(`editType${index}`).value,
            Aktiveringsbetingelse: document.getElementById(`editAktiveringsbetingelse${index}`).value,
            Lokation: [
                Number(document.getElementById(`editLokationLon${index}`).value),
                Number(document.getElementById(`editLokationLat${index}`).value)
            ],
            Radius: Number(document.getElementById(`editRadius${index}`).value),
            Valgmuligheder: task.Valgmuligheder.map((_, vIndex) =>
                document.getElementById(`editValgmulighed${index}-${vIndex}`).value
            )
        };

        // Opdatér arrayet
        tasksToRender[index] = updatedTask;

        //Send opdateret array til server
        await updateExcelOnServer(tasksToRender);

        // Vis opgaven igen
        openTask(updatedTask, index);

        console.log("Opgave opdateret:", updatedTask);
    }
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

//Render pop-up to ask to merge with or replace new file
const askToMergeOrReplacePopUp = document.getElementById('askToMergeOrReplacePopUp');

function askToMergeOrReplace(newFile) {
    askToMergeOrReplacePopUp.style.display = 'block';

    //merge og replace knap
    const mergeButton = document.getElementById('mergeButton');
    const replaceButton = document.getElementById('replaceButton');

    mergeButton.addEventListener('click', () => mergeFiles(newFile));
    replaceButton.addEventListener('click', () => replaceFile(newFile));
}

async function mergeFiles(newFile) {
    askToMergeOrReplacePopUp.style.display = 'none';
    await fetch('http://localhost:3000/merge-files', {
        method: 'POST',
        body: newFile
    })

    //fetch json efter upload
    const tasks = await loadTasks();

    console.log(tasks);
}

async function replaceFile(newFile) {
    askToMergeOrReplacePopUp.style.display = 'none';
    await fetch('http://localhost:3000/replace-file', {
        method: 'POST',
        body: newFile
    })

    //fetch json efter upload
    const tasks = await loadTasks();

    console.log(tasks);
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
