// services/SQLiteService.ts
import * as SQLite from 'expo-sqlite';

export interface UserProfile {
  id: number;
  name: string;
  nickname?: string;
  role?: string;
  age_group?: string;
  gender?: string;
  traits_json: string; // JSON array of selected traits
  created_at: string;
}

export interface Message {
  id: number;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  context_json?: string; // For storing suggestion options, etc.
}

export interface Note {
  id: number;
  title: string;
  body: string;
  created_by: 'user' | 'vi';
  tags?: string;
  created_at: string;
}

export interface List {
  id: number;
  title: string;
  type: string; // 'grocery', 'todo', 'movies', etc.
  created_at: string;
}

export interface ListItem {
  id: number;
  list_id: number;
  content: string;
  is_completed: boolean;
  created_at: string;
}

export interface Goal {
  id: number;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  streak_count: number;
  last_completed_date?: string;
  target_count?: number; // e.g., "3/5 days"
  created_at: string;
}

export interface MindmapNode {
  id: number;
  label: string;
  category: 'values' | 'goals' | 'personality' | 'facts';
  confidence_score: number; // 0-1, how confident Vi is about this
  linked_node_id?: number; // For relationships
  created_at: string;
}

class SQLiteService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init() {
    this.db = await SQLite.openDatabaseAsync('vichar.db');
    await this.createTables();
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // User Profile Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nickname TEXT,
        role TEXT,
        age_group TEXT,
        gender TEXT,
        traits_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Messages Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS Messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        sender TEXT NOT NULL CHECK(sender IN ('user', 'assistant')),
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        context_json TEXT
      );
    `);

    // Notes Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS Notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_by TEXT NOT NULL CHECK(created_by IN ('user', 'vi')),
        tags TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Lists Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS Lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // List Items Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS ListItems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES Lists(id) ON DELETE CASCADE
      );
    `);

    // Goals Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS Goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
        streak_count INTEGER DEFAULT 0,
        last_completed_date TEXT,
        target_count INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Mindmap Nodes Table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS MindmapNodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('values', 'goals', 'personality', 'facts')),
        confidence_score REAL DEFAULT 0.8,
        linked_node_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (linked_node_id) REFERENCES MindmapNodes(id)
      );
    `);
  }

  // User Profile Methods
  async createUser(profile: Omit<UserProfile, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO User (name, nickname, role, age_group, gender, traits_json) VALUES (?, ?, ?, ?, ?, ?)',
      [profile.name, profile.nickname || null, profile.role || null, 
       profile.age_group || null, profile.gender || null, profile.traits_json]
    );
    
    return result.lastInsertRowId;
  }

  async getUser(): Promise<UserProfile | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync<UserProfile>('SELECT * FROM User LIMIT 1');
    return result || null;
  }

  async updateUserTraits(traits: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'UPDATE User SET traits_json = ? WHERE id = (SELECT id FROM User LIMIT 1)',
      [JSON.stringify(traits)]
    );
  }

  // Message Methods
  async addMessage(content: string, sender: 'user' | 'assistant', contextJson?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO Messages (content, sender, context_json) VALUES (?, ?, ?)',
      [content, sender, contextJson || null]
    );
    
    return result.lastInsertRowId;
  }

  async getRecentMessages(limit: number = 10): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const messages = await this.db.getAllAsync<Message>(
      'SELECT * FROM Messages ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    
    return messages.reverse();
  }

  async getAllMessages(): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllAsync<Message>('SELECT * FROM Messages ORDER BY timestamp ASC');
  }

  // Note Methods
  async addNote(title: string, body: string, createdBy: 'user' | 'vi', tags?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO Notes (title, body, created_by, tags) VALUES (?, ?, ?, ?)',
      [title, body, createdBy, tags || null]
    );
    
    return result.lastInsertRowId;
  }

  async getAllNotes(): Promise<Note[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllAsync<Note>('SELECT * FROM Notes ORDER BY created_at DESC');
  }

  async updateNote(id: number, title: string, body: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('UPDATE Notes SET title = ?, body = ? WHERE id = ?', [title, body, id]);
  }

  // List Methods
  async createList(title: string, type: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO Lists (title, type) VALUES (?, ?)',
      [title, type]
    );
    
    return result.lastInsertRowId;
  }

  async getAllLists(): Promise<List[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllAsync<List>('SELECT * FROM Lists ORDER BY created_at DESC');
  }

  async addListItem(listId: number, content: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO ListItems (list_id, content) VALUES (?, ?)',
      [listId, content]
    );
    
    return result.lastInsertRowId;
  }

  async getListItems(listId: number): Promise<ListItem[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllAsync<ListItem>(
      'SELECT * FROM ListItems WHERE list_id = ? ORDER BY created_at ASC',
      [listId]
    );
  }

  async toggleListItem(itemId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      'UPDATE ListItems SET is_completed = NOT is_completed WHERE id = ?',
      [itemId]
    );
  }

  // Goal Methods
  async createGoal(title: string, frequency: 'daily' | 'weekly' | 'monthly', targetCount?: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO Goals (title, frequency, target_count) VALUES (?, ?, ?)',
      [title, frequency, targetCount || null]
    );
    
    return result.lastInsertRowId;
  }

  async getAllGoals(): Promise<Goal[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllAsync<Goal>('SELECT * FROM Goals ORDER BY created_at DESC');
  }

  async updateGoalStreak(goalId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    
    await this.db.runAsync(
      'UPDATE Goals SET streak_count = streak_count + 1, last_completed_date = ? WHERE id = ?',
      [now, goalId]
    );
  }

  // Mindmap Methods
  async addMindmapNode(
    label: string, 
    category: 'values' | 'goals' | 'personality' | 'facts',
    confidenceScore: number = 0.8,
    linkedNodeId?: number
  ): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO MindmapNodes (label, category, confidence_score, linked_node_id) VALUES (?, ?, ?, ?)',
      [label, category, confidenceScore, linkedNodeId || null]
    );
    
    return result.lastInsertRowId;
  }

  async getAllMindmapNodes(): Promise<MindmapNode[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllAsync<MindmapNode>('SELECT * FROM MindmapNodes ORDER BY created_at ASC');
  }
}

export const dbService = new SQLiteService();