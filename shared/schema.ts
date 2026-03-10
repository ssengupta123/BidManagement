import { z } from "zod";

export const insertUserSchema = z.object({
  username: z.string().min(1),
  fullName: z.string().min(1),
  role: z.string().default("writer"),
  email: z.string().nullable().optional(),
});

export const insertOpportunitySchema = z.object({
  name: z.string().min(1),
  phase: z.string().optional().default("1.A - Activity"),
  dueDate: z.union([z.coerce.date(), z.null()]).optional(),
  value: z.number().nullable().optional(),
  margin: z.number().nullable().optional(),
  workType: z.string().nullable().optional(),
  startDate: z.union([z.coerce.date(), z.null()]).optional(),
  expiryDate: z.union([z.coerce.date(), z.null()]).optional(),
  vat: z.string().nullable().optional(),
  status: z.string().optional().default("New"),
  comment: z.string().nullable().optional(),
  casLead: z.string().nullable().optional(),
  csdLead: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  partner: z.string().nullable().optional(),
  clientContact: z.string().nullable().optional(),
  clientCode: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  careDecision: z.string().nullable().optional(),
  dateIn: z.union([z.coerce.date(), z.null()]).optional(),
  source: z.string().nullable().optional(),
});

export const insertBidSchema = z.object({
  opportunityId: z.number().nullable().optional(),
  title: z.string().min(1),
  stage: z.string().default("cas_qualification"),
  casQualified: z.string().optional().default("pending"),
  csdQualified: z.string().optional().default("pending"),
  bidManagerId: z.number().nullable().optional(),
  assignedWriterId: z.number().nullable().optional(),
  careScore: z.number().nullable().optional(),
  competitivePosition: z.number().nullable().optional(),
  attractiveness: z.number().nullable().optional(),
  relationshipStrength: z.number().nullable().optional(),
  easeOfResponse: z.number().nullable().optional(),
  careAnalysis: z.string().nullable().optional(),
  technicalResponse: z.string().nullable().optional(),
  deliveryPlan: z.string().nullable().optional(),
  resourcePlan: z.string().nullable().optional(),
  executiveApproval: z.string().optional().default("pending"),
  executiveComments: z.string().nullable().optional(),
  finalResponse: z.string().nullable().optional(),
});

export const insertWorkflowLogSchema = z.object({
  bidId: z.number().nullable().optional(),
  action: z.string().min(1),
  fromStage: z.string().nullable().optional(),
  toStage: z.string().nullable().optional(),
  performedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const insertJobPlanSchema = z.object({
  bidId: z.number().nullable().optional(),
  title: z.string().min(1),
  contractStartDate: z.union([z.coerce.date(), z.null()]).optional(),
  forecastDate: z.union([z.coerce.date(), z.null()]).optional(),
});

export const insertJobPlanLineSchema = z.object({
  jobPlanId: z.number(),
  milestone: z.string().min(1),
  deliverable: z.string().nullable().optional(),
  resource: z.string().nullable().optional(),
  chargeOutLevel: z.string().nullable().optional(),
  jobRole: z.string().nullable().optional(),
  panelHourlyRate: z.number().nullable().optional(),
  discountPercent: z.number().optional().default(0),
  hourlyGrossCost: z.number().nullable().optional(),
  budgetHours: z.number().optional().default(0),
  forecastHours: z.number().optional().default(0),
  actualHours: z.number().optional().default(0),
  weeklyAllocations: z.string().optional().default("{}"),
  sortOrder: z.number().optional().default(0),
});

export type User = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  email: string | null;
};

export type InsertUser = z.infer<typeof insertUserSchema>;

export type Opportunity = {
  id: number;
  name: string;
  phase: string | null;
  dueDate: Date | null;
  value: number | null;
  margin: number | null;
  workType: string | null;
  startDate: Date | null;
  expiryDate: Date | null;
  vat: string | null;
  status: string | null;
  comment: string | null;
  casLead: string | null;
  csdLead: string | null;
  category: string | null;
  partner: string | null;
  clientContact: string | null;
  clientCode: string | null;
  channel: string | null;
  priority: string | null;
  assignedTo: string | null;
  careDecision: string | null;
  dateIn: Date | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;

export type Bid = {
  id: number;
  opportunityId: number | null;
  title: string;
  stage: string;
  casQualified: string | null;
  csdQualified: string | null;
  bidManagerId: number | null;
  assignedWriterId: number | null;
  careScore: number | null;
  competitivePosition: number | null;
  attractiveness: number | null;
  relationshipStrength: number | null;
  easeOfResponse: number | null;
  careAnalysis: string | null;
  technicalResponse: string | null;
  deliveryPlan: string | null;
  resourcePlan: string | null;
  executiveApproval: string | null;
  executiveComments: string | null;
  finalResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertBid = z.infer<typeof insertBidSchema>;

export type WorkflowLog = {
  id: number;
  bidId: number | null;
  action: string;
  fromStage: string | null;
  toStage: string | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: Date;
};

export type InsertWorkflowLog = z.infer<typeof insertWorkflowLogSchema>;

export type JobPlan = {
  id: number;
  bidId: number | null;
  title: string;
  contractStartDate: Date | null;
  forecastDate: Date | null;
  createdAt: Date;
};

export type InsertJobPlan = z.infer<typeof insertJobPlanSchema>;

export type JobPlanLine = {
  id: number;
  jobPlanId: number;
  milestone: string;
  deliverable: string | null;
  resource: string | null;
  chargeOutLevel: string | null;
  jobRole: string | null;
  panelHourlyRate: number | null;
  discountPercent: number | null;
  hourlyGrossCost: number | null;
  budgetHours: number | null;
  forecastHours: number | null;
  actualHours: number | null;
  weeklyAllocations: string | null;
  sortOrder: number | null;
};

export type InsertJobPlanLine = z.infer<typeof insertJobPlanLineSchema>;

export const insertDataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("sharepoint"),
  syncTarget: z.string().min(1),
  status: z.string().default("configured"),
  connectionInfo: z.string().nullable().optional(),
  recordsProcessed: z.number().default(0),
  lastSyncAt: z.union([z.coerce.date(), z.null()]).optional(),
});

export type DataSource = {
  id: number;
  name: string;
  type: string;
  syncTarget: string;
  status: string;
  connectionInfo: string | null;
  recordsProcessed: number;
  lastSyncAt: Date | null;
  createdAt: Date;
};

export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
