
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

    const taskArray = tasksToRender.map((task, i) => (
        `<div class="taskContainer">
            <div class="taskPile">
                <button>pil op</button>
                <p>${i + 1}</p>
                <button>pil ned</button>
            </div>
            <p class="taskTitel">${task.Titel}</p>
        </div>`
    )).join('');

    container.innerHTML = taskArray;
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
