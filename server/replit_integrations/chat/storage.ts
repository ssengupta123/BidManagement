import { db } from "../../db";
import type { Conversation, Message } from "@shared/models/chat";

function toCamel<T>(row: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

export interface IChatStorage {
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const row = await db("conversations").where("id", id).first();
    return row ? toCamel<Conversation>(row) : undefined;
  },

  async getAllConversations() {
    const rows = await db("conversations").select("*").orderBy("created_at", "desc");
    return rows.map((r: any) => toCamel<Conversation>(r));
  },

  async createConversation(title: string) {
    const [row] = await db("conversations").insert({ title }).returning("*");
    return toCamel<Conversation>(row);
  },

  async deleteConversation(id: number) {
    await db("messages").where("conversation_id", id).del();
    await db("conversations").where("id", id).del();
  },

  async getMessagesByConversation(conversationId: number) {
    const rows = await db("messages").where("conversation_id", conversationId).orderBy("created_at", "asc");
    return rows.map((r: any) => toCamel<Message>(r));
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [row] = await db("messages").insert({ conversation_id: conversationId, role, content }).returning("*");
    return toCamel<Message>(row);
  },
};
