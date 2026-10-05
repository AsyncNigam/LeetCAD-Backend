const { DataSource } = require('typeorm');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: 'postgresql://leetcad:leetcad_dev@localhost:5434/leetcad_db',
  });
  await ds.initialize();

  // Create User
  const userId = uuidv4();
  await ds.query(
    'INSERT INTO users (id, email, "googleId", name) VALUES ($1, $2, $3, $4)',
    [userId, 'test@example.com', 'google_123', 'Test User']
  );

  // Create API Key
  const rawKey = 'lc_live_test123';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  await ds.query(
    'INSERT INTO api_keys (id, "userId", name, "keyHash") VALUES ($1, $2, $3, $4)',
    [uuidv4(), userId, 'CLI Key', keyHash]
  );

  console.log('Test User and API Key (lc_live_test123) successfully seeded.');
  await ds.destroy();
}

main().catch(console.error);
