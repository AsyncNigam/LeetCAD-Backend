const pg = require('pg');

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://leetcad:leetcad_dev@localhost:5434/leetcad_db';

const client = new Client({
  connectionString,
});

const problems = [
  {
    title: 'Calibration Cube (20mm)',
    difficulty: 'EASY',
    description: 'Design a perfect 20x20x20mm cube. Ensure the origin is at the exact center of mass.',
    targetVolume: 8000.0,
    tolerance: 0.1,
    goldenFileKey: 'problems/calibration-cube-20mm.step'
  },
  {
    title: 'M6 Engine Mount Bracket',
    difficulty: 'MEDIUM',
    description: 'Design an L-bracket for an M6 engine mount. The base must be 5mm thick with two 6.5mm diameter mounting holes spaced 40mm apart. Must withstand 500N of lateral force.',
    targetVolume: 14500.5,
    tolerance: 15.0,
    goldenFileKey: 'problems/m6-engine-mount.step'
  },
  {
    title: 'Involute Spur Gear - 20T',
    difficulty: 'HARD',
    description: 'Design an involute spur gear with 20 teeth, a module of 2.0, and a pressure angle of 20 degrees. Center bore diameter is 10mm.',
    targetVolume: 31415.9,
    tolerance: 25.0,
    goldenFileKey: 'problems/spur-gear-20t.step'
  }
];

async function seed() {
  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Clearing existing problems...');
    // Cascade to also delete submissions that might reference these problems
    await client.query('TRUNCATE TABLE problems CASCADE');

    console.log('Inserting problems...');
    for (const problem of problems) {
      await client.query(
        `INSERT INTO problems (title, difficulty, description, "targetVolume", tolerance, "goldenFileKey") 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          problem.title,
          problem.difficulty,
          problem.description,
          problem.targetVolume,
          problem.tolerance,
          problem.goldenFileKey
        ]
      );
      console.log(`Inserted: ${problem.title}`);
    }

    console.log('✅ Seeding completed successfully!');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
  } finally {
    await client.end();
  }
}

seed();
