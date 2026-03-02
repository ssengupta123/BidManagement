import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOpportunitySchema, insertBidSchema, insertJobPlanSchema, insertJobPlanLineSchema } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Dashboard stats
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Users
  app.get("/api/users", async (_req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Opportunities CRUD
  app.get("/api/opportunities", async (_req, res) => {
    const opps = await storage.getAllOpportunities();
    res.json(opps);
  });

  app.get("/api/opportunities/:id", async (req, res) => {
    const opp = await storage.getOpportunity(Number(req.params.id));
    if (!opp) return res.status(404).json({ message: "Not found" });
    res.json(opp);
  });

  app.post("/api/opportunities", async (req, res) => {
    try {
      const data = insertOpportunitySchema.parse(req.body);
      const opp = await storage.createOpportunity(data);
      res.status(201).json(opp);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/opportunities/:id", async (req, res) => {
    try {
      const opp = await storage.updateOpportunity(Number(req.params.id), req.body);
      if (!opp) return res.status(404).json({ message: "Not found" });
      res.json(opp);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/opportunities/:id", async (req, res) => {
    await storage.deleteOpportunity(Number(req.params.id));
    res.status(204).send();
  });

  // Bids CRUD
  app.get("/api/bids", async (_req, res) => {
    const bidsList = await storage.getAllBids();
    res.json(bidsList);
  });

  app.get("/api/bids/:id", async (req, res) => {
    const bid = await storage.getBid(Number(req.params.id));
    if (!bid) return res.status(404).json({ message: "Not found" });
    res.json(bid);
  });

  app.post("/api/bids", async (req, res) => {
    try {
      const data = insertBidSchema.parse(req.body);
      const bid = await storage.createBid(data);
      await storage.createWorkflowLog({
        bidId: bid.id,
        action: "Bid Created",
        fromStage: null,
        toStage: "cas_qualification",
        performedBy: "System",
        notes: "Bid automatically created from opportunity",
      });
      res.status(201).json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bids/upload", async (req, res) => {
    try {
      const rows = req.body;
      if (!Array.isArray(rows)) return res.status(400).json({ message: "Expected an array of bid objects" });
      const created: any[] = [];
      const errors: { index: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const data = insertBidSchema.parse(rows[i]);
          const bid = await storage.createBid(data);
          await storage.createWorkflowLog({
            bidId: bid.id,
            action: "Bid Created",
            fromStage: null,
            toStage: data.stage || "cas_qualification",
            performedBy: "CSV Upload",
            notes: "Bulk uploaded via CSV",
          });
          created.push(bid);
        } catch (e: any) {
          errors.push({ index: i, message: e.message });
        }
      }
      res.json({ created: created.length, errors, bids: created });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/bids/:id", async (req, res) => {
    try {
      const bid = await storage.updateBid(Number(req.params.id), req.body);
      if (!bid) return res.status(404).json({ message: "Not found" });
      res.json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/bids/:id", async (req, res) => {
    await storage.deleteBid(Number(req.params.id));
    res.status(204).send();
  });

  // Workflow actions
  app.post("/api/bids/:id/qualify-cas", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const currentBid = await storage.getBid(id);
      if (!currentBid) return res.status(404).json({ message: "Bid not found" });
      if (currentBid.stage !== "cas_qualification") return res.status(400).json({ message: "Bid is not in CAS qualification stage" });
      const { qualified, notes } = req.body;
      const bid = await storage.updateBid(id, {
        casQualified: qualified ? "qualified" : "rejected",
        stage: qualified ? "csd_qualification" : "cas_rejected",
      });
      await storage.createWorkflowLog({
        bidId: id,
        action: qualified ? "CAS Qualified" : "CAS Rejected",
        fromStage: "cas_qualification",
        toStage: qualified ? "csd_qualification" : "cas_rejected",
        performedBy: req.body.performedBy || "CAS Team",
        notes,
      });
      res.json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bids/:id/qualify-csd", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const currentBid = await storage.getBid(id);
      if (!currentBid) return res.status(404).json({ message: "Bid not found" });
      if (currentBid.stage !== "csd_qualification") return res.status(400).json({ message: "Bid is not in CSD qualification stage" });
      const { qualified, notes } = req.body;
      if (typeof qualified !== "boolean") return res.status(400).json({ message: "qualified (boolean) is required" });
      const bid = await storage.updateBid(id, {
        csdQualified: qualified ? "qualified" : "rejected",
        stage: qualified ? "bid_manager_review" : "csd_rejected",
      });
      await storage.createWorkflowLog({
        bidId: id,
        action: qualified ? "CSD Qualified" : "CSD Rejected",
        fromStage: "csd_qualification",
        toStage: qualified ? "bid_manager_review" : "csd_rejected",
        performedBy: req.body.performedBy || "CSD Team",
        notes,
      });
      res.json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bids/:id/assign-writer", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const currentBid = await storage.getBid(id);
      if (!currentBid) return res.status(404).json({ message: "Bid not found" });
      if (currentBid.stage !== "bid_manager_review") return res.status(400).json({ message: "Bid is not in bid manager review stage" });
      const { writerId, bidManagerId } = req.body;
      if (!writerId || !bidManagerId) return res.status(400).json({ message: "writerId and bidManagerId are required" });
      const bid = await storage.updateBid(id, {
        assignedWriterId: writerId,
        bidManagerId: bidManagerId,
        stage: "writing",
      });
      await storage.createWorkflowLog({
        bidId: id,
        action: "Writer Assigned",
        fromStage: "bid_manager_review",
        toStage: "writing",
        performedBy: req.body.performedBy || "Bid Manager",
        notes: `Writer ID: ${writerId}`,
      });
      res.json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bids/:id/submit-for-review", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const currentBid = await storage.getBid(id);
      if (!currentBid) return res.status(404).json({ message: "Bid not found" });
      if (currentBid.stage !== "writing") return res.status(400).json({ message: "Bid is not in writing stage" });
      const bid = await storage.updateBid(id, {
        stage: "executive_review",
        executiveApproval: "pending",
      });
      await storage.createWorkflowLog({
        bidId: id,
        action: "Submitted for Executive Review",
        fromStage: "writing",
        toStage: "executive_review",
        performedBy: req.body.performedBy || "Writer",
        notes: null,
      });
      res.json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bids/:id/executive-decision", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const currentBid = await storage.getBid(id);
      if (!currentBid) return res.status(404).json({ message: "Bid not found" });
      if (currentBid.stage !== "executive_review") return res.status(400).json({ message: "Bid is not in executive review stage" });
      const { approved, comments } = req.body;
      if (typeof approved !== "boolean") return res.status(400).json({ message: "approved (boolean) is required" });
      const bid = await storage.updateBid(id, {
        executiveApproval: approved ? "approved" : "revision_needed",
        executiveComments: comments,
        stage: approved ? "approved" : "writing",
      });
      await storage.createWorkflowLog({
        bidId: id,
        action: approved ? "Executive Approved" : "Revision Requested",
        fromStage: "executive_review",
        toStage: approved ? "approved" : "writing",
        performedBy: req.body.performedBy || "Executive",
        notes: comments,
      });
      res.json(bid);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Workflow logs
  app.get("/api/bids/:id/logs", async (req, res) => {
    const logs = await storage.getWorkflowLogs(Number(req.params.id));
    res.json(logs);
  });

  // CARE Assessment via OpenAI
  app.post("/api/bids/:id/care-assessment", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bid = await storage.getBid(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      let opp = null;
      if (bid.opportunityId) {
        opp = await storage.getOpportunity(bid.opportunityId);
      }

      const { customPrompt } = req.body;

      const systemPrompt = customPrompt || `You are an expert bid qualification analyst. Evaluate this opportunity using the CARE framework:

C - Competitive Position (1-10): How strong is our position vs competitors? Consider market presence, unique capabilities, past performance, pricing advantage.

A - Attractiveness (1-10): How attractive is this opportunity? Consider revenue potential, strategic alignment, growth potential, margin opportunity.

R - Relationship Strength (1-10): How strong is our relationship with the client? Consider existing contracts, key contacts, trust level, past delivery success.

E - Ease of Response (1-10): How easy is it to respond to this bid? Consider timeline, resource availability, solution readiness, complexity of requirements.

Provide scores for each dimension, an overall CARE score (average), and detailed analysis explaining each score.

Respond in JSON format:
{
  "competitivePosition": <number>,
  "attractiveness": <number>,
  "relationshipStrength": <number>,
  "easeOfResponse": <number>,
  "overallScore": <number>,
  "analysis": "<detailed analysis string>"
}`;

      const oppContext = opp ? `
Opportunity Details:
- Name: ${opp.name}
- Phase: ${opp.phase}
- Value: $${opp.value || 'Unknown'}
- Work Type: ${opp.workType || 'Unknown'}
- Category: ${opp.category || 'Unknown'}
- Partner: ${opp.partner || 'Unknown'}
- Client: ${opp.clientCode || 'Unknown'}
- Status: ${opp.status || 'Unknown'}
- Comment: ${opp.comment || 'None'}
- CAS Lead: ${opp.casLead || 'Unknown'}
- CSD Lead: ${opp.csdLead || 'Unknown'}` : `Bid Title: ${bid.title}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please evaluate the following opportunity:\n${oppContext}` },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const updated = await storage.updateBid(id, {
        competitivePosition: result.competitivePosition,
        attractiveness: result.attractiveness,
        relationshipStrength: result.relationshipStrength,
        easeOfResponse: result.easeOfResponse,
        careScore: result.overallScore,
        careAnalysis: result.analysis,
      });

      await storage.createWorkflowLog({
        bidId: id,
        action: "CARE Assessment Completed",
        fromStage: bid.stage,
        toStage: bid.stage,
        performedBy: "AI Assessment",
        notes: `Overall CARE Score: ${result.overallScore}/10`,
      });

      res.json({ ...updated, careResult: result });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Generate technical response
  app.post("/api/bids/:id/generate-response", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bid = await storage.getBid(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      let opp = null;
      if (bid.opportunityId) {
        opp = await storage.getOpportunity(bid.opportunityId);
      }

      const oppInfo = opp ? `
Opportunity: ${opp.name}
Value: $${opp.value || 'TBD'}
Work Type: ${opp.workType || 'General'}
Category: ${opp.category || 'General'}
Partner Technologies: ${opp.partner || 'N/A'}
Client: ${opp.clientCode || 'N/A'}
Requirements: ${opp.comment || 'Standard engagement'}` : `Bid: ${bid.title}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert technical bid writer for Reason Group, a leading technology consultancy. Generate a comprehensive technical response for a bid submission. The response should be professional, detailed, and follow the Reason Group template format.

Structure the response with these sections:
1. Executive Summary
2. Understanding of Requirements
3. Proposed Solution & Approach
4. Technical Architecture
5. Implementation Methodology
6. Team & Expertise
7. Quality Assurance & Risk Management
8. Timeline & Milestones
9. Value Proposition
10. References & Past Experience

Use professional language, be specific about methodologies, and highlight competitive advantages. Format in markdown.`
          },
          { role: "user", content: `Generate a technical bid response for:\n${oppInfo}\n\nCARE Analysis: ${bid.careAnalysis || 'Not available'}` },
        ],
        max_tokens: 4096,
      });

      const technicalResponse = response.choices[0]?.message?.content || "";
      const updated = await storage.updateBid(id, { technicalResponse });

      await storage.createWorkflowLog({
        bidId: id,
        action: "Technical Response Generated",
        fromStage: bid.stage,
        toStage: bid.stage,
        performedBy: "AI Generator",
        notes: null,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Generate delivery plan
  app.post("/api/bids/:id/generate-delivery-plan", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bid = await storage.getBid(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      let opp = null;
      if (bid.opportunityId) {
        opp = await storage.getOpportunity(bid.opportunityId);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert delivery manager for Reason Group. Generate a comprehensive delivery plan based on past experience and industry best practices.

Structure the plan with:
1. Delivery Overview & Objectives
2. Phase Breakdown (Discovery, Design, Build, Test, Deploy, Hypercare)
3. Governance Model
4. Communication Plan
5. Risk Register & Mitigation
6. Quality Gates & Checkpoints
7. Dependencies & Assumptions
8. Success Criteria & KPIs
9. Lessons Learned from Past Engagements

Format in markdown. Be specific with timelines and deliverables.`
          },
          {
            role: "user",
            content: `Generate a delivery plan for:
${opp ? `Project: ${opp.name}\nWork Type: ${opp.workType}\nValue: $${opp.value}\nPartner: ${opp.partner}\nDuration: ${opp.startDate && opp.expiryDate ? 'Defined' : 'TBD'}` : `Bid: ${bid.title}`}
${bid.technicalResponse ? `\nTechnical Approach Summary: ${bid.technicalResponse.substring(0, 500)}...` : ''}`
          },
        ],
        max_tokens: 4096,
      });

      const deliveryPlan = response.choices[0]?.message?.content || "";
      const updated = await storage.updateBid(id, { deliveryPlan });

      await storage.createWorkflowLog({
        bidId: id,
        action: "Delivery Plan Generated",
        fromStage: bid.stage,
        toStage: bid.stage,
        performedBy: "AI Generator",
        notes: null,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Generate resource plan
  app.post("/api/bids/:id/generate-resource-plan", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bid = await storage.getBid(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      let opp = null;
      if (bid.opportunityId) {
        opp = await storage.getOpportunity(bid.opportunityId);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert resource planner for Reason Group. Generate a comprehensive resource plan.

Structure the plan with:
1. Resource Summary
2. Team Structure & Roles
3. Resource Allocation by Phase
4. Skills Matrix
5. Onboarding & Knowledge Transfer Plan
6. Resource Ramp-up/Ramp-down Schedule
7. Contingency Resources
8. Cost Breakdown by Role

Present resource tables in markdown table format. Be specific about roles, FTE requirements, and duration.`
          },
          {
            role: "user",
            content: `Generate a resource plan for:
${opp ? `Project: ${opp.name}\nWork Type: ${opp.workType}\nValue: $${opp.value}\nPartner: ${opp.partner}` : `Bid: ${bid.title}`}
${bid.technicalResponse ? `\nTechnical Approach: ${bid.technicalResponse.substring(0, 300)}...` : ''}
${bid.deliveryPlan ? `\nDelivery Plan Summary: ${bid.deliveryPlan.substring(0, 300)}...` : ''}`
          },
        ],
        max_tokens: 4096,
      });

      const resourcePlan = response.choices[0]?.message?.content || "";
      const updated = await storage.updateBid(id, { resourcePlan });

      await storage.createWorkflowLog({
        bidId: id,
        action: "Resource Plan Generated",
        fromStage: bid.stage,
        toStage: bid.stage,
        performedBy: "AI Generator",
        notes: null,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Generate final response (combines all sections)
  app.post("/api/bids/:id/generate-final", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bid = await storage.getBid(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      let opp = null;
      if (bid.opportunityId) {
        opp = await storage.getOpportunity(bid.opportunityId);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert bid compiler for Reason Group. Compile all sections into a final, polished bid response in the Reason Group template format. The document should be cohesive, professional, and ready for executive review.

Format the final response with:
- Cover Page Information
- Table of Contents
- All sections numbered and formatted
- Professional markdown formatting
- Clear section breaks`
          },
          {
            role: "user",
            content: `Compile the final bid response for: ${opp?.name || bid.title}

CARE Assessment:
${bid.careAnalysis || 'Not available'}

Technical Response:
${bid.technicalResponse || 'Not available'}

Delivery Plan:
${bid.deliveryPlan || 'Not available'}

Resource Plan:
${bid.resourcePlan || 'Not available'}`
          },
        ],
        max_tokens: 8192,
      });

      const finalResponse = response.choices[0]?.message?.content || "";
      const updated = await storage.updateBid(id, { finalResponse });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PDF generation endpoint
  app.get("/api/bids/:id/download-pdf", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bid = await storage.getBid(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      let opp = null;
      if (bid.opportunityId) {
        opp = await storage.getOpportunity(bid.opportunityId);
      }

      const escapeHtml = (str: string) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      const rawContent = bid.finalResponse || bid.technicalResponse || "No response content available.";
      const content = escapeHtml(rawContent);
      const title = escapeHtml(opp?.name || bid.title);
      const date = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - Reason Group Bid Response</title>
  <style>
    @page { margin: 2cm; size: A4; }
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .cover { text-align: center; padding: 60px 0; border-bottom: 3px solid #2563eb; margin-bottom: 40px; page-break-after: always; }
    .cover h1 { font-size: 28px; color: #1e3a5f; margin-bottom: 10px; }
    .cover .subtitle { font-size: 16px; color: #666; margin: 5px 0; }
    .cover .logo { font-size: 32px; font-weight: bold; color: #2563eb; margin-bottom: 30px; letter-spacing: 2px; }
    h1 { font-size: 22px; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px; }
    h2 { font-size: 18px; color: #2563eb; margin-top: 24px; }
    h3 { font-size: 15px; color: #374151; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #f3f4f6; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 12px; color: #888; }
    .care-scores { display: flex; justify-content: space-around; margin: 20px 0; }
    .care-score { text-align: center; padding: 15px; }
    .care-score .value { font-size: 28px; font-weight: bold; color: #2563eb; }
    .care-score .label { font-size: 11px; color: #666; margin-top: 4px; }
    pre { background: #f8f9fa; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    p { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="logo">REASON GROUP</div>
    <h1>${title}</h1>
    <div class="subtitle">Bid Response Document</div>
    <div class="subtitle">Prepared: ${date}</div>
    ${bid.careScore ? `<div class="subtitle" style="margin-top: 15px; font-weight: bold;">CARE Score: ${bid.careScore.toFixed(1)}/10</div>` : ''}
    ${opp?.value ? `<div class="subtitle">Estimated Value: $${opp.value.toLocaleString()}</div>` : ''}
    ${opp?.clientCode ? `<div class="subtitle">Client: ${opp.clientCode}</div>` : ''}
  </div>

  ${bid.careScore ? `
  <h1>CARE Assessment Summary</h1>
  <table>
    <tr><th>Dimension</th><th>Score</th></tr>
    <tr><td>Competitive Position (C)</td><td>${bid.competitivePosition?.toFixed(1) || '-'}/10</td></tr>
    <tr><td>Attractiveness (A)</td><td>${bid.attractiveness?.toFixed(1) || '-'}/10</td></tr>
    <tr><td>Relationship Strength (R)</td><td>${bid.relationshipStrength?.toFixed(1) || '-'}/10</td></tr>
    <tr><td>Ease of Response (E)</td><td>${bid.easeOfResponse?.toFixed(1) || '-'}/10</td></tr>
    <tr><th>Overall CARE Score</th><th>${bid.careScore.toFixed(1)}/10</th></tr>
  </table>
  ${bid.careAnalysis ? `<p>${escapeHtml(bid.careAnalysis)}</p>` : ''}
  ` : ''}

  <div class="content">${content
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')}</div>

  <div class="footer">
    <p><strong>Confidential</strong> - Reason Group Pty Ltd</p>
    <p>This document is the property of Reason Group and contains confidential information.</p>
    <p>ABN: XX XXX XXX XXX | Generated: ${date}</p>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}_Bid_Response.html"`);
      res.send(htmlContent);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Job Plans CRUD
  app.get("/api/job-plans", async (_req, res) => {
    const plans = await storage.getAllJobPlans();
    res.json(plans);
  });

  app.get("/api/job-plans/:id", async (req, res) => {
    const plan = await storage.getJobPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Not found" });
    res.json(plan);
  });

  app.get("/api/job-plan-lines/all", async (_req, res) => {
    const lines = await storage.getAllJobPlanLines();
    res.json(lines);
  });

  app.get("/api/job-plans/:id/lines", async (req, res) => {
    const lines = await storage.getJobPlanLines(Number(req.params.id));
    res.json(lines);
  });

  app.get("/api/bids/:id/job-plans", async (req, res) => {
    const plans = await storage.getJobPlansByBid(Number(req.params.id));
    res.json(plans);
  });

  app.post("/api/opportunities/upload", async (req, res) => {
    try {
      const rows = req.body;
      if (!Array.isArray(rows)) return res.status(400).json({ message: "Expected an array of opportunity objects" });
      const created: any[] = [];
      const errors: { index: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const data = insertOpportunitySchema.parse(rows[i]);
          const opp = await storage.createOpportunity(data);
          created.push(opp);
        } catch (e: any) {
          errors.push({ index: i, message: e.message });
        }
      }
      res.json({ created: created.length, errors, items: created });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/job-plans/upload", async (req, res) => {
    try {
      const rows = req.body;
      if (!Array.isArray(rows)) return res.status(400).json({ message: "Expected an array of job plan objects" });
      const created: any[] = [];
      const errors: { index: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const planData = insertJobPlanSchema.parse({
            title: rows[i].title,
            bidId: rows[i].bidId ? Number(rows[i].bidId) : null,
            contractStartDate: rows[i].contractStartDate || null,
            forecastDate: rows[i].forecastDate || null,
          });
          const plan = await storage.createJobPlan(planData);

          if (rows[i].lines && Array.isArray(rows[i].lines)) {
            for (const line of rows[i].lines) {
              const lineData = insertJobPlanLineSchema.parse({
                ...line,
                jobPlanId: plan.id,
              });
              await storage.createJobPlanLine(lineData);
            }
          }
          created.push(plan);
        } catch (e: any) {
          errors.push({ index: i, message: e.message });
        }
      }
      res.json({ created: created.length, errors, items: created });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/job-plans", async (req, res) => {
    try {
      const data = insertJobPlanSchema.parse(req.body);
      const plan = await storage.createJobPlan(data);
      res.status(201).json(plan);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/job-plans/:id", async (req, res) => {
    try {
      const data = insertJobPlanSchema.partial().parse(req.body);
      const plan = await storage.updateJobPlan(Number(req.params.id), data);
      if (!plan) return res.status(404).json({ message: "Not found" });
      res.json(plan);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/job-plans/:id", async (req, res) => {
    await storage.deleteJobPlan(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/job-plans/:id/lines", async (req, res) => {
    try {
      const data = insertJobPlanLineSchema.parse({
        ...req.body,
        jobPlanId: Number(req.params.id),
      });
      const line = await storage.createJobPlanLine(data);
      res.status(201).json(line);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/job-plan-lines/:id", async (req, res) => {
    try {
      const data = insertJobPlanLineSchema.partial().parse(req.body);
      const line = await storage.updateJobPlanLine(Number(req.params.id), data);
      if (!line) return res.status(404).json({ message: "Not found" });
      res.json(line);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/job-plan-lines/:id", async (req, res) => {
    await storage.deleteJobPlanLine(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
