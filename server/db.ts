import Knex from "knex";

const dbType = process.env.DB_TYPE || "pg";

function createKnexConfig(): Knex.Knex.Config {
  if (dbType === "mssql") {
    const server = process.env.MSSQL_SERVER;
    const database = process.env.MSSQL_DATABASE;
    const user = process.env.MSSQL_USER;
    const password = process.env.MSSQL_PASSWORD;

    if (!server || !database || !user || !password) {
      throw new Error(
        "MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, and MSSQL_PASSWORD must be set for Azure SQL"
      );
    }

    const host = server.replace(/:.*$/, "");
    console.log(`[DB] Connecting to Azure SQL: ${host} / ${database} as ${user}`);

    return {
      client: "mssql",
      connection: {
        host,
        database,
        user,
        password,
        port: Number.parseInt(process.env.MSSQL_PORT || "1433"),
        options: {
          encrypt: true,
          trustServerCertificate: false,
          connectTimeout: 60000,
          requestTimeout: 30000,
          enableArithAbort: true,
        },
      } as any,
      pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
      acquireConnectionTimeout: 60000,
    };
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }

  return {
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
  };
}

export const db = Knex.default(createKnexConfig());
export const isAzureSQL = dbType === "mssql";
