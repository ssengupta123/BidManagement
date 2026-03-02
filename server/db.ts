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

    return {
      client: "mssql",
      connection: {
        server,
        database,
        user,
        password,
        options: {
          encrypt: true,
          trustServerCertificate: false,
        },
      },
      pool: { min: 2, max: 10 },
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
