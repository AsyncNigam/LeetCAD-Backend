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

    // 1. Create the problems table if it doesn't exist (just in case migrations haven't run)
    // But typically TypeORM sync handles this. We'll just run the insert.
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
      ON CONFLICT (title) DO NOTHING
      RETURNING id;
    `;

    const values = [
      'Calibration Cube (20mm)',
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
      console.log("⚠️ Problem already exists or no rows inserted.");
    }
    
  } catch (err) {
    console.error("❌ Seed failed:", err);
  } finally {
    await client.end();
    console.log("🔌 Database connection closed.");
  }
}

runSeed();
