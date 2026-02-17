import pg from "pg";

async function dropSchema() {
  const schema = process.env.RAILWAY_DEPLOYMENT_ID;
  const databaseUrl = process.env.DATABASE_URL;

  if (!schema) {
    console.log("No RAILWAY_DEPLOYMENT_ID set, skipping schema drop");
    return;
  }

  if (!databaseUrl) {
    console.log("No DATABASE_URL set, skipping schema drop");
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log(`Dropping schema "${schema}" if it exists...`);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log(`Schema "${schema}" dropped successfully`);
  } catch (error) {
    console.error("Error dropping schema:", error);
  } finally {
    await client.end();
  }
}

dropSchema().catch((error) => {
  console.error("Error in drop-schema script:", error);
  process.exit(1);
});
