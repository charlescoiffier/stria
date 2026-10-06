// Serveur statique minimal pour développer : npm start → http://localhost:5173
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = +process.env.PORT || 5173;
createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(readFileSync(new URL('../index.html', import.meta.url)));   // relu à chaque requête : F5 suffit
}).listen(port, () => console.log(`Stria : http://localhost:${port}`));
