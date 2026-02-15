// services/BackgroundAgent.ts
import { dbService, Message } from './SQLiteService';
import { llmService } from './LLMService';

export interface AnalysisResult {
  notes: Array<{
    title: string;
    body: string;
  }>;
  listItems: Array<{
    listName: string;
    items: string[];
  }>;
  completedGoals: Array<{
    title: string;
  }>;
  mindmapNodes: Array<{
    label: string;
    category: 'values' | 'goals' | 'personality' | 'facts';
    confidence: number;
  }>;
}

class BackgroundAgent {
  private isProcessing: boolean = false;
  private lastProcessedMessageId: number = 0;

  /**
   * Process recent conversations to extract structured data
   * This is the "Slow Path" that runs in the background
   */
  async processRecentConversations(): Promise<void> {
    if (this.isProcessing) {
      console.log('Background agent already processing...');
      return;
    }

    if (!llmService.isReady()) {
      console.log('LLM not ready, skipping background processing');
      return;
    }

    this.isProcessing = true;

    try {
      // Get recent messages (since last processing)
      const allMessages = await dbService.getAllMessages();
      
      if (allMessages.length === 0) {
        console.log('No messages to process');
        this.isProcessing = false;
        return;
      }

      // Get only new messages since last processing
      const newMessages = allMessages.filter(
        msg => (msg.id || 0) > this.lastProcessedMessageId
      );

      if (newMessages.length < 2) {
        // Need at least a question-answer pair to extract meaningful data
        console.log('Not enough new messages for background processing');
        this.isProcessing = false;
        return;
      }

      console.log(`Processing ${newMessages.length} new messages...`);

      // Analyze the conversation
      const rawAnalysis = await llmService.analyzeConversation(newMessages);
      
      // Parse JSON response
      const analysis = this.parseAnalysisResult(rawAnalysis);

      if (analysis) {
        // Apply the extracted data to the database
        await this.applyAnalysisResults(analysis);
        
        // Update last processed message ID
        const lastMessage = newMessages[newMessages.length - 1];
        this.lastProcessedMessageId = lastMessage.id || 0;

        console.log('Background processing complete:', {
          notes: analysis.notes.length,
          listItems: analysis.listItems.length,
          completedGoals: analysis.completedGoals.length,
          mindmapNodes: analysis.mindmapNodes.length,
        });
      }

    } catch (error) {
      console.error('Background processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Parse the LLM's JSON response into structured data
   */
  private parseAnalysisResult(rawJson: string): AnalysisResult | null {
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanJson = rawJson.trim();
      
      // Remove ```json and ``` markers if present
      cleanJson = cleanJson.replace(/^```json\n?/i, '');
      cleanJson = cleanJson.replace(/\n?```$/, '');
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);

      // Validate structure
      return {
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        listItems: Array.isArray(parsed.listItems) ? parsed.listItems : [],
        completedGoals: Array.isArray(parsed.completedGoals) ? parsed.completedGoals : [],
        mindmapNodes: Array.isArray(parsed.mindmapNodes) ? parsed.mindmapNodes : [],
      };
    } catch (error) {
      console.error('Failed to parse analysis result:', error);
      console.error('Raw JSON:', rawJson);
      return null;
    }
  }

  /**
   * Apply the analysis results to the database
   */
  private async applyAnalysisResults(analysis: AnalysisResult): Promise<void> {
    // 1. Add Notes
    for (const note of analysis.notes) {
      if (note.title && note.body) {
        await dbService.addNote(note.title, note.body, 'vi');
        console.log(`Added note: ${note.title}`);
      }
    }

    // 2. Add List Items
    for (const listGroup of analysis.listItems) {
      // Find matching list
      const allLists = await dbService.getAllLists();
      const targetList = allLists.find(list =>
        list.title.toLowerCase().includes(listGroup.listName.toLowerCase()) ||
        listGroup.listName.toLowerCase().includes(list.title.toLowerCase())
      );

      if (targetList) {
        for (const item of listGroup.items) {
          // Check if item already exists (simple duplicate prevention)
          const existingItems = await dbService.getListItems(targetList.id);
          const isDuplicate = existingItems.some(
            existing => existing.content.toLowerCase() === item.toLowerCase()
          );

          if (!isDuplicate) {
            await dbService.addListItem(targetList.id, item);
            console.log(`Added to ${targetList.title}: ${item}`);
          }
        }
      } else {
        // Create new list if it doesn't exist
        const newListId = await dbService.createList(
          listGroup.listName,
          listGroup.listName.toLowerCase().replace(/\s+/g, '_')
        );
        
        for (const item of listGroup.items) {
          await dbService.addListItem(newListId, item);
        }
        
        console.log(`Created new list: ${listGroup.listName} with ${listGroup.items.length} items`);
      }
    }

    // 3. Update Completed Goals
    for (const goalCompletion of analysis.completedGoals) {
      const allGoals = await dbService.getAllGoals();
      const targetGoal = allGoals.find(goal =>
        goal.title.toLowerCase().includes(goalCompletion.title.toLowerCase()) ||
        goalCompletion.title.toLowerCase().includes(goal.title.toLowerCase())
      );

      if (targetGoal) {
        await dbService.updateGoalStreak(targetGoal.id);
        console.log(`Updated goal streak: ${targetGoal.title}`);
      }
    }

    // 4. Add Mindmap Nodes
    for (const node of analysis.mindmapNodes) {
      if (node.label && node.category) {
        // Check for duplicates
        const existingNodes = await dbService.getAllMindmapNodes();
        const isDuplicate = existingNodes.some(
          existing => existing.label.toLowerCase() === node.label.toLowerCase()
        );

        if (!isDuplicate) {
          await dbService.addMindmapNode(
            node.label,
            node.category,
            node.confidence || 0.8
          );
          console.log(`Added mindmap node: ${node.label} (${node.category})`);
        }
      }
    }
  }

  /**
   * Trigger background processing manually
   */
  async triggerManualProcessing(): Promise<void> {
    console.log('Manual background processing triggered');
    await this.processRecentConversations();
  }

  /**
   * Reset processing state (for testing)
   */
  reset(): void {
    this.lastProcessedMessageId = 0;
    this.isProcessing = false;
  }

  /**
   * Get processing status
   */
  getStatus(): { isProcessing: boolean; lastProcessedId: number } {
    return {
      isProcessing: this.isProcessing,
      lastProcessedId: this.lastProcessedMessageId,
    };
  }
}

// Singleton instance
export const backgroundAgent = new BackgroundAgent();

/**
 * Setup automatic background processing
 * Call this in your main App.tsx
 */
export function setupBackgroundProcessing() {
  // Process when app is backgrounded (via AppState listener in ChatScreen)
  // You can also set up periodic processing if needed
  
  return {
    /**
     * Call this when app goes to background
     */
    onAppBackground: async () => {
      console.log('App backgrounded - starting background processing...');
      await backgroundAgent.processRecentConversations();
    },

    /**
     * Manual trigger (can be called from UI)
     */
    triggerNow: async () => {
      await backgroundAgent.triggerManualProcessing();
    },

    /**
     * Get current status
     */
    getStatus: () => backgroundAgent.getStatus(),
  };
}