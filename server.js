'use strict';

const http = require("http");
const fs = require("fs");
const path = require("path");
const formidable = require("formidable");
const xlsx = require("xlsx");

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

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
        handleUpload(req, res, "upload");
        return;
    }

    // --- MERGE NEW FILE WITH EXISTING ---
    if (pathname === "/merge-files" && req.method === "POST") {
        handleUpload(req, res, "merge");
        return;
    }

    // --- REPLACE EXISTING FILE ---
    if (pathname === "/replace-file" && req.method === "POST") {
        handleUpload(req, res, "replace");
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
    if (pathname === "/template" && req.method === "GET") {
        const headers = [{ A: "ID", B: "Titel", C: "Beskrivelse", D: "Type", E: "Lokation", F: 'Radius', G: "Valgmuligheder", H: 'Aktiveringsbetingelser' }];
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(headers, { skipHeader: true });
        xlsx.utils.book_append_sheet(wb, ws, "Template");
        const tempPath = path.join(__dirname, "uploads", "template.xlsx");
        xlsx.writeFile(wb, tempPath);
        res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=skabelon.xlsx" });
        fs.createReadStream(tempPath).pipe(res);
        return;
    }

    // --- SERVE FRONTEND FILES ---
    if (req.method === "GET") {
        const filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); res.end("Fil ikke fundet"); return; }
            const ext = path.extname(filePath).toLowerCase();
            const contentType = ext === ".css" ? "text/css" : ext === ".js" ? "application/javascript" : ext === ".html" ? "text/html" : "application/octet-stream";
            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        });
        return;
    }

    // --- FALLBACK ---
    res.writeHead(404);
    res.end("Not found");
});

server.listen(3000, () => console.log("Server kører på http://localhost:3000"));

// --- HANDLE UPLOAD ---
function handleUpload(req, res, mode) {
    const form = new formidable.IncomingForm({ multiples: false });
    form.parse(req, (err, fields, files) => {
        if (err) { res.writeHead(500); res.end("Fejl ved upload"); return; }

        let uploadedFile = files.file;
        if (Array.isArray(uploadedFile)) uploadedFile = uploadedFile[0];
        if (!uploadedFile) { res.writeHead(400); res.end("Ingen fil modtaget"); return; }

        const tempPath = path.join(__dirname, "uploads", "temp.xlsx");
        fs.renameSync(uploadedFile.filepath, tempPath);

        const dataPath = path.join(__dirname, "uploads", "data.xlsx");

        try {
            if (mode === "upload") {
                fs.renameSync(tempPath, dataPath);
                res.end("Første fil uploadet og gemt som data.xlsx");
            } else if (mode === "replace") {
                fs.renameSync(tempPath, dataPath);
                res.end("Eksisterende fil erstattet med ny fil");
            } else if (mode === "merge") {
                if (!fs.existsSync(dataPath)) {
                    fs.renameSync(tempPath, dataPath);
                    res.end("Ingen eksisterende fil → gemt som data.xlsx");
                } else {
                    const oldData = xlsx.utils.sheet_to_json(xlsx.readFile(dataPath).Sheets[xlsx.readFile(dataPath).SheetNames[0]]);
                    let newData = xlsx.utils.sheet_to_json(xlsx.readFile(tempPath).Sheets[xlsx.readFile(tempPath).SheetNames[0]]);

                    // Fjern duplikater
                    const oldJSONStrings = oldData.map(r => JSON.stringify(r));
                    newData = newData.filter(r => !oldJSONStrings.includes(JSON.stringify(r)));

                    const mergedData = [...oldData, ...newData];
                    const wb = xlsx.utils.book_new();
                    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(mergedData), "Sheet1");
                    xlsx.writeFile(wb, dataPath);
                    fs.unlinkSync(tempPath);
                    res.end("Filer merged og gemt i data.xlsx");
                }
            }
        } catch (err) {
            console.error(err);
            res.writeHead(500);
            res.end("Kunne ikke gemme fil");
        }
    });
}
