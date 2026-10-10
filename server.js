import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'uploads');
const dataFile = path.join(__dirname, 'data', 'people.json');

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.dirname(dataFile), { recursive: true });
const upload = multer({ dest: uploadDir });

let people = [];
let dbConnection = null;
let usingDatabase = false;

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'missing_people_db'
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/records', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'records.html'));
});

app.get('/api/people', async (req, res) => {
  people = await loadPeople();
  res.json(people);
});

app.post('/api/people', async (req, res) => {
  const { name, age, lastSeen, region, description } = req.body;

  if (!name || !age || !lastSeen || !region || !description) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const person = {
    id: Date.now(),
    name,
    age: Number(age),
    lastSeen,
    region,
    description
  };

  await savePerson(person);
  people = await loadPeople();

  res.json({ message: 'Record saved successfully.', person });
});

app.post('/identify', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload an image file.' });
  }

  const buffer = fs.readFileSync(req.file.path);
  const uploadedSignature = buildSignature(`${req.file.originalname}${req.file.mimetype}${buffer.toString('hex')}`);
  people = await loadPeople();
  const scoredMatches = people
    .map((person) => ({
      ...person,
      score: compareSignatures(uploadedSignature, buildSignature(`${person.name}${person.region}${person.lastSeen}${person.description}`))
    }))
    .sort((a, b) => b.score - a.score);

  const topMatch = scoredMatches[0];

  fs.unlinkSync(req.file.path);

  res.json({
    message: 'Prototype matching complete.',
    mode: usingDatabase ? 'mysql' : 'json',
    match: {
      id: topMatch.id,
      name: topMatch.name,
      age: topMatch.age,
      lastSeen: topMatch.lastSeen,
      description: topMatch.description,
      region: topMatch.region,
      score: topMatch.score
    },
    allMatches: scoredMatches.slice(0, 3)
  });
});

async function startServer() {
  await initDatabase();
  listenOnPort(port);
}

function listenOnPort(currentPort) {
  const server = app.listen(currentPort, () => {
    console.log(`Prototype running at http://localhost:${server.address().port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = currentPort + 1;
      console.warn(`Port ${currentPort} is busy. Trying ${fallbackPort} instead.`);
      server.close();
      listenOnPort(fallbackPort);
      return;
    }

    throw error;
  });
}

startServer();

async function initDatabase() {
  try {
    dbConnection = await mysql.createConnection(dbConfig);
    await dbConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await dbConnection.query(`USE ${dbConfig.database}`);
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS missing_people (
        id BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        lastSeen VARCHAR(255) NOT NULL,
        region VARCHAR(255) NOT NULL,
        description TEXT NOT NULL
      )
    `);
    usingDatabase = true;
    people = await loadPeople();
  } catch (error) {
    usingDatabase = false;
    console.warn('MySQL not available, falling back to JSON storage.', error.message);
    people = loadPeopleFromFile();
  }
}

async function loadPeople() {
  if (usingDatabase && dbConnection) {
    const [rows] = await dbConnection.query('SELECT * FROM missing_people ORDER BY id DESC');
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      lastSeen: row.lastSeen,
      region: row.region,
      description: row.description
    }));
  }

  return loadPeopleFromFile();
}

async function savePerson(person) {
  if (usingDatabase && dbConnection) {
    await dbConnection.execute(
      'INSERT INTO missing_people (id, name, age, lastSeen, region, description) VALUES (?, ?, ?, ?, ?, ?)',
      [person.id, person.name, person.age, person.lastSeen, person.region, person.description]
    );
    return;
  }

  const existing = loadPeopleFromFile();
  existing.push(person);
  fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));
}

function loadPeopleFromFile() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function buildSignature(source) {
  const text = String(source);
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const bytes = Buffer.from(hash, 'hex');

  return {
    hash,
    size: bytes.length,
    avgByte: bytes.reduce((sum, value) => sum + value, 0) / bytes.length,
    firstByte: bytes[0] || 0,
    lastByte: bytes[bytes.length - 1] || 0
  };
}

function compareSignatures(uploaded, candidate) {
  const sizeDiff = Math.abs(uploaded.size - candidate.size) / Math.max(uploaded.size, candidate.size);
  const avgDiff = Math.abs(uploaded.avgByte - candidate.avgByte) / 255;
  const firstDiff = Math.abs(uploaded.firstByte - candidate.firstByte) / 255;
  const lastDiff = Math.abs(uploaded.lastByte - candidate.lastByte) / 255;

  const similarity = 1 - (sizeDiff * 0.25 + avgDiff * 0.25 + firstDiff * 0.25 + lastDiff * 0.25);
  const rounded = Math.max(0, Math.min(100, Math.round(similarity * 100)));

  return rounded;
}
