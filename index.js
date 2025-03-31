const http = require("http");
const { Command } = require("commander");
const fs = require("fs");
const path = require("path");
const superagent = require("superagent");

const program = new Command();

program
    .requiredOption("-h, --host <host>", "Server host")
    .requiredOption("-p, --port <port>", "Server port")
    .requiredOption("-c, --cache <cacheDir>", "Cache directory");

program.parse(process.argv);

const options = program.opts();
const { host, port, cache } = options;

// Перевірка чи існує директорія кешу, якщо ні - створити
if (!fs.existsSync(cache)) {
    fs.mkdirSync(cache, { recursive: true });
}

const { promises: fsPromises } = require("fs");

const server = http.createServer(async (req, res) => {
    const urlParts = req.url.split("/");

    // Перевірка на правильний формат запиту
    if (urlParts.length < 2 || isNaN(urlParts[1])) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid request");
        return;
    }

    const statusCode = urlParts[1];
    const filePath = path.join(cache, `${statusCode}.jpg`);

    // Обробка запитів GET, PUT, DELETE
    try {
        if (req.method === "GET") {
            try {
                const fileData = await fsPromises.readFile(filePath);
                res.writeHead(200, { "Content-Type": "image/jpeg" });
                res.end(fileData);
            } catch (err) {
                // Якщо файл не знайдено в кеші, завантажуємо з http.cat
                await fetchAndCacheImage(statusCode, filePath, res);
            }
        } else if (req.method === "PUT") {
            const fileStream = fs.createWriteStream(filePath);
            req.pipe(fileStream);
            req.on("finish", () => {
                res.writeHead(201, { "Content-Type": "text/plain" });
                res.end("File saved");
            });
        } else if (req.method === "DELETE") {
            try {
                await fsPromises.unlink(filePath);
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("File deleted");
            } catch (err) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("File not found");
            }
        } else {
            res.writeHead(405, { "Content-Type": "text/plain" });
            res.end("Method not allowed");
        }
    } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Server error");
    }
});

// Функція для завантаження та кешування картинки з http.cat
async function fetchAndCacheImage(statusCode, filePath, res) {
    try {
        const response = await superagent.get(`https://http.cat/${statusCode}`);
        await fsPromises.writeFile(filePath, response.body);
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(response.body);
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Image not found on http.cat");
    }
}

server.listen(port, host, () => {
    console.log(`Сервер запущено на http://${host}:${port}`);
});