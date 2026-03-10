import { db } from "./db";
import type {
  User, InsertUser,
  Opportunity, InsertOpportunity,
  Bid, InsertBid,
  WorkflowLog, InsertWorkflowLog,
  JobPlan, InsertJobPlan,
  JobPlanLine, InsertJobPlanLine,
  DataSource, InsertDataSource,
} from "@shared/schema";

function toSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

function toCamel<T>(row: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

function toCamelArray<T>(rows: Record<string, any>[]): T[] {
  return rows.map((r) => toCamel<T>(r));
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  getOpportunity(id: number): Promise<Opportunity | undefined>;
  getAllOpportunities(): Promise<Opportunity[]>;
  createOpportunity(opp: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: number, data: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: number): Promise<void>;

  getBid(id: number): Promise<Bid | undefined>;
  getAllBids(): Promise<Bid[]>;
  createBid(bid: InsertBid): Promise<Bid>;
  updateBid(id: number, data: Partial<InsertBid>): Promise<Bid | undefined>;
  deleteBid(id: number): Promise<void>;

  getWorkflowLogs(bidId: number): Promise<WorkflowLog[]>;
  createWorkflowLog(log: InsertWorkflowLog): Promise<WorkflowLog>;

  getJobPlan(id: number): Promise<JobPlan | undefined>;
  getJobPlansByBid(bidId: number): Promise<JobPlan[]>;
  getAllJobPlans(): Promise<JobPlan[]>;
  createJobPlan(plan: InsertJobPlan): Promise<JobPlan>;
  updateJobPlan(id: number, data: Partial<InsertJobPlan>): Promise<JobPlan | undefined>;
  deleteJobPlan(id: number): Promise<void>;

  getAllJobPlanLines(): Promise<JobPlanLine[]>;
  getJobPlanLines(jobPlanId: number): Promise<JobPlanLine[]>;
  createJobPlanLine(line: InsertJobPlanLine): Promise<JobPlanLine>;
  updateJobPlanLine(id: number, data: Partial<InsertJobPlanLine>): Promise<JobPlanLine | undefined>;
  deleteJobPlanLine(id: number): Promise<void>;

  getAllDataSources(): Promise<DataSource[]>;
  getDataSource(id: number): Promise<DataSource | undefined>;
  createDataSource(ds: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: number, data: Partial<InsertDataSource>): Promise<DataSource | undefined>;
  deleteDataSource(id: number): Promise<void>;

  getDashboardStats(): Promise<{
    totalOpportunities: number;
    activeBids: number;
    pendingReview: number;
    approved: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const row = await db("users").where("id", id).first();
    return row ? toCamel<User>(row) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = await db("users").where("username", username).first();
    return row ? toCamel<User>(row) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [row] = await db("users").insert(toSnake(user)).returning("*");
    return toCamel<User>(row);
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await db("users").select("*");
    return toCamelArray<User>(rows);
  }

  async getOpportunity(id: number): Promise<Opportunity | undefined> {
    const row = await db("opportunities").where("id", id).first();
    return row ? toCamel<Opportunity>(row) : undefined;
  }

  async getAllOpportunities(): Promise<Opportunity[]> {
    const rows = await db("opportunities").select("*").orderBy("created_at", "desc");
    return toCamelArray<Opportunity>(rows);
  }

  async createOpportunity(opp: InsertOpportunity): Promise<Opportunity> {
    const [row] = await db("opportunities").insert(toSnake(opp)).returning("*");
    return toCamel<Opportunity>(row);
  }

  async updateOpportunity(id: number, data: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const snakeData = toSnake(data);
    snakeData.updated_at = new Date();
    const [row] = await db("opportunities").where("id", id).update(snakeData).returning("*");
    return row ? toCamel<Opportunity>(row) : undefined;
  }

  async deleteOpportunity(id: number): Promise<void> {
    await db("opportunities").where("id", id).del();
  }

  async getBid(id: number): Promise<Bid | undefined> {
    const row = await db("bids").where("id", id).first();
    return row ? toCamel<Bid>(row) : undefined;
  }

  async getAllBids(): Promise<Bid[]> {
    const rows = await db("bids").select("*").orderBy("created_at", "desc");
    return toCamelArray<Bid>(rows);
  }

  async createBid(bid: InsertBid): Promise<Bid> {
    const [row] = await db("bids").insert(toSnake(bid)).returning("*");
    return toCamel<Bid>(row);
  }

  async updateBid(id: number, data: Partial<InsertBid>): Promise<Bid | undefined> {
    const snakeData = toSnake(data);
    snakeData.updated_at = new Date();
    const [row] = await db("bids").where("id", id).update(snakeData).returning("*");
    return row ? toCamel<Bid>(row) : undefined;
  }

  async deleteBid(id: number): Promise<void> {
    await db("workflow_logs").where("bid_id", id).del();
    await db("bids").where("id", id).del();
  }

  async getWorkflowLogs(bidId: number): Promise<WorkflowLog[]> {
    const rows = await db("workflow_logs").where("bid_id", bidId).orderBy("created_at", "desc");
    return toCamelArray<WorkflowLog>(rows);
  }

  async createWorkflowLog(log: InsertWorkflowLog): Promise<WorkflowLog> {
    const [row] = await db("workflow_logs").insert(toSnake(log)).returning("*");
    return toCamel<WorkflowLog>(row);
  }

  async getJobPlan(id: number): Promise<JobPlan | undefined> {
    const row = await db("job_plans").where("id", id).first();
    return row ? toCamel<JobPlan>(row) : undefined;
  }

  async getJobPlansByBid(bidId: number): Promise<JobPlan[]> {
    const rows = await db("job_plans").where("bid_id", bidId).orderBy("created_at", "desc");
    return toCamelArray<JobPlan>(rows);
  }

  async getAllJobPlans(): Promise<JobPlan[]> {
    const rows = await db("job_plans").select("*").orderBy("created_at", "desc");
    return toCamelArray<JobPlan>(rows);
  }

  async createJobPlan(plan: InsertJobPlan): Promise<JobPlan> {
    const [row] = await db("job_plans").insert(toSnake(plan)).returning("*");
    return toCamel<JobPlan>(row);
  }

  async updateJobPlan(id: number, data: Partial<InsertJobPlan>): Promise<JobPlan | undefined> {
    const [row] = await db("job_plans").where("id", id).update(toSnake(data)).returning("*");
    return row ? toCamel<JobPlan>(row) : undefined;
  }

  async deleteJobPlan(id: number): Promise<void> {
    await db("job_plan_lines").where("job_plan_id", id).del();
    await db("job_plans").where("id", id).del();
  }

  async getAllJobPlanLines(): Promise<JobPlanLine[]> {
    const rows = await db("job_plan_lines").select("*").orderBy("sort_order", "asc");
    return toCamelArray<JobPlanLine>(rows);
  }

  async getJobPlanLines(jobPlanId: number): Promise<JobPlanLine[]> {
    const rows = await db("job_plan_lines").where("job_plan_id", jobPlanId).orderBy("sort_order", "asc");
    return toCamelArray<JobPlanLine>(rows);
  }

  async createJobPlanLine(line: InsertJobPlanLine): Promise<JobPlanLine> {
    const [row] = await db("job_plan_lines").insert(toSnake(line)).returning("*");
    return toCamel<JobPlanLine>(row);
  }

  async updateJobPlanLine(id: number, data: Partial<InsertJobPlanLine>): Promise<JobPlanLine | undefined> {
    const [row] = await db("job_plan_lines").where("id", id).update(toSnake(data)).returning("*");
    return row ? toCamel<JobPlanLine>(row) : undefined;
  }

  async deleteJobPlanLine(id: number): Promise<void> {
    await db("job_plan_lines").where("id", id).del();
  }

  async getAllDataSources(): Promise<DataSource[]> {
    const rows = await db("data_sources").select("*").orderBy("created_at", "desc");
    return toCamelArray<DataSource>(rows);
  }

  async getDataSource(id: number): Promise<DataSource | undefined> {
    const row = await db("data_sources").where("id", id).first();
    return row ? toCamel<DataSource>(row) : undefined;
  }

  async createDataSource(ds: InsertDataSource): Promise<DataSource> {
    const [row] = await db("data_sources").insert(toSnake(ds)).returning("*");
    return toCamel<DataSource>(row);
  }

  async updateDataSource(id: number, data: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const [row] = await db("data_sources").where("id", id).update(toSnake(data)).returning("*");
    return row ? toCamel<DataSource>(row) : undefined;
  }

  async deleteDataSource(id: number): Promise<void> {
    await db("data_sources").where("id", id).del();
  }

  async getDashboardStats() {
    const [oppCount] = await db("opportunities").count("* as count");
    const [bidCount] = await db("bids").count("* as count");
    const [pendingCount] = await db("bids").where("executive_approval", "pending").count("* as count");
    const [approvedCount] = await db("bids").where("executive_approval", "approved").count("* as count");

    return {
      totalOpportunities: Number(oppCount.count),
      activeBids: Number(bidCount.count),
      pendingReview: Number(pendingCount.count),
      approved: Number(approvedCount.count),
    };
  }
}

export const storage = new DatabaseStorage();
