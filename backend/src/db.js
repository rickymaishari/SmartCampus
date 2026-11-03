const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { Pool, types } = require('pg');
// Keep SQL dates as YYYY-MM-DD; timestamps are returned as ISO strings in JSON.
types.setTypeParser(1082, value => value);
const pool = new Pool();
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
module.exports = { pool, transaction };
