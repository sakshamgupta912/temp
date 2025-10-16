// LLM-Enhanced Transaction Classification
// Optional upgrade to keyword-based AI - uses free LLM APIs
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/genai';
import {
  Book,
  Category,
  Entry,
  TransactionPrediction,
} from '../models/types';
import asyncStorageService from './asyncStorage';

// Supported LLM providers
export type LLMProvider = 'gemini' | 'none';

interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string; // Required for gemini/openrouter
  model?: string; // e.g., "gemini-2.0-flash-001" or "mistralai/mistral-7b-instruct:free"
  endpoint?: string; // For ollama or custom endpoints
  enabled: boolean;
}

interface LLMPrediction {
  bookId: string;
  bookName: string;
  categoryId: string;
  categoryName: string;
  paymentMode?: string;
  reasoning: string;
  confidence: number;
}

class LLMTransactionService {
  private config: LLMConfig = {
    provider: 'none',
    enabled: false,
  };
  private genAI: GoogleGenAI | null = null;

  /**
   * Initialize LLM service with user's API key
   */
  async initialize(config: LLMConfig): Promise<void> {
    this.config = config;
    
    // Validate configuration
    if (config.enabled) {
      if (config.provider === 'gemini') {
        if (!config.apiKey) {
          throw new Error('Gemini API key is required. Get free key from https://makersuite.google.com/app/apikey');
        }
        this.genAI = new GoogleGenAI({ apiKey: config.apiKey });
      }
      
      console.log(`🤖 LLM Service initialized with provider: ${config.provider}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Predict transaction using LLM
   * Falls back to keyword-based AI if LLM is disabled or fails
   */
  async predictTransaction(
    transaction: {
      amount: number;
      description: string;
      merchant?: string;
      transactionType: 'debit' | 'credit';
    },
    books: Book[],
    categories: Category[],
    recentEntries: Entry[]
  ): Promise<LLMPrediction | null> {
    
    if (!this.config.enabled || this.config.provider === 'none') {
      return null; // Fall back to keyword-based AI
    }

    try {
      // Build context from user's transaction history
      const context = this.buildTransactionContext(books, categories, recentEntries);
      
      // Create prompt
      const prompt = this.buildPrompt(transaction, context);
      
      // Call LLM based on provider
      let response: string;
      switch (this.config.provider) {
        case 'gemini':
          response = await this.callGemini(prompt);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }

      // Parse LLM response
      const prediction = this.parseLLMResponse(response, books, categories);
      
      console.log('🤖 LLM Prediction:', {
        book: prediction.bookName,
        category: prediction.categoryName,
        confidence: prediction.confidence,
        reasoning: prediction.reasoning.substring(0, 50) + '...',
      });

      return prediction;

    } catch (error) {
      console.error('❌ LLM prediction failed:', error);
      return null; // Fall back to keyword-based AI
    }
  }

  /**
   * Build transaction context for LLM
   */
  private buildTransactionContext(
    books: Book[],
    categories: Category[],
    recentEntries: Entry[]
  ): string {
    let context = '';

    // Available books
    context += '## Available Books:\n';
    books.forEach((book, idx) => {
      context += `${idx + 1}. "${book.name}"`;
      if (book.description) {
        context += ` - ${book.description}`;
      }
      context += `\n`;
    });

    // Available categories
    context += '\n## Available Categories:\n';
    categories.forEach((cat, idx) => {
      context += `${idx + 1}. "${cat.name}"`;
      if (cat.description) {
        context += ` - ${cat.description}`;
      }
      context += `\n`;
    });

    // Recent transaction patterns (last 10)
    if (recentEntries.length > 0) {
      context += '\n## Recent Transaction Patterns:\n';
      const recent = recentEntries.slice(0, 10);
      recent.forEach(entry => {
        const book = books.find(b => b.id === entry.bookId);
        const category = categories.find(c => c.id === entry.category);
        context += `- ₹${entry.amount} at "${entry.party || 'Unknown'}" → Book: "${book?.name}", Category: "${category?.name}"\n`;
      });
    }

    return context;
  }

  /**
   * Build LLM prompt
   */
  private buildPrompt(
    transaction: {
      amount: number;
      description: string;
      merchant?: string;
      transactionType: 'debit' | 'credit';
    },
    context: string
  ): string {
    return `You are a financial transaction classifier for a personal expense tracking app.

${context}

## Task:
Analyze this transaction and classify it:
- **Amount**: ₹${transaction.amount}
- **Type**: ${transaction.transactionType === 'debit' ? 'Expense' : 'Income'}
- **Description**: ${transaction.description}
${transaction.merchant ? `- **Merchant**: ${transaction.merchant}` : ''}

## CRITICAL RULES:
1. You MUST choose ONLY from the books listed in "Available Books" section above
2. You MUST choose ONLY from the categories listed in "Available Categories" section above
3. DO NOT invent or create new book or category names
4. DO NOT use book or category names that are not explicitly listed above
5. If you cannot find a perfect match, choose the closest available option
6. Copy the book and category names EXACTLY as they appear in the lists above

## Instructions:
1. Choose the MOST appropriate Book from the "Available Books" list based on the transaction purpose
2. Choose the MOST appropriate Category from the "Available Categories" list based on what was purchased/earned
![1760592164677](image/llmTransactionService/1760592164677.png)3. Suggest a Payment Mode ONLY from these exact values: "cash", "upi", "card", "net_banking", "cheque", "other", or null if unknown
4. Provide a brief reasoning for your choices
5. Assign a confidence score (0-100)

## Valid Payment Modes (use EXACTLY as shown):
- "cash" - Cash payments
- "upi" - UPI/Digital wallets (GPay, PhonePe, Paytm, etc.)
- "card" - Credit/Debit card payments
- "net_banking" - Internet/Net banking
- "cheque" - Cheque payments
- "other" - Other payment methods
- null - Unknown/Not applicable

## Response Format (JSON only):
Respond with a JSON object matching this schema:
{
  "bookName": "Exact name from Available Books list",
  "categoryName": "Exact name from Available Categories list",
  "paymentMode": "cash" | "upi" | "card" | "net_banking" | "cheque" | "other" | null,
  "reasoning": "Brief explanation of why you chose this classification",
  "confidence": 85
}

Respond ONLY with valid JSON. No additional text.`;
  }

  /**
   * Call Google Gemini API using the official SDK
   */
  private async callGemini(prompt: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini AI not initialized. Call initialize() first.');
    }

    const modelName = this.config.model || 'gemini-2.0-flash-001';
    
    try {
      const response = await this.genAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      });
      
      if (!response.text) {
        throw new Error('Empty response from Gemini API');
      }
      
      return response.text;
    } catch (error) {
      // Add more specific error logging
      console.error('Error calling Gemini API with SDK:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse LLM JSON response with fuzzy matching fallback
   */
  private parseLLMResponse(
    response: string,
    books: Book[],
    categories: Category[]
  ): LLMPrediction {
    
    // Extract JSON from response (LLMs sometimes add extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Try exact match first, then fuzzy match for book
    let book = books.find(b => 
      b.name.toLowerCase() === parsed.bookName.toLowerCase()
    );
    
    if (!book) {
      // Fuzzy match: find book with similar name or containing keywords
      const fuzzyBook = this.findBestMatch(parsed.bookName, books, (b) => b.name);
      
      if (!fuzzyBook) {
        // Ultimate fallback: use first available book
        book = books[0];
        console.log(`⚠️ Book "${parsed.bookName}" not found, using fallback: "${book?.name}"`);
      } else {
        book = fuzzyBook;
        console.log(`🔍 Fuzzy matched book "${parsed.bookName}" → "${book.name}"`);
      }
    }

    if (!book) {
      throw new Error('No books available');
    }

    // Try exact match first, then fuzzy match for category
    let category = categories.find(c => 
      c.name.toLowerCase() === parsed.categoryName.toLowerCase()
    );
    
    if (!category) {
      // Fuzzy match: find category with similar name or containing keywords
      const fuzzyCategory = this.findBestMatch(parsed.categoryName, categories, (c) => c.name);
      
      if (!fuzzyCategory) {
        // Ultimate fallback: use first available category
        category = categories[0];
        console.log(`⚠️ Category "${parsed.categoryName}" not found, using fallback: "${category?.name}"`);
      } else {
        category = fuzzyCategory;
        console.log(`🔍 Fuzzy matched category "${parsed.categoryName}" → "${category.name}"`);
      }
    }

    if (!category) {
      throw new Error('No categories available');
    }

    // Validate and normalize payment mode to predefined values
    const validPaymentModes = ['cash', 'upi', 'card', 'net_banking', 'cheque', 'other'];
    let paymentMode: string | undefined = undefined;
    
    if (parsed.paymentMode) {
      const normalizedMode = parsed.paymentMode.toLowerCase().trim();
      
      // Try exact match first
      if (validPaymentModes.includes(normalizedMode)) {
        paymentMode = normalizedMode;
      } else {
        // Fuzzy match to valid payment modes
        const modeMap: { [key: string]: string } = {
          'netbanking': 'net_banking',
          'net banking': 'net_banking',
          'internet banking': 'net_banking',
          'debit card': 'card',
          'credit card': 'card',
          'debit': 'card',
          'credit': 'card',
          'check': 'cheque',
          'google pay': 'upi',
          'gpay': 'upi',
          'phonepe': 'upi',
          'paytm': 'upi',
          'bhim': 'upi',
        };
        
        paymentMode = modeMap[normalizedMode] || validPaymentModes.find(valid => 
          normalizedMode.includes(valid) || valid.includes(normalizedMode)
        );
        
        if (paymentMode) {
          console.log(`🔍 Normalized payment mode "${parsed.paymentMode}" → "${paymentMode}"`);
        } else {
          console.log(`⚠️ Invalid payment mode "${parsed.paymentMode}", defaulting to undefined`);
        }
      }
    }

    return {
      bookId: book.id,
      bookName: book.name,
      categoryId: category.id,
      categoryName: category.name,
      paymentMode,
      reasoning: parsed.reasoning || 'LLM classification (fuzzy matched)',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 80)),
    };
  }

  /**
   * Find best matching item using fuzzy string matching
   * Uses similarity scoring based on common words and partial matches
   */
  private findBestMatch<T>(
    query: string,
    items: T[],
    getName: (item: T) => string
  ): T | null {
    if (!items || items.length === 0) return null;
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    let bestMatch: T | null = null;
    let bestScore = 0;
    
    for (const item of items) {
      const name = getName(item).toLowerCase();
      const nameWords = name.split(/\s+/);
      
      let score = 0;
      
      // Exact match (highest priority)
      if (name === queryLower) {
        return item;
      }
      
      // Contains query as substring
      if (name.includes(queryLower)) {
        score += 50;
      }
      
      // Query contains name as substring
      if (queryLower.includes(name)) {
        score += 40;
      }
      
      // Count matching words
      for (const queryWord of queryWords) {
        for (const nameWord of nameWords) {
          if (queryWord === nameWord) {
            score += 20;
          } else if (nameWord.includes(queryWord) || queryWord.includes(nameWord)) {
            score += 10;
          }
        }
      }
      
      // Levenshtein distance (edit distance) bonus
      const distance = this.levenshteinDistance(queryLower, name);
      if (distance < 3) {
        score += (3 - distance) * 15;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
    
    // Only return match if score is significant (threshold: 20)
    return bestScore >= 20 ? bestMatch : null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * (minimum number of edits to transform one string into another)
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }

  /**
   * Get pricing/limits info for each provider
   */
  static getProviderInfo() {
    return {
      gemini: {
        name: 'Google Gemini',
        freeTier: true,
        limits: '15 requests/minute, 1M tokens/day',
        pricing: 'Free tier available',
        signupUrl: 'https://makersuite.google.com/app/apikey',
        recommended: true,
        pros: ['Free tier', 'Fast', 'Good quality'],
        cons: ['Requires Google account', 'Rate limited'],
      },
      none: {
        name: 'Keyword-based AI (Current)',
        freeTier: true,
        limits: 'No limits',
        pricing: 'Free',
        signupUrl: null,
        recommended: false,
        pros: ['No setup', 'Fast', 'Works offline', 'Privacy'],
        cons: ['Limited accuracy', 'No learning', 'Static rules'],
      },
    };
  }
}

export default new LLMTransactionService();
