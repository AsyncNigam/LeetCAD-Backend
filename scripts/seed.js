const { Client } = require('pg');
require('dotenv').config();

async function runSeed() {
  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set in the environment.");
    process.exit(1);
  }

  console.log("Connecting to the database at:", process.env.DATABASE_URL.split('@')[1] || "hidden for security");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Neon DB
    }
  });

  try {
    await client.connect();
    console.log("✅ Successfully connected to Neon DB");

    const title = 'Calibration Cube (20mm)';

    // 1. Check if problem already exists
    const checkRes = await client.query('SELECT id FROM problems WHERE title = $1', [title]);
    if (checkRes.rowCount > 0) {
      console.log(`⚠️ Problem already exists (ID: ${checkRes.rows[0].id}). Skipping...`);
    } else {
      // 2. Insert problem
      const query = `
        INSERT INTO problems (
          id, 
          title, 
          description, 
          difficulty, 
          "goldenFileKey", 
          "targetVolume", 
          tolerance,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid(), 
          $1, 
          $2, 
          $3, 
          $4, 
          $5, 
          $6,
          NOW(),
          NOW()
        )
        RETURNING id;
      `;

      const values = [
        title,
        'A standard 20mm x 20mm x 20mm calibration cube to test foundational XYZ dimensions.',
        'EASY', // Mapped from BEGINNER to match ProblemDifficulty enum
        'problems/cube.step', // target geometry reference path
        8000.0, // 20x20x20
        0.1     // 0.1mm tolerance
      ];

      console.log("Inserting sample problem...");
      const res = await client.query(query, values);
      
      if (res.rowCount > 0) {
        console.log(`✅ Successfully seeded problem! ID: ${res.rows[0].id}`);
      } else {
        console.log("⚠️ No rows inserted.");
      }
    }
    
  } catch (err) {
    console.error("❌ Seed failed:", err);
  } finally {
    await client.end();
    console.log("🔌 Database connection closed.");
  }
}

runSeed();
