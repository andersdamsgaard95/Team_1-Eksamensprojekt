'use strict';

const http = require("http");
const fs = require("fs");
const path = require("path");
const formidable = require("formidable");
const xlsx = require("xlsx");

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

function validateExcelFile(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
        throw new Error("Excel-filen er tom");
    }

    const requiredHeaders = [
        "Titel",
        "Beskrivelse",
        "Type",
        "Lokation",
        "Radius",
        "Valgmuligheder"
    ];

    const fileHeaders = Object.keys(rows[0]);

    for (const header of requiredHeaders) {
        if (!fileHeaders.includes(header)) {
            throw new Error(`Manglende kolonne: ${header}`);
        }
    }

    rows.forEach((row, i) => {
        const rowNr = i + 2;

        if (!row.Titel) {
            throw new Error(`Række ${rowNr}: Titel mangler`);
        }

        if (!["Land", "land", "Sø", "sø"].includes(row.Type)) {
            throw new Error(`Række ${rowNr}: Type skal være Land eller Sø`);
        }

        if (isNaN(Number(row.Radius))) {
            throw new Error(`Række ${rowNr}: Radius skal være et tal`);
        }

        const locationRegex = /^-?\d+(\.\d+)?,\s-?\d+(\.\d+)?$/;

        if (row.Lokation && !locationRegex.test(row.Lokation)) {
            throw new Error(`Række ${rowNr}: Lokation skal være "lon, lat" (fx "12.5683, 55.6761")`);
        }

    });

    return true;
}

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- CHECK IF FILE EXISTS ---
    if (pathname === "/checkForExistingXcel" && req.method === "GET") {
        const dataPath = path.join(__dirname, "uploads", "data.xlsx");
        res.writeHead(fs.existsSync(dataPath) ? 200 : 404, { "Content-Type": "text/plain" });
        res.end(fs.existsSync(dataPath) ? "File exists" : "File does not exist");
        return;
    }

    // --- STANDARD UPLOAD (første gang) ---
    if (pathname === "/upload" && req.method === "POST") {
        const form = new formidable.IncomingForm({ multiples: false });

        form.parse(req, (err, fields, files) => {
            if (err) {
                res.writeHead(500);
                res.end("Fejl ved upload");
                return;
            }

            let uploadedFile = files.file;
            if (Array.isArray(uploadedFile)) uploadedFile = uploadedFile[0];

            if (!uploadedFile) {
                res.writeHead(400);
                res.end("Ingen fil modtaget");
                return;
            }

            //filtype validering
            const allowedMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

            if (uploadedFile.mimetype !== allowedMime) {
                fs.unlinkSync(uploadedFile.filepath);
                res.writeHead(400);
                res.end("Kun .xlsx filer er tilladt");
                return;
            }

            //const dataPath = path.join(__dirname, "uploads", "data.xlsx");

            try {
                // valider Excel indhold før gem
                validateExcelFile(uploadedFile.filepath);

                const dataPath = path.join(__dirname, "uploads", "data.xlsx");

                // gem først når alt er OK
                fs.renameSync(uploadedFile.filepath, dataPath);

                res.writeHead(200);
                res.end("Excel uploadet og valideret");

            } catch (validationError) {
                fs.unlinkSync(uploadedFile.filepath);

                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    error: validationError.message
                }));
            }
        });

        return;
    }

    // UPDATE EXCEL-FILE FROM FRONTEND CHANGE
    if (pathname === '/update-excel' && req.method === 'POST') {

        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const tasks = JSON.parse(body);

                const dataPath = path.join(__dirname, "uploads", "data.xlsx");

                // Transformér data så Excel kan forstå det
                const excelRows = tasks.map((task, index) => ({
                    ID: index + 1,
                    Titel: task.Titel,
                    Beskrivelse: task.Beskrivelse,
                    Type: task.Type,
                    Aktiveringsbetingelse: task.Aktiveringsbetingelse,
                    Lokation: Array.isArray(task.Lokation)
                        ? task.Lokation.join(", ")
                        : "",
                    Radius: task.Radius,
                    Valgmuligheder: Array.isArray(task.Valgmuligheder)
                        ? task.Valgmuligheder.join("; ")
                        : ""
                }));

                const wb = xlsx.utils.book_new();
                const ws = xlsx.utils.json_to_sheet(excelRows);
                xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

                xlsx.writeFile(wb, dataPath);

                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("Excel opdateret");

            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end("Kunne ikke opdatere Excel");
            }
        });

        return;
    }


    // --- FETCH JSON DATA FRA EXCEL ---
    if (pathname === "/data" && req.method === "GET") {
        const dataPath = path.join(__dirname, "uploads", "data.xlsx");
        if (!fs.existsSync(dataPath)) {
            res.writeHead(404);
            res.end("Ingen Excel fil fundet");
            return;
        }

        try {
            const workbook = xlsx.readFile(dataPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = xlsx.utils.sheet_to_json(sheet);

            const transformed = rows.map(row => ({
                ...row,

                // Lokation → [lat, lon]
                Lokation: typeof row.Lokation === "string"
                    ? row.Lokation.split(",").map(v => parseFloat(v.trim()))
                    : row.Lokation,

                // Valgmuligheder → array
                Valgmuligheder: typeof row.Valgmuligheder === "string"
                    ? row.Valgmuligheder.split(";").map(v => v.trim())
                    : [],
            }));

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(transformed));

        } catch (err) {
            console.error(err);
            res.writeHead(500);
            res.end("Kunne ikke læse Excel");
        }
        return;
    }


    // --- DOWNLOAD TEMPLATE ---
    /*if (pathname === "/template" && req.method === "GET") {
        const headers = [{ A: "ID", B: "Titel", C: "Beskrivelse", D: "Type", E: "Aktiveringsbetingelse", F: 'Lokation', G: 'Radius', H: "Valgmuligheder" }];
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(headers, { skipHeader: true });
        xlsx.utils.book_append_sheet(wb, ws, "Template");
        const tempPath = path.join(__dirname, "uploads", "template.xlsx");
        xlsx.writeFile(wb, tempPath);
        res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=skabelon.xlsx" });
        fs.createReadStream(tempPath).pipe(res);
        return;
    }*/

    if (pathname === "/template" && req.method === "GET") {

        // Kolonneoverskrifter
        const headers = ["ID", "Titel", "Beskrivelse", "Type", "Aktiveringsbetingelse", "Lokation", "Radius", "Valgmuligheder"];

        // Eksempelrække
        const exampleTask = [1, "Eksempel på en titel", "Eksempel på en beskrivelse", "Land", "Lokation", "12.1234, 56.6789", 100, "Valgmulighed1; Valgmulighed2; Valgmulighed3"];

        const wb = xlsx.utils.book_new();

        // Brug array-of-arrays: første række = headers, anden række = eksempel
        const ws = xlsx.utils.aoa_to_sheet([headers, exampleTask]);
        xlsx.utils.book_append_sheet(wb, ws, "Template");

        const tempPath = path.join(__dirname, "uploads", "template.xlsx");
        xlsx.writeFile(wb, tempPath);

        res.writeHead(200, {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": "attachment; filename=skabelon.xlsx"
        });
        fs.createReadStream(tempPath).pipe(res);
        return;
    }


    /*if (pathname === "/template" && req.method === "GET") {
        // Kolonneoverskrifter
        const headers = ["ID", "Titel", "Beskrivelse", "Type", "Aktiveringsbetingelse", "Lokation", "Radius", "Valgmuligheder"];

        // Eksempelrække
        const exampleTask = [
            1,
            "Fjeldtur",
            "En tur op på fjeldet med alle deltagere",
            "Land",
            "Alle deltagere",
            "55.6761, 12.5683",
            100,
            "Option1; Option2; Option3"
        ];

        const wb = xlsx.utils.book_new();

        // Opret sheet med eksempelrække
        const ws = xlsx.utils.aoa_to_sheet([headers, exampleTask]); // bruger array-of-arrays
        xlsx.utils.book_append_sheet(wb, ws, "Template");

        const tempPath = path.join(__dirname, "uploads", "template.xlsx");
        xlsx.writeFile(wb, tempPath);

        res.writeHead(200, {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": "attachment; filename=skabelon.xlsx"
        });
        fs.createReadStream(tempPath).pipe(res);
        return;
    }*/



    // --- SERVE FRONTEND FILES ---
    if (req.method === "GET") {
        const filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end("Fil ikke fundet");
                return;
            }

            const ext = path.extname(filePath).toLowerCase();

            const mimeTypes = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".gif": "image/gif",
                ".ico": "image/x-icon",
            };

            const contentType = mimeTypes[ext] || "application/octet-stream";

            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        });
        return;
    }

});

server.listen(3000, () => console.log("Server kører på http://localhost:3000"));