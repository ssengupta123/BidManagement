import { db, isAzureSQL } from "./db";

export async function runMigrations() {
  console.log(`Running migrations for ${isAzureSQL ? "Azure SQL (MSSQL)" : "PostgreSQL"}...`);

  if (!(await db.schema.hasTable("users"))) {
    await db.schema.createTable("users", (t) => {
      t.increments("id").primary();
      t.string("username", 255).notNullable().unique();
      t.string("full_name", 500).notNullable();
      t.string("role", 100).notNullable().defaultTo("writer");
      t.string("email", 500).nullable();
    });
    console.log("Created table: users");
  }

  if (!(await db.schema.hasTable("opportunities"))) {
    await db.schema.createTable("opportunities", (t) => {
      t.increments("id").primary();
      t.text("name").notNullable();
      t.string("phase", 255).defaultTo("1.A - Activity");
      t.dateTime("due_date").nullable();
      t.float("value").nullable();
      t.float("margin").nullable();
      t.string("work_type", 255).nullable();
      t.dateTime("start_date").nullable();
      t.dateTime("expiry_date").nullable();
      t.string("vat", 100).nullable();
      t.string("status", 100).defaultTo("New");
      t.text("comment").nullable();
      t.string("cas_lead", 255).nullable();
      t.string("csd_lead", 255).nullable();
      t.string("category", 500).nullable();
      t.string("partner", 500).nullable();
      t.string("client_contact", 500).nullable();
      t.string("client_code", 100).nullable();
      t.string("channel", 255).nullable();
      t.string("priority", 100).nullable();
      t.string("assigned_to", 255).nullable();
      t.text("care_decision").nullable();
      t.dateTime("date_in").nullable();
      t.string("source", 255).nullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
      t.dateTime("updated_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: opportunities");
  }

  if (!(await db.schema.hasTable("bids"))) {
    await db.schema.createTable("bids", (t) => {
      t.increments("id").primary();
      t.integer("opportunity_id").nullable().references("id").inTable("opportunities");
      t.text("title").notNullable();
      t.string("stage", 100).notNullable().defaultTo("cas_qualification");
      t.string("cas_qualified", 100).defaultTo("pending");
      t.string("csd_qualified", 100).defaultTo("pending");
      t.integer("bid_manager_id").nullable().references("id").inTable("users");
      t.integer("assigned_writer_id").nullable().references("id").inTable("users");
      t.float("care_score").nullable();
      t.float("competitive_position").nullable();
      t.float("attractiveness").nullable();
      t.float("relationship_strength").nullable();
      t.float("ease_of_response").nullable();
      t.text("care_analysis").nullable();
      t.text("technical_response").nullable();
      t.text("delivery_plan").nullable();
      t.text("resource_plan").nullable();
      t.string("executive_approval", 100).defaultTo("pending");
      t.text("executive_comments").nullable();
      t.text("final_response").nullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
      t.dateTime("updated_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: bids");
  }

  if (!(await db.schema.hasTable("workflow_logs"))) {
    await db.schema.createTable("workflow_logs", (t) => {
      t.increments("id").primary();
      t.integer("bid_id").nullable().references("id").inTable("bids");
      t.text("action").notNullable();
      t.string("from_stage", 100).nullable();
      t.string("to_stage", 100).nullable();
      t.string("performed_by", 255).nullable();
      t.text("notes").nullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: workflow_logs");
  }

  if (!(await db.schema.hasTable("job_plans"))) {
    await db.schema.createTable("job_plans", (t) => {
      t.increments("id").primary();
      t.integer("bid_id").nullable().references("id").inTable("bids");
      t.text("title").notNullable();
      t.dateTime("contract_start_date").nullable();
      t.dateTime("forecast_date").nullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: job_plans");
  }

  if (!(await db.schema.hasTable("job_plan_lines"))) {
    await db.schema.createTable("job_plan_lines", (t) => {
      t.increments("id").primary();
      t.integer("job_plan_id").notNullable().references("id").inTable("job_plans");
      t.text("milestone").notNullable();
      t.text("deliverable").nullable();
      t.string("resource", 500).nullable();
      t.string("charge_out_level", 255).nullable();
      t.string("job_role", 255).nullable();
      t.float("panel_hourly_rate").nullable();
      t.float("discount_percent").defaultTo(0);
      t.float("hourly_gross_cost").nullable();
      t.float("budget_hours").defaultTo(0);
      t.float("forecast_hours").defaultTo(0);
      t.float("actual_hours").defaultTo(0);
      t.text("weekly_allocations").defaultTo("{}");
      t.integer("sort_order").defaultTo(0);
    });
    console.log("Created table: job_plan_lines");
  }

  if (!(await db.schema.hasTable("conversations"))) {
    await db.schema.createTable("conversations", (t) => {
      t.increments("id").primary();
      t.text("title").notNullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: conversations");
  }

  if (!(await db.schema.hasTable("messages"))) {
    await db.schema.createTable("messages", (t) => {
      t.increments("id").primary();
      t.integer("conversation_id").notNullable().references("id").inTable("conversations");
      t.text("role").notNullable();
      t.text("content").notNullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: messages");
  }

  if (!(await db.schema.hasTable("data_sources"))) {
    await db.schema.createTable("data_sources", (t) => {
      t.increments("id").primary();
      t.string("name", 500).notNullable();
      t.string("type", 100).notNullable().defaultTo("sharepoint");
      t.string("sync_target", 100).notNullable();
      t.string("status", 100).notNullable().defaultTo("configured");
      t.text("connection_info").nullable();
      t.integer("records_processed").defaultTo(0);
      t.dateTime("last_sync_at").nullable();
      t.dateTime("created_at").notNullable().defaultTo(db.fn.now());
    });
    console.log("Created table: data_sources");
  }

  if (await db.schema.hasTable("opportunities")) {
    const hasSpCol = await db.schema.hasColumn("opportunities", "sharepoint_id");
    if (!hasSpCol) {
      await db.schema.alterTable("opportunities", (t) => {
        t.string("sharepoint_id", 255).nullable();
      });
      console.log("Added sharepoint_id column to opportunities");
    }
  }

  console.log("Migrations complete");
}
