// services/SystemPromptBuilder.ts

export type PersonalityTrait = 
  | 'nonchalant' 
  | 'enthusiastic' 
  | 'pessimist'
  | 'quirky' 
  | 'direct' 
  | 'empathetic'
  | 'formal' 
  | 'witty' 
  | 'stoic';

interface UserContext {
  name: string;
  nickname?: string;
  role?: string;
  traits: PersonalityTrait[];
}

const TRAIT_DESCRIPTIONS: Record<PersonalityTrait, string> = {
nonchalant: "unbothered, casual, chill",
  enthusiastic: "energetic, eager, expressive",
  pessimist: "skeptical, cautious, realistic",
  quirky: "offbeat, unusual, unexpected",
  direct: "blunt, concise, honest",
  empathetic: "supportive, caring, validating",
  formal: "professional, structured, polite",
  witty: "clever, funny, sharp",
  stoic: "calm, logical, brief",
};

const BASE_PERSONALITY = `You are Vi, an on-device personal AI. You are private and helpful.

STRICT RESPONSE RULES:
1. BREVITY: Keep responses short and impactful.
2. ACKNOWLEDGE: Always reflect the user's message first using your traits.
3. PERSONALITY: Never break character. Let your assigned traits drive your tone.
4. CURIOSITY: Mostly end with a brief follow-up question.
5. NO HALLUCINATION: Only use facts explicitly shared by the user.`;

export function buildSystemPrompt(userContext: UserContext): string {
  const { name, nickname, role, traits } = userContext;
  const displayName = nickname || name;
  
  let prompt = BASE_PERSONALITY;
  
  // User context
  prompt += `\n\nUser: ${displayName}`;
  if (role) prompt += ` (${role})`;
  
  // Assignment of personality traits using your requested format
  if (traits.length > 0) {
    const traitList = traits.join(', ');
    prompt += `\n\nYour personality traits are: ${traitList}.`;
  }

  return prompt;
}

// Function to parse AI responses for structured actions
export interface AIAction {
  type: 'list_add' | 'note_create' | 'goal_update' | 'mindmap_add' | 'suggestion';
  data: any;
}

export function parseAIResponse(response: string): { cleanText: string; actions: AIAction[] } {
  const actions: AIAction[] = [];
  let cleanText = response;

  // Check for suggestion chips pattern (for UI rendering)
  const suggestionMatch = response.match(/\[([^\]]+)\](?:\s*\[([^\]]+)\])*$/);
  if (suggestionMatch) {
    const suggestions = response.match(/\[([^\]]+)\]/g)?.map(s => s.slice(1, -1)) || [];
    if (suggestions.length > 0) {
      actions.push({
        type: 'suggestion',
        data: { options: suggestions }
      });
      cleanText = response.replace(/\[([^\]]+)\](?:\s*\[([^\]]+)\])*$/, '').trim();
    }
  }

  return { cleanText, actions };
}