// services/LLMService.ts
import { initLlama, LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';
import { Message } from './SQLiteService';

export interface LLMConfig {
  modelUrl: string;
  modelName: string;
  systemPrompt: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
}

export interface GenerationResult {
  text: string;
  suggestions?: string[];
}

class LLMService {
  private context: LlamaContext | null = null;
  private systemPrompt: string = '';
  private modelPath: string = '';
  private isInitialized: boolean = false;

  /**
   * Check if the native llama.rn module is properly loaded
   * This is a workaround for the issue where RNLlama is null
   */
  private async checkNativeModule(): Promise<boolean> {
    console.log('Performing comprehensive native module health check...');
    
    // Phase 1: Basic JS module check
    if (typeof initLlama !== 'function') {
      console.error('Phase 1 FAILED: initLlama is not a function - JS module may not be imported correctly');
      return false;
    }
    console.log('Phase 1 PASSED: initLlama is a function');
    
    // Phase 2: Native bridge connectivity test
    // Try multiple approaches to detect if native module is actually connected
    const testApproaches = [
      {
        name: 'getBackendDevicesInfo',
        test: async () => {
          const { getBackendDevicesInfo } = await import('llama.rn');
          if (typeof getBackendDevicesInfo === 'function') {
            const result = await getBackendDevicesInfo();
            return Array.isArray(result);
          }
          return false;
        }
      },
      {
        name: 'toggleNativeLog',
        test: async () => {
          const { toggleNativeLog } = await import('llama.rn');
          if (typeof toggleNativeLog === 'function') {
            await toggleNativeLog(false);
            return true;
          }
          return false;
        }
      }
    ];
    
    for (const approach of testApproaches) {
      try {
        console.log(`Testing native module via ${approach.name}...`);
        const success = await approach.test();
        if (success) {
          console.log(`Phase 2 PASSED: Native module responds to ${approach.name}`);
          return true;
        }
      } catch (error: any) {
        console.log(`Phase 2 ${approach.name} test failed:`, error?.message || 'Unknown error');
        // Continue to next approach
      }
    }
    
    // Phase 3: Extended wait and retry with progressive delays
    console.log('Phase 3: Extended native module detection with progressive delays...');
    const delays = [2000, 4000, 6000]; // 2s, 4s, 6s
    for (let i = 0; i < delays.length; i++) {
      console.log(`Attempt ${i + 1}/${delays.length}: Waiting ${delays[i]}ms...`);
      await new Promise(resolve => setTimeout(resolve, delays[i]));
      
      try {
        // Re-import to get fresh module reference
        const llamaModule = await import('llama.rn');
        
        // Try to access a native method
        if (typeof llamaModule.getBackendDevicesInfo === 'function') {
          try {
            await llamaModule.getBackendDevicesInfo();
            console.log(`Phase 3 PASSED: Native module detected after ${delays[i]}ms wait`);
            return true;
          } catch (error: any) {
            // Even if it errors, check if it's a native module error vs. initContext null error
            if (error?.message && !error.message.includes('initContext') && !error.message.includes('null')) {
              console.log(`Phase 3 PASSED: Native module responding (different error):`, error.message);
              return true;
            }
          }
        }
      } catch (error: any) {
        console.log(`Phase 3 attempt ${i + 1} failed:`, error?.message || 'Unknown error');
      }
    }
    
    // Phase 4: Last resort - try to detect if this is an Android-specific issue
    console.log('Phase 4: Checking for platform-specific issues...');
    try {
      const { Platform } = await import('react-native');
      console.log(`Platform: ${Platform.OS}, Version: ${Platform.Version}`);
      
      if (Platform.OS === 'android') {
        console.log('Android detected - ensure native module is linked in MainApplication.java');
        console.log('If this is a fresh install, try:');
        console.log('1. Clean build: cd android && ./gradlew clean');
        console.log('2. Rebuild: npm run android');
        console.log('3. If using physical device, ensure USB debugging is enabled');
      } else if (Platform.OS === 'ios') {
        console.log('iOS detected - ensure pods are installed:');
        console.log('1. cd ios && pod install');
        console.log('2. Rebuild: npm run ios');
      }
    } catch (platformError) {
      // Ignore platform detection errors
    }
    
    console.error('COMPREHENSIVE NATIVE MODULE CHECK FAILED');
    console.error('The llama.rn native module is not responding. Possible causes:');
    console.error('1. Native module not properly linked (run "npx react-native link llama.rn" if using RN < 0.60)');
    console.error('2. App needs to be rebuilt (npm run android / npm run ios)');
    console.error('3. Native dependencies missing (check llama.rn documentation)');
    console.error('4. Incompatible React Native version (llama.rn requires specific RN version)');
    
    return false;
  }

  /**
   * Download and initialize the LLM model
   */
  async initialize(
    config: LLMConfig,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      this.systemPrompt = config.systemPrompt;
      this.modelPath = `${FileSystem.documentDirectory}${config.modelName}`;

      // Wait longer for native modules to load (increased from 500ms)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if model already exists and is valid
      const fileInfo = await FileSystem.getInfoAsync(this.modelPath);
      let shouldDownload = !fileInfo.exists;

      // If file exists but might be corrupted (too small for a GGUF model)
      if (fileInfo.exists && fileInfo.size !== undefined) {
        // GGUF files should be at least several MB
        if (fileInfo.size < 1024 * 1024) { // Less than 1MB
          console.warn(`Model file exists but is suspiciously small (${fileInfo.size} bytes). Redownloading...`);
          await FileSystem.deleteAsync(this.modelPath, { idempotent: true });
          shouldDownload = true;
        } else {
          console.log(`Model file exists with size: ${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB`);
        }
      }

      if (shouldDownload) {
        console.log('Downloading model from:', config.modelUrl);
        // Download model from URL
        const downloadResumable = FileSystem.createDownloadResumable(
          config.modelUrl,
          this.modelPath,
          {},
          (downloadProgress) => {
            const progress = 
              downloadProgress.totalBytesWritten / 
              downloadProgress.totalBytesExpectedToWrite;
            onProgress?.(progress);
          }
        );

        const downloadResult = await downloadResumable.downloadAsync();
        console.log('Download completed:', downloadResult);
        
        // Verify download completed successfully
        const downloadedFileInfo = await FileSystem.getInfoAsync(this.modelPath);
        if (!downloadedFileInfo.exists || downloadedFileInfo.size === 0) {
          throw new Error('Downloaded model file is missing or empty');
        }
        console.log(`Downloaded file size: ${(downloadedFileInfo.size! / (1024 * 1024)).toFixed(2)} MB`);
        
        // Give file system time to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Additional wait for native modules after download
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if native module is properly loaded before attempting initialization
      console.log('Checking native module availability...');
      const nativeModuleReady = await this.checkNativeModule();
      if (!nativeModuleReady) {
        throw new Error('AI engine (llama.rn) is not ready. Please restart the app and try again.');
      }
      
      // Try to check if initLlama is actually available
      if (typeof initLlama !== 'function') {
        throw new Error('llama.rn module not properly loaded - initLlama is not a function');
      }

      // Initialize llama.rn context with enhanced retry logic
      let retryCount = 0;
      const maxRetries = 5; // Increased from 3 to 5
      let lastError = null;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempting llama.rn initialization (attempt ${retryCount + 1}/${maxRetries})...`);
          
          // Use simpler parameters for first attempt
          const initParams: any = {
            model: this.modelPath,
            n_ctx: 2048,
          };
          
          // Only add GPU layers on retry attempts to troubleshoot
          if (retryCount > 0) {
            initParams.n_gpu_layers = 99; // Max GPU usage for Pixel 10
          }
          
          this.context = await initLlama(initParams);
          
          console.log('llama.rn initialization successful');
          this.isInitialized = true;
          return; // Success - exit function
        } catch (initError) {
          lastError = initError;
          console.error(`llama.rn initialization attempt ${retryCount + 1} failed:`, initError);
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Wait before retrying (exponential backoff with longer delays)
            const delay = 1000 * retryCount; // 1s, 2s, 3s, 4s
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Failed to initialize llama.rn after multiple attempts');
    } catch (error: any) {
      console.error('LLM initialization error:', error);
      // Don't set isInitialized to true if init fails
      this.isInitialized = false;
      this.context = null;
      
      // Provide a more helpful error message
      let errorMessage = 'Error initializing AI model';
      let recoveryHint = '';
      
      if (error.message && error.message.includes('initContext')) {
        errorMessage = 'AI native module failed to load';
        recoveryHint = 'Please completely close and restart the app.';
      } else if (error.message && error.message.includes('null')) {
        errorMessage = 'AI engine not properly loaded';
        recoveryHint = 'The app may need to be reinstalled or the device restarted.';
      } else if (error.message && error.message.includes('llama.rn module not properly loaded')) {
        errorMessage = 'AI engine component missing';
        recoveryHint = 'Please reinstall the app or check for updates.';
      } else if (error.message && error.message.includes('not ready')) {
        errorMessage = 'AI engine not ready';
        recoveryHint = 'Please restart the app and try again.';
      }
      
      const fullMessage = recoveryHint ? `${errorMessage}. ${recoveryHint}` : errorMessage;
      const enhancedError = new Error(`${fullMessage}\nOriginal error: ${error.message}`);
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
  }

  /**
   * Generate a response from the AI (Fast Path - for chat)
   */
async generateResponse(
    userMessage: string,
    conversationHistory: Message[],
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    if (!this.context || !this.isInitialized) {
      throw new Error('LLM not initialized.');
    }

    // Defaults optimized for LFM2.5-Thinking
    const {
      temperature = 0.1, // Lower temp is recommended for reasoning
      topK = 50,
      topP = 0.1,
    } = options;

    let prompt = this.buildChatMLPrompt(userMessage, conversationHistory);

    const result = await this.context.completion({
      prompt,
      temperature,
      top_k: topK,
      top_p: topP,
      // REMOVED '\n\n' to prevent premature cutoff
      stop: ['<|im_end|>', '<|im_start|>', 'user:', 'assistant:'],
    });
    console.log('Raw AI response:', result);

    // Use the cleaning logic to strip <think> tags
    const cleanedText = this.cleanResponse(result.text);

    const suggestions = this.extractSuggestions(cleanedText);
    const finalText = this.removeSuggestions(cleanedText);

    return {
      text: finalText,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }
  
  /**
   * Helper to build ChatML prompt consistently
   */
  private buildChatMLPrompt(userMessage: string, conversationHistory: Message[]): string {
    let prompt = `<|im_start|>system\n${this.systemPrompt}<|im_end|>\n`;
    const recentMessages = conversationHistory.slice(-6);
    
    recentMessages.forEach(msg => {
      const role = msg.sender === 'user' ? 'user' : 'assistant';
      prompt += `<|im_start|>${role}\n${msg.content}<|im_end|>\n`;
    });
    
    prompt += `<|im_start|>user\n${userMessage}<|im_end|>\n`;
    prompt += `<|im_start|>assistant\n`;
    return prompt;
  }

  /**
   * Clean response - specifically targets LFM's <think> tags
   */
  private cleanResponse(text: string): string {
    if (!text) return '';
    
    // 1. Remove <think>...</think> blocks including all internal content
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // 2. Remove any unclosed <think> tag at the end (common if maxTokens hit)
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');

    // 3. Remove ChatML artifacts
    cleaned = cleaned.replace(/<\|im_end\|>/g, '');
    cleaned = cleaned.replace(/<\|im_start\|>/g, '');
    
    // 4. Clean up excessive whitespace from removal
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  }

  /**
   * Background analysis for extracting structured data (Slow Path)
   */
  async analyzeConversation(messages: Message[]): Promise<string> {
    if (!this.context || !this.isInitialized) {
      throw new Error('LLM not initialized. Call initialize() first.');
    }

    const conversationText = messages
      .map(m => `${m.sender === 'user' ? 'User' : 'Vi'}: ${m.content}`)
      .join('\n');

    const analysisPrompt = `You are analyzing a conversation to extract structured information.

Conversation:
${conversationText}

Extract the following and respond ONLY with valid JSON:
1. Important information to save as notes
2. Tasks or items to add to lists (specify list name: groceries, todo, movies, etc.)
3. Goals that were mentioned as completed
4. New facts about the user (personality, values, preferences)

JSON format:
{
  "notes": [{"title": "Short title", "body": "Full content"}],
  "listItems": [{"listName": "groceries", "items": ["item1", "item2"]}],
  "completedGoals": [{"title": "Goal name"}],
  "mindmapNodes": [{"label": "User fact", "category": "values|goals|personality|facts", "confidence": 0.8}]
}

If nothing to extract, return empty arrays. Respond with JSON only:`;

    const result = await this.context.completion({
      prompt: analysisPrompt,
      n_predict: 1024,
      temperature: 0.3, // Lower temp for more consistent JSON
      top_k: 40,
      stop: ['\n\n\n'],
    });

    return result.text.trim();
  }

  /**
   * Extract suggestion chips from response text
   * Pattern: [Option1] [Option2] at the end
   */
  private extractSuggestions(text: string): string[] {
    const suggestionPattern = /\[([^\]]+)\]/g;
    const matches = text.match(suggestionPattern);
    
    if (!matches) return [];
    
    // Only extract if they appear at the end of the message
    const lastLine = text.split('\n').pop() || '';
    const endMatches = lastLine.match(suggestionPattern);
    
    if (!endMatches) return [];
    
    return endMatches.map(match => match.slice(1, -1));
  }

  /**
   * Remove suggestion chips from response text
   */
  private removeSuggestions(text: string): string {
    // Remove [Chips] from the end of the text
    return text.replace(/\s*\[([^\]]+)\](?:\s*\[([^\]]+)\])*\s*$/, '').trim();
  }

  /**
   * Update system prompt (when user changes personality traits)
   */
  updateSystemPrompt(newSystemPrompt: string): void {
    this.systemPrompt = newSystemPrompt;
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.context !== null;
  }

  /**
   * Get model file path
   */
  getModelPath(): string {
    return this.modelPath;
  }

  /**
   * Release resources (call when app is backgrounded)
   */
  async release(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance
export const llmService = new LLMService();

// Model configurations
export const MODEL_CONFIGS = {
  LFM_THINKING: {
    modelUrl: 'https://huggingface.co/NexaAI/LFM2.5-1.2B-thinking-GGUF/resolve/main/LFM2.5-1.2B-Thinking-Q4_K_M.gguf',
    modelName: 'lfm_thinking_v1.gguf',
    size: '700MB',
    description: 'Fast & efficient, thinking mode',
  },
    LFM_INSTRUCT: {
    modelUrl: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/main/LFM2.5-1.2B-Instruct-Q4_K_M.gguf',
    modelName: 'lfm_instruct_v1.gguf',
    size: '700MB',
    description: 'Fast & efficient, instruct mode',
  },
  LLAMA_3_2_3B: {
    modelUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    modelName: 'llama_3_2_3b.gguf',
    size: '1.9GB',
    description: 'Better personality, multilingual',
  },
  PHI_3_MINI: {
    modelUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    modelName: 'phi_3_mini.gguf',
    size: '2.3GB',
    description: 'Concise, great instruction following',
  },
} as const;