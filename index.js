const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { program } = require('commander');

// Налаштування командного рядка для отримання параметрів
program
    .requiredOption('-h, --host <type>', 'Адреса сервера')
    .requiredOption('-p, --port <number>', 'Порт сервера')
    .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();
const HOST = options.host;
const PORT = parseInt(options.port, 10);
const CACHE_DIR = path.resolve(options.cache);

// Перевірка наявності директорії кешу
fs.mkdir(CACHE_DIR, { recursive: true })
    .then(() => {
        console.log(`Директорія кешу '${CACHE_DIR}' готова.`);
    })
    .catch((err) => {
        console.error(`Помилка при створенні директорії кешу: ${err.message}`);
        process.exit(1);
    });

// Створення HTTP-сервера
const server = http.createServer(async (req, res) => {
    const method = req.method;
    const urlParts = req.url.split('/');
    const statusCode = urlParts[1];

    if (!statusCode) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Не вказано код статусу в URL.');
        return;
    }

    const imagePath = path.join(CACHE_DIR, `${statusCode}.jpg`);

    if (method === 'GET') {
        try {
            // Перевіряємо наявність зображення в кеші
            const image = await fs.readFile(imagePath);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(image);
        } catch (error) {
            // Якщо зображення відсутнє в кеші, отримуємо його з http.cat
            try {
                const response = await superagent.get(`https://http.cat/${statusCode}`);
                const imageBuffer = response.body;

                // Зберігаємо зображення в кеші
                await fs.writeFile(imagePath, imageBuffer);

                res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                res.end(imageBuffer);
            } catch (fetchError) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Зображення не знайдено на сервері http.cat.');
            }
        }
    } else {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Метод не дозволений.');
    }
});


// Запуск сервера
server.listen(PORT, HOST, () => {
    console.log(`Сервер запущено на http://${HOST}:${PORT}/`);
});
