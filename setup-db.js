require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_SSL === 'true'
      ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
      : undefined
  });

  const db = process.env.DB_NAME;
  await conn.query('DROP DATABASE IF EXISTS `' + db + '`');
  await conn.query('CREATE DATABASE `' + db + '`');
  await conn.query('USE `' + db + '`');

  let sql = fs.readFileSync(path.join(__dirname, 'gleangrid.sql'), 'utf8');
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  sql = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  let statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^(CREATE DATABASE|USE|SET|START TRANSACTION|COMMIT)\b/i.test(s));

  // Pehle dekho kin tables ki id par AUTO_INCREMENT lagta hai
  const autoTables = {};
  for (const s of statements) {
    const m = s.match(/^ALTER TABLE `(\w+)`\s+MODIFY `id`[^;]*?AUTO_INCREMENT(?:\s*,\s*AUTO_INCREMENT\s*=\s*(\d+))?/i);
    if (m) autoTables[m[1]] = m[2] || null;
  }

  const prepared = [];
  for (let s of statements) {
    // MODIFY id wali ALTER statements skip (TiDB support nahi karta)
    if (/^ALTER TABLE `\w+`\s+MODIFY `id`/i.test(s)) continue;

    // CREATE TABLE mein id ko seedha AUTO_INCREMENT PRIMARY KEY banao
    const c = s.match(/^CREATE TABLE `(\w+)`/i);
    if (c && c[1] in autoTables) {
      s = s.replace(/`id` int\(11\) NOT NULL(?!\s+AUTO)/i, '`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY');
    }

    // ALTER mein duplicate PRIMARY KEY hatao
    if (/^ALTER TABLE `(\w+)`/i.test(s)) {
      const t = s.match(/^ALTER TABLE `(\w+)`/i)[1];
      if (t in autoTables) {
        s = s.replace(/ADD PRIMARY KEY \(`id`\)\s*,?/i, '').replace(/,\s*$/, '').trim();
        if (/^ALTER TABLE `\w+`\s*$/i.test(s)) continue;
        s = s.replace(/^(ALTER TABLE `\w+`)\s*,/i, '$1');
      }
    }
    prepared.push(s);
  }

  // Foreign keys sab se aakhir mein chalao
  const normal = prepared.filter((s) => !/FOREIGN KEY/i.test(s));
  const fks = prepared.filter((s) => /FOREIGN KEY/i.test(s));

  let ok = 0;
  let failed = 0;
  for (const stmt of [...normal, ...fks]) {
    try {
      await conn.query(stmt);
      ok++;
    } catch (err) {
      failed++;
      console.log('FAIL:', err.message);
      console.log('   Statement:', stmt.slice(0, 100).replace(/\s+/g, ' '));
    }
  }

  // AUTO_INCREMENT ki agli value set karo
  for (const [t, n] of Object.entries(autoTables)) {
    try {
      const [[r]] = await conn.query('SELECT COALESCE(MAX(id),0)+1 AS nxt FROM `' + t + '`');
      await conn.query('ALTER TABLE `' + t + '` AUTO_INCREMENT = ' + Math.max(Number(n || 1), r.nxt));
    } catch (err) {
      console.log('AUTO_INCREMENT warning (' + t + '):', err.message);
    }
  }

  console.log('Chal gayi: ' + ok + ', fail: ' + failed);
  const [tables] = await conn.query('SHOW TABLES');
  console.log('Tables:', tables.map((t) => Object.values(t)[0]).join(', '));
  await conn.end();
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});