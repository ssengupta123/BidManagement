import { z } from "zod";

export const insertConversationSchema = z.object({
  title: z.string().min(1),
});

export const insertMessageSchema = z.object({
  conversationId: z.number(),
  role: z.string().min(1),
  content: z.string().min(1),
});

export type Conversation = {
  id: number;
  title: string;
  createdAt: Date;
};

export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
};

export type InsertMessage = z.infer<typeof insertMessageSchema>;
