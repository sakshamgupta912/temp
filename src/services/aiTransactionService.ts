// AI Transaction Service - Smart transaction prediction and automation
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PendingTransaction,
  TransactionPrediction,
  AILearningData,
  MerchantMapping,
  AITransactionSettings,
  TransactionSource,
  TransactionStatus,
  Book,
  Entry,
  Category,
  PaymentMode,
  ConfidenceScore,
} from '../models/types';
import asyncStorageService from './asyncStorage';
import llmTransactionService from './llmTransactionService';

// Storage keys
const PENDING_TRANSACTIONS_KEY = 'pending_transactions';
const AI_LEARNING_DATA_KEY = 'ai_learning_data';
const MERCHANT_MAPPINGS_KEY = 'merchant_mappings';
const AI_SETTINGS_KEY = 'ai_settings';

class AITransactionService {
  // ==================== TRANSACTION PARSING ====================

  /**
   * Parse raw transaction data from various sources
   */
  async parseTransaction(
    rawData: {
      amount: number;
      description: string;
      date?: Date;
      source: TransactionSource;
      smsBody?: string;
      smsSender?: string;
    },
    userId: string
  ): Promise<PendingTransaction> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Detect transaction type (debit/credit)
    const transactionType = this.detectTransactionType(rawData.description, rawData.smsBody);
    
    // Normalize merchant name
    const detectedMerchant = this.extractMerchant(rawData.description);
    
    // Generate AI prediction
    const prediction = await this.predictTransaction(
      {
        amount: rawData.amount,
        description: rawData.description,
        merchant: detectedMerchant,
        transactionType,
      },
      userId
    );

    const pendingTransaction: PendingTransaction = {
      id: transactionId,
      userId,
      rawAmount: rawData.amount,
      rawCurrency: 'INR', // TODO: Detect from source
      rawDescription: rawData.description,
      transactionDate: rawData.date || new Date(),
      transactionType,
      source: rawData.source,
      smsBody: rawData.smsBody,
      smsSender: rawData.smsSender,
      smsTimestamp: rawData.date,
      prediction,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to storage
    await this.savePendingTransaction(pendingTransaction);

    // Check if auto-approve threshold is met
    const settings = await this.getSettings(userId);
    if (
      settings.autoApproveEnabled &&
      prediction.overallConfidence.value >= settings.autoApproveThreshold
    ) {
      console.log(`🤖 Auto-approving transaction ${transactionId} (confidence: ${prediction.overallConfidence.value}%)`);
      await this.approveTransaction(transactionId, userId);
    }

    return pendingTransaction;
  }

  /**
   * Parse SMS transaction message (Indian banks)
   */
  parseSMS(smsBody: string, sender: string): {
    amount: number;
    description: string;
    date?: Date;
  } | null {
    // SMS patterns for Indian banks
    const patterns = {
      // UPI: "Rs 1,299.00 sent to Amazon via UPI"
      UPI: /(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s*(?:sent to|paid to|received from|debited|credited)\s+([^.]+)/i,
      
      // Card: "Rs 5,000 spent at Swiggy on 15/10/2025"
      CARD: /(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s*(?:spent at|charged at|paid at)\s+([^.]+)/i,
      
      // General debit: "Your a/c XXX1234 debited Rs 2,500 for Payment to XYZ"
      DEBIT: /debited?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)\s*(?:for|to|towards)?\s*([^.]+)/i,
      
      // General credit: "Rs 10,000 credited to a/c XXX1234 from Salary"
      CREDIT: /credited?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)\s*(?:to|from|towards)?\s*([^.]+)/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const match = smsBody.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        const description = match[2].trim();
        
        return {
          amount,
          description,
          date: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect if transaction is debit (expense) or credit (income)
   */
  private detectTransactionType(description: string, smsBody?: string): 'debit' | 'credit' {
    const text = `${description} ${smsBody || ''}`.toLowerCase();
    
    // Credit indicators
    if (/credited|received|refund|cashback|salary|income|deposit/i.test(text)) {
      return 'credit';
    }
    
    // Debit indicators (default)
    if (/debited|paid|sent|spent|charged|withdrawn|purchase/i.test(text)) {
      return 'debit';
    }
    
    // Default to debit (expenses are more common)
    return 'debit';
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchant(description: string): string {
    // Remove common prefixes/suffixes
    let merchant = description
      .replace(/^(payment to|paid to|at|from|to)\s+/i, '')
      .replace(/\s+(via upi|on \d+\/\d+|ref no\.\s*\w+).*$/i, '')
      .trim();

    // Clean up special characters but keep spaces
    merchant = merchant.replace(/[^a-z0-9\s]/gi, ' ').trim();
    
    // Limit length
    if (merchant.length > 50) {
      merchant = merchant.substring(0, 50);
    }

    return merchant || 'Unknown Merchant';
  }

  /**
   * Normalize merchant name for pattern matching
   */
  private normalizeMerchant(merchantName: string): string {
    return merchantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all special chars and spaces
      .trim();
  }

  // ==================== AI PREDICTION ====================

  /**
   * Generate AI prediction for a transaction
   */
  async predictTransaction(
    transaction: {
      amount: number;
      description: string;
      merchant?: string;
      transactionType: 'debit' | 'credit';
    },
    userId: string
  ): Promise<TransactionPrediction> {
    // Load user data
    const books = await asyncStorageService.getBooks(userId);
    const categories = await asyncStorageService.getCategories(userId);
    const learningData = await this.getLearningData(userId);
    const merchantMappings = await this.getMerchantMappings(userId);

    // Try LLM prediction first (if enabled)
    const recentEntries = await asyncStorageService.getEntries(books[0]?.id || ''); // Get some context
    const llmPrediction = await llmTransactionService.predictTransaction(
      transaction,
      books,
      categories,
      recentEntries.slice(0, 20) // Last 20 entries for context
    );

    let bookPrediction;
    let categoryPrediction;
    let paymentModePrediction;

    if (llmPrediction) {
      // Use LLM predictions
      console.log('🤖 Using LLM prediction');
      bookPrediction = {
        bookId: llmPrediction.bookId,
        bookName: llmPrediction.bookName,
        confidence: llmPrediction.confidence,
        reason: `LLM: ${llmPrediction.reasoning}`,
      };
      categoryPrediction = {
        categoryId: llmPrediction.categoryId,
        categoryName: llmPrediction.categoryName,
        confidence: llmPrediction.confidence,
        reason: `LLM: ${llmPrediction.reasoning}`,
      };
      paymentModePrediction = {
        mode: (llmPrediction.paymentMode || 'other') as PaymentMode,
        confidence: llmPrediction.confidence,
        reason: 'LLM suggested',
      };
    } else {
      // Fall back to keyword-based AI
      console.log('📊 Using keyword-based AI (LLM disabled or failed)');
      
      // Predict book
      bookPrediction = await this.predictBook(transaction, books, learningData, userId);
      
      // Predict category
      categoryPrediction = await this.predictCategory(
        transaction,
        categories,
        learningData,
        merchantMappings
      );
      
      // Predict payment mode
      paymentModePrediction = this.predictPaymentMode(transaction.description);
    }
    
    // Calculate overall confidence (weighted average)
    const overallConfidenceValue = Math.round(
      (bookPrediction.confidence * 0.4) +
      (categoryPrediction.confidence * 0.4) +
      (paymentModePrediction.confidence * 0.2)
    );

    const prediction: TransactionPrediction = {
      bookId: bookPrediction.bookId,
      bookName: bookPrediction.bookName,
      bookConfidence: this.toConfidenceScore(bookPrediction.confidence),
      
      categoryId: categoryPrediction.categoryId,
      categoryName: categoryPrediction.categoryName,
      categoryConfidence: this.toConfidenceScore(categoryPrediction.confidence),
      
      suggestedDescription: transaction.merchant || transaction.description,
      detectedMerchant: transaction.merchant,
      
      paymentMode: paymentModePrediction.mode,
      paymentModeConfidence: this.toConfidenceScore(paymentModePrediction.confidence),
      
      overallConfidence: this.toConfidenceScore(overallConfidenceValue),
      
      reasoning: {
        bookReason: bookPrediction.reason,
        categoryReason: categoryPrediction.reason,
        merchantReason: categoryPrediction.merchantReason,
        paymentModeReason: paymentModePrediction.reason,
      },
    };

    return prediction;
  }

  /**
   * Predict which book this transaction belongs to
   */
  private async predictBook(
    transaction: any,
    books: Book[],
    learningData: AILearningData[],
    userId: string
  ): Promise<{ bookId: string; bookName: string; confidence: number; reason: string }> {
    // Filter out deleted and archived books - AI should not classify into these
    const activeBooks = books.filter(b => !b.deleted && !b.archived);
    
    if (activeBooks.length === 0) {
      throw new Error('No active books available for prediction');
    }

    // If only one active book, return it with high confidence
    if (activeBooks.length === 1) {
      return {
        bookId: activeBooks[0].id,
        bookName: activeBooks[0].name,
        confidence: 95,
        reason: 'Only active book available',
      };
    }

    const merchantNormalized = this.normalizeMerchant(transaction.merchant || '');
    const transactionText = `${transaction.description} ${transaction.merchant || ''}`.toLowerCase();
    const scores: Array<{ book: Book; score: number; reasons: string[] }> = [];

    for (const book of activeBooks) {
      let score = 0;
      const reasons: string[] = [];

      // 1. SEMANTIC MATCH - Book description alignment (30 points max)
      // This ensures classification aligns with book purpose/description
      if (book.description) {
        const descriptionMatch = this.calculateSemanticSimilarity(
          transactionText,
          book.description.toLowerCase()
        );
        if (descriptionMatch > 0) {
          const semanticScore = descriptionMatch * 30;
          score += semanticScore;
          reasons.push(`Transaction aligns with book purpose: "${book.description}"`);
        }
      }

      // 2. Merchant/pattern match from learning data (30 points max)
      const merchantMatches = learningData.filter(
        ld => ld.merchantPattern === merchantNormalized && ld.preferredBookId === book.id
      );
      if (merchantMatches.length > 0) {
        const bestMatch = merchantMatches.reduce((best, curr) => 
          curr.accuracy > best.accuracy ? curr : best
        );
        const matchScore = Math.min(30, bestMatch.accuracy * 30);
        score += matchScore;
        reasons.push(`Merchant recognized from ${bestMatch.matchCount} previous transactions`);
      }

      // 3. Amount pattern match (20 points max)
      const amountMatches = learningData.filter(
        ld => transaction.amount >= ld.amountRange.min &&
              transaction.amount <= ld.amountRange.max &&
              ld.preferredBookId === book.id
      );
      if (amountMatches.length > 0) {
        const amountScore = Math.min(20, (amountMatches.length / Math.max(learningData.length, 1)) * 100);
        score += amountScore;
        reasons.push(`Similar amount range seen ${amountMatches.length} times`);
      }

      // 4. Recent activity (15 points max)
      const recentEntries = await asyncStorageService.getEntries(book.id);
      const last30Days = recentEntries.filter(e => {
        const daysDiff = (Date.now() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      });
      if (last30Days.length > 0) {
        const activityScore = Math.min(15, (last30Days.length / 100) * 15);
        score += activityScore;
        reasons.push(`${last30Days.length} transactions in last 30 days`);
      }

      // 5. Currency match (5 points)
      if (book.currency === 'INR') { // Assuming Indian transactions
        score += 5;
        reasons.push('Currency matches');
      }

      scores.push({ book, score, reasons });
    }

    // Get best match
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    // Default to most recently used active book if no good match
    if (best.score < 20) {
      const recentBook = activeBooks.reduce((latest, curr) => 
        new Date(curr.updatedAt) > new Date(latest.updatedAt) ? curr : latest
      );
      return {
        bookId: recentBook.id,
        bookName: recentBook.name,
        confidence: 50,
        reason: 'Most recently used active book (low confidence)',
      };
    }

    return {
      bookId: best.book.id,
      bookName: best.book.name,
      confidence: Math.min(100, best.score),
      reason: best.reasons[0] || 'Pattern match',
    };
  }

  /**
   * Predict category for transaction
   */
  private async predictCategory(
    transaction: any,
    categories: Category[],
    learningData: AILearningData[],
    merchantMappings: MerchantMapping[]
  ): Promise<{ categoryId: string; categoryName: string; confidence: number; reason: string; merchantReason?: string }> {
    const merchantNormalized = this.normalizeMerchant(transaction.merchant || '');
    const transactionText = `${transaction.description} ${transaction.merchant || ''}`.toLowerCase();
    
    // 1. Check merchant mappings first (highest confidence)
    const merchantMapping = merchantMappings.find(
      m => this.normalizeMerchant(m.merchantName) === merchantNormalized
    );
    if (merchantMapping) {
      const category = categories.find(c => c.id === merchantMapping.defaultCategoryId);
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: 90,
          reason: `Merchant "${merchantMapping.merchantName}" always uses this category`,
          merchantReason: `Recognized from ${merchantMapping.transactionCount} previous transactions`,
        };
      }
    }

    // 2. Check learning data patterns
    const learningMatches = learningData.filter(
      ld => ld.merchantPattern === merchantNormalized
    );
    if (learningMatches.length > 0) {
      const bestMatch = learningMatches.reduce((best, curr) =>
        curr.accuracy > best.accuracy ? curr : best
      );
      const category = categories.find(c => c.id === bestMatch.preferredCategoryId);
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: Math.round(bestMatch.accuracy * 100),
          reason: `Pattern matched from ${bestMatch.matchCount} similar transactions`,
        };
      }
    }

    // 3. SEMANTIC MATCH - Category description alignment (NEW!)
    // Score all categories based on how well transaction matches their description
    const semanticScores: Array<{ category: Category; score: number; reason: string }> = [];
    
    for (const category of categories) {
      let score = 0;
      
      // Check category description similarity
      if (category.description) {
        const descMatch = this.calculateSemanticSimilarity(
          transactionText,
          category.description.toLowerCase()
        );
        score += descMatch * 70; // 70 points max for description match
      }
      
      // Check category name similarity (fallback if no description)
      const nameMatch = this.calculateSemanticSimilarity(
        transactionText,
        category.name.toLowerCase()
      );
      score += nameMatch * 30; // 30 points max for name match
      
      if (score > 0) {
        semanticScores.push({
          category,
          score,
          reason: category.description 
            ? `Transaction matches category purpose: "${category.description}"`
            : `Transaction relates to "${category.name}"`,
        });
      }
    }
    
    // Return best semantic match if confidence is good
    if (semanticScores.length > 0) {
      semanticScores.sort((a, b) => b.score - a.score);
      const best = semanticScores[0];
      
      if (best.score >= 40) { // Threshold for semantic confidence
        return {
          categoryId: best.category.id,
          categoryName: best.category.name,
          confidence: Math.min(95, Math.round(best.score)),
          reason: best.reason,
        };
      }
    }

    // 4. Keyword-based category detection (legacy fallback)
    const keywordMatch = this.matchCategoryByKeywords(transaction.description, categories);
    if (keywordMatch) {
      return {
        categoryId: keywordMatch.id,
        categoryName: keywordMatch.name,
        confidence: 65,
        reason: 'Matched based on description keywords',
      };
    }

    // 5. Default to "Others" category
    const othersCategory = categories.find(c => c.name.toLowerCase() === 'others');
    if (othersCategory) {
      return {
        categoryId: othersCategory.id,
        categoryName: othersCategory.name,
        confidence: 40,
        reason: 'No clear pattern found, using default category',
      };
    }

    // Fallback to first category
    return {
      categoryId: categories[0].id,
      categoryName: categories[0].name,
      confidence: 30,
      reason: 'No pattern found, using fallback',
    };
  }

  /**
   * Match category based on description keywords
   */
  private matchCategoryByKeywords(description: string, categories: Category[]): Category | null {
    const desc = description.toLowerCase();
    
    // Keyword → Category mapping
    const keywordMap: { [key: string]: string[] } = {
      'food': ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'meal', 'dining'],
      'shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'store'],
      'transport': ['uber', 'ola', 'rapido', 'petrol', 'diesel', 'fuel', 'transport'],
      'entertainment': ['netflix', 'prime', 'hotstar', 'movie', 'cinema', 'entertainment'],
      'bills': ['electricity', 'water', 'gas', 'internet', 'mobile', 'recharge', 'bill'],
      'health': ['pharmacy', 'hospital', 'doctor', 'clinic', 'medicine', 'health'],
      'education': ['course', 'book', 'udemy', 'coursera', 'education', 'training'],
    };

    for (const [categoryName, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(kw => desc.includes(kw))) {
        const category = categories.find(c => c.name.toLowerCase().includes(categoryName));
        if (category) return category;
      }
    }

    return null;
  }

  /**
   * Predict payment mode
   */
  private predictPaymentMode(description: string): { mode: PaymentMode; confidence: number; reason: string } {
    const desc = description.toLowerCase();
    
    if (/upi|gpay|phonepe|paytm|bhim/.test(desc)) {
      return { mode: PaymentMode.UPI, confidence: 95, reason: 'UPI keyword detected' };
    }
    
    if (/card|credit|debit|visa|mastercard/.test(desc)) {
      return { mode: PaymentMode.CARD, confidence: 90, reason: 'Card keyword detected' };
    }
    
    if (/netbanking|neft|rtgs|imps/.test(desc)) {
      return { mode: PaymentMode.NET_BANKING, confidence: 85, reason: 'Net banking keyword detected' };
    }
    
    if (/cash|atm|withdraw/.test(desc)) {
      return { mode: PaymentMode.CASH, confidence: 80, reason: 'Cash keyword detected' };
    }
    
    if (/cheque|check/.test(desc)) {
      return { mode: PaymentMode.CHEQUE, confidence: 85, reason: 'Cheque keyword detected' };
    }
    
    // Default to UPI (most common in India)
    return { mode: PaymentMode.UPI, confidence: 50, reason: 'Default payment mode (no clear indicator)' };
  }

  /**
   * Calculate semantic similarity between transaction and description
   * Uses keyword overlap, contextual matching, and semantic synonyms
   * Returns score between 0 and 1
   */
  private calculateSemanticSimilarity(transactionText: string, targetText: string): number {
    // Normalize texts
    const transWords = this.extractKeywords(transactionText);
    const targetWords = this.extractKeywords(targetText);
    
    if (transWords.length === 0 || targetWords.length === 0) {
      return 0;
    }

    // Semantic synonym mapping for better matching
    const synonymGroups: Record<string, string[]> = {
      'food': ['eat', 'eating', 'meal', 'meals', 'dining', 'restaurant', 'restaurants', 'cafe', 'cafes', 'snack', 'snacks', 'breakfast', 'lunch', 'dinner', 'brunch', 'ice', 'cream', 'pizza', 'burger', 'sandwich', 'coffee', 'tea', 'swiggy', 'zomato', 'ubereats', 'foodpanda', 'doordash'],
      'grocery': ['groceries', 'supermarket', 'mart', 'store', 'vegetables', 'fruits', 'milk', 'bread', 'provisions', 'bigbasket', 'zepto', 'blinkit', 'instamart', 'dunzo'],
      'transport': ['travel', 'taxi', 'cab', 'uber', 'ola', 'lyft', 'bus', 'train', 'metro', 'flight', 'flights', 'airline', 'parking', 'toll', 'petrol', 'fuel', 'gas'],
      'entertainment': ['movie', 'movies', 'cinema', 'theatre', 'netflix', 'prime', 'hotstar', 'disney', 'spotify', 'youtube', 'gaming', 'games', 'concert', 'show', 'entertainment'],
      'shopping': ['shop', 'shopping', 'amazon', 'flipkart', 'myntra', 'ajio', 'clothing', 'clothes', 'shoes', 'fashion', 'apparel', 'store'],
      'health': ['medical', 'medicine', 'doctor', 'hospital', 'clinic', 'pharmacy', 'health', 'healthcare', 'fitness', 'gym', 'wellness'],
      'utilities': ['electricity', 'electric', 'power', 'water', 'gas', 'internet', 'broadband', 'wifi', 'mobile', 'phone', 'recharge', 'bill', 'bills'],
      'education': ['school', 'college', 'university', 'tuition', 'course', 'courses', 'books', 'educational', 'learning', 'training'],
    };

    // Build reverse lookup for synonyms
    const wordToGroups = new Map<string, string[]>();
    for (const [key, synonyms] of Object.entries(synonymGroups)) {
      for (const synonym of synonyms) {
        if (!wordToGroups.has(synonym)) {
          wordToGroups.set(synonym, []);
        }
        wordToGroups.get(synonym)!.push(key);
      }
      // Add the key itself
      if (!wordToGroups.has(key)) {
        wordToGroups.set(key, []);
      }
      wordToGroups.get(key)!.push(key);
    }

    // Calculate word overlap score
    let matchCount = 0;
    const matchedWords: string[] = [];
    
    for (const transWord of transWords) {
      for (const targetWord of targetWords) {
        // Exact match
        if (transWord === targetWord) {
          matchCount += 1.0;
          matchedWords.push(transWord);
          continue;
        }
        
        // Partial match (one word contains the other)
        if (transWord.length > 3 && targetWord.length > 3) {
          if (transWord.includes(targetWord) || targetWord.includes(transWord)) {
            matchCount += 0.7;
            matchedWords.push(transWord);
            continue;
          }
        }
        
        // Semantic synonym match (e.g., "ice cream" matches "food")
        const transGroups = wordToGroups.get(transWord) || [];
        const targetGroups = wordToGroups.get(targetWord) || [];
        
        // Check if both words belong to same semantic group
        for (const tGroup of transGroups) {
          if (targetGroups.includes(tGroup)) {
            matchCount += 0.8; // Strong semantic match
            matchedWords.push(transWord);
            break;
          }
        }
      }
    }
    
    // Calculate score based on coverage
    const transactionCoverage = matchCount / transWords.length;
    const targetCoverage = matchCount / targetWords.length;
    
    // Use harmonic mean for balanced scoring
    if (transactionCoverage + targetCoverage === 0) {
      return 0;
    }
    
    const harmonicMean = (2 * transactionCoverage * targetCoverage) / (transactionCoverage + targetCoverage);
    
    // Boost score if multiple keywords match
    const matchBoost = Math.min(0.2, matchedWords.length * 0.05);
    
    return Math.min(1.0, harmonicMean + matchBoost);
  }

  /**
   * Extract meaningful keywords from text
   * Removes stop words and common filler words
   */
  private extractKeywords(text: string): string[] {
    // Common stop words to ignore
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
      'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our',
      'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just',
      'don', 'now', 'via', 'using', 'paid', 'payment', 'transaction', 'order', 'purchase'
    ]);

    // Extract words, remove special characters, filter stop words
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Remove special chars
      .split(/\s+/) // Split on whitespace
      .filter(word => 
        word.length > 2 && // Minimum 3 characters
        !stopWords.has(word) && // Not a stop word
        !/^\d+$/.test(word) // Not a pure number
      );

    // Return unique keywords
    return [...new Set(words)];
  }

  /**
   * Convert numeric confidence to ConfidenceScore object
   */
  private toConfidenceScore(value: number): ConfidenceScore {
    let level: 'high' | 'medium' | 'low';
    if (value >= 80) level = 'high';
    else if (value >= 50) level = 'medium';
    else level = 'low';

    return { value, level };
  }

  // ==================== TRANSACTION MANAGEMENT ====================

  /**
   * Get all pending transactions for user
   */
  async getPendingTransactions(userId: string): Promise<PendingTransaction[]> {
    try {
      const data = await AsyncStorage.getItem(`${PENDING_TRANSACTIONS_KEY}_${userId}`);
      if (!data) return [];
      
      const transactions: PendingTransaction[] = JSON.parse(data);
      return transactions
        .filter(t => t.status === 'pending' && !t.deleted)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error loading pending transactions:', error);
      return [];
    }
  }

  /**
   * Approve a pending transaction (create entry)
   */
  async approveTransaction(transactionId: string, userId: string): Promise<Entry> {
    const transactions = await this.getAllTransactions(userId);
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new Error('Transaction already processed');
    }

    // Create entry from prediction
    const entry = await asyncStorageService.createEntry({
      bookId: transaction.prediction.bookId,
      amount: transaction.rawAmount,
      currency: transaction.rawCurrency,
      date: transaction.transactionDate,
      party: transaction.prediction.detectedMerchant,
      category: transaction.prediction.categoryId,
      paymentMode: transaction.prediction.paymentMode,
      remarks: `Auto-imported from ${transaction.source}`,
      userId,
    });

    // Update transaction status
    transaction.status = 'approved';
    transaction.reviewedAt = new Date();
    transaction.entryId = entry.id;
    transaction.updatedAt = new Date();
    
    await this.saveAllTransactions(transactions, userId);

    // Learn from this approval
    await this.learnFromApproval(transaction, userId);

    console.log(`✅ Approved transaction ${transactionId}, created entry ${entry.id}`);
    return entry;
  }

  /**
   * Reject a pending transaction
   */
  async rejectTransaction(transactionId: string, userId: string): Promise<void> {
    const transactions = await this.getAllTransactions(userId);
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = 'rejected';
    transaction.reviewedAt = new Date();
    transaction.updatedAt = new Date();
    
    const settings = await this.getSettings(userId);
    if (!settings.retainRejectedTransactions) {
      transaction.deleted = true;
      transaction.deletedAt = new Date();
    }
    
    await this.saveAllTransactions(transactions, userId);
    console.log(`❌ Rejected transaction ${transactionId}`);
  }

  /**
   * Edit and approve a transaction with corrections
   */
  async editAndApproveTransaction(
    transactionId: string,
    corrections: {
      bookId?: string;
      categoryId?: string;
      description?: string;
      paymentMode?: PaymentMode;
      amount?: number;
    },
    userId: string
  ): Promise<Entry> {
    const transactions = await this.getAllTransactions(userId);
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Apply corrections
    const bookId = corrections.bookId || transaction.prediction.bookId;
    const categoryId = corrections.categoryId || transaction.prediction.categoryId;
    const description = corrections.description || transaction.prediction.suggestedDescription;
    const paymentMode = corrections.paymentMode || transaction.prediction.paymentMode;
    const amount = corrections.amount || transaction.rawAmount;

    // Create entry with corrections
    const entry = await asyncStorageService.createEntry({
      bookId,
      amount,
      currency: transaction.rawCurrency,
      date: transaction.transactionDate,
      party: description,
      category: categoryId,
      paymentMode,
      remarks: `Edited from ${transaction.source} import`,
      userId,
    });

    // Update transaction
    transaction.status = 'edited';
    transaction.reviewedAt = new Date();
    transaction.entryId = entry.id;
    transaction.userCorrections = corrections;
    transaction.updatedAt = new Date();
    
    await this.saveAllTransactions(transactions, userId);

    // Learn from corrections
    await this.learnFromCorrection(transaction, corrections, userId);

    console.log(`✏️ Edited and approved transaction ${transactionId}`);
    return entry;
  }

  // ==================== LEARNING SYSTEM ====================

  /**
   * Learn from user approving a prediction
   */
  private async learnFromApproval(transaction: PendingTransaction, userId: string): Promise<void> {
    const settings = await this.getSettings(userId);
    if (!settings.learningEnabled) return;

    const merchantPattern = this.normalizeMerchant(transaction.prediction.detectedMerchant || '');
    if (!merchantPattern) return;

    // Update or create learning data
    const learningData = await this.getLearningData(userId);
    const existing = learningData.find(
      ld => ld.merchantPattern === merchantPattern &&
            ld.preferredBookId === transaction.prediction.bookId &&
            ld.preferredCategoryId === transaction.prediction.categoryId
    );

    if (existing) {
      // Update existing pattern
      existing.matchCount++;
      existing.accuracy = existing.matchCount / (existing.matchCount + existing.correctionCount);
      existing.lastMatchedAt = new Date();
      existing.updatedAt = new Date();
      
      // Update amount range
      existing.amountRange.min = Math.min(existing.amountRange.min, transaction.rawAmount);
      existing.amountRange.max = Math.max(existing.amountRange.max, transaction.rawAmount);
    } else {
      // Create new learning entry
      const newLearning: AILearningData = {
        id: `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        merchantPattern,
        descriptionKeywords: transaction.rawDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        amountRange: {
          min: transaction.rawAmount * 0.8,
          max: transaction.rawAmount * 1.2,
        },
        preferredBookId: transaction.prediction.bookId,
        preferredCategoryId: transaction.prediction.categoryId,
        preferredPaymentMode: transaction.prediction.paymentMode,
        matchCount: 1,
        correctionCount: 0,
        accuracy: 1.0,
        lastMatchedAt: new Date(),
        firstSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      learningData.push(newLearning);
    }

    await this.saveLearningData(learningData, userId);
    console.log(`🧠 Learning: Approved pattern for merchant "${merchantPattern}"`);
  }

  /**
   * Learn from user correcting a prediction
   */
  private async learnFromCorrection(
    transaction: PendingTransaction,
    corrections: any,
    userId: string
  ): Promise<void> {
    const settings = await this.getSettings(userId);
    if (!settings.learningEnabled) return;

    const merchantPattern = this.normalizeMerchant(transaction.prediction.detectedMerchant || '');
    if (!merchantPattern) return;

    const learningData = await this.getLearningData(userId);
    
    // Mark old pattern as incorrect
    const oldPattern = learningData.find(
      ld => ld.merchantPattern === merchantPattern &&
            ld.preferredBookId === transaction.prediction.bookId &&
            ld.preferredCategoryId === transaction.prediction.categoryId
    );
    if (oldPattern) {
      oldPattern.correctionCount++;
      oldPattern.accuracy = oldPattern.matchCount / (oldPattern.matchCount + oldPattern.correctionCount);
      oldPattern.updatedAt = new Date();
    }

    // Create/update correct pattern
    const correctBookId = corrections.bookId || transaction.prediction.bookId;
    const correctCategoryId = corrections.categoryId || transaction.prediction.categoryId;
    
    const correctPattern = learningData.find(
      ld => ld.merchantPattern === merchantPattern &&
            ld.preferredBookId === correctBookId &&
            ld.preferredCategoryId === correctCategoryId
    );

    if (correctPattern) {
      correctPattern.matchCount++;
      correctPattern.accuracy = correctPattern.matchCount / (correctPattern.matchCount + correctPattern.correctionCount);
      correctPattern.lastMatchedAt = new Date();
      correctPattern.updatedAt = new Date();
    } else {
      const newPattern: AILearningData = {
        id: `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        merchantPattern,
        descriptionKeywords: transaction.rawDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        amountRange: {
          min: transaction.rawAmount * 0.8,
          max: transaction.rawAmount * 1.2,
        },
        preferredBookId: correctBookId,
        preferredCategoryId: correctCategoryId,
        preferredPaymentMode: corrections.paymentMode || transaction.prediction.paymentMode,
        matchCount: 1,
        correctionCount: 0,
        accuracy: 1.0,
        lastMatchedAt: new Date(),
        firstSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      learningData.push(newPattern);
    }

    await this.saveLearningData(learningData, userId);
    console.log(`🧠 Learning: Corrected pattern for merchant "${merchantPattern}"`);
  }

  // ==================== STORAGE HELPERS ====================

  private async savePendingTransaction(transaction: PendingTransaction): Promise<void> {
    const userId = transaction.userId;
    const transactions = await this.getAllTransactions(userId);
    transactions.push(transaction);
    await this.saveAllTransactions(transactions, userId);
  }

  private async getAllTransactions(userId: string): Promise<PendingTransaction[]> {
    try {
      const data = await AsyncStorage.getItem(`${PENDING_TRANSACTIONS_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  }

  private async saveAllTransactions(transactions: PendingTransaction[], userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${PENDING_TRANSACTIONS_KEY}_${userId}`,
        JSON.stringify(transactions)
      );
    } catch (error) {
      console.error('Error saving transactions:', error);
      throw error;
    }
  }

  private async getLearningData(userId: string): Promise<AILearningData[]> {
    try {
      const data = await AsyncStorage.getItem(`${AI_LEARNING_DATA_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading learning data:', error);
      return [];
    }
  }

  private async saveLearningData(learningData: AILearningData[], userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${AI_LEARNING_DATA_KEY}_${userId}`,
        JSON.stringify(learningData)
      );
    } catch (error) {
      console.error('Error saving learning data:', error);
      throw error;
    }
  }

  private async getMerchantMappings(userId: string): Promise<MerchantMapping[]> {
    try {
      const data = await AsyncStorage.getItem(`${MERCHANT_MAPPINGS_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading merchant mappings:', error);
      return [];
    }
  }

  async getSettings(userId: string): Promise<AITransactionSettings> {
    try {
      const data = await AsyncStorage.getItem(`${AI_SETTINGS_KEY}_${userId}`);
      if (data) {
        return JSON.parse(data);
      }
      
      // Default settings
      return {
        userId,
        autoApproveEnabled: false,
        autoApproveThreshold: 95,
        smsMonitoringEnabled: false,
        allowedSmsSenders: [],
        notifyOnNewTransaction: true,
        notifyOnAutoApprove: true,
        notifyWeeklySummary: false,
        learningEnabled: true,
        retainRejectedTransactions: false,
        storeSmsContent: false,
        anonymizeMerchantNames: false,
        pendingTransactionRetentionDays: 30,
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error loading AI settings:', error);
      throw error;
    }
  }

  async updateSettings(userId: string, updates: Partial<AITransactionSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings(userId);
      const newSettings = {
        ...currentSettings,
        ...updates,
        userId,
        updatedAt: new Date(),
      };
      await AsyncStorage.setItem(`${AI_SETTINGS_KEY}_${userId}`, JSON.stringify(newSettings));
      console.log('✅ AI settings updated');
    } catch (error) {
      console.error('Error updating AI settings:', error);
      throw error;
    }
  }

  // ==================== STATISTICS ====================

  /**
   * Get AI performance statistics
   */
  async getStatistics(userId: string): Promise<{
    totalProcessed: number;
    autoApproved: number;
    manuallyApproved: number;
    edited: number;
    rejected: number;
    avgConfidence: number;
    accuracyRate: number;
  }> {
    const transactions = await this.getAllTransactions(userId);
    
    const processed = transactions.filter(t => t.status !== 'pending');
    const autoApproved = transactions.filter(t => 
      t.status === 'approved' && !t.userCorrections
    ).length;
    const manuallyApproved = transactions.filter(t => 
      t.status === 'approved' && t.userCorrections
    ).length;
    const edited = transactions.filter(t => t.status === 'edited').length;
    const rejected = transactions.filter(t => t.status === 'rejected').length;
    
    const avgConfidence = processed.length > 0
      ? processed.reduce((sum, t) => sum + t.prediction.overallConfidence.value, 0) / processed.length
      : 0;
    
    const accuracyRate = (autoApproved + manuallyApproved) / Math.max(processed.length, 1);

    return {
      totalProcessed: processed.length,
      autoApproved,
      manuallyApproved,
      edited,
      rejected,
      avgConfidence: Math.round(avgConfidence),
      accuracyRate: Math.round(accuracyRate * 100),
    };
  }
}

export default new AITransactionService();
