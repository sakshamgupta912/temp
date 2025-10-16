# AI Transaction Automation Feature

## 📋 Overview

Automates transaction entry by capturing bank transactions (SMS, manual input, CSV) and using AI to predict the correct Book, Category, and description. Users review predictions in a dedicated interface.

## 🎯 Key Features

### 1. Transaction Capture

- **SMS Parsing** (Android): Auto-detect UPI/bank transaction messages
- **Manual Entry**: Quick form for manual transaction input
- **CSV Import**: Upload bank statements
- **Real-time Detection**: Background monitoring of transaction notifications

### 2. AI Prediction Engine

- **Book Classification**: Analyzes transaction patterns to suggest correct book
- **Category Matching**: Smart category detection based on merchant/description
- **Merchant Recognition**: Identifies known merchants from history
- **Confidence Scoring**: Shows prediction reliability (0-100%)
- **Learning System**: Improves from user corrections

### 3. Review Interface

- **Pending Transactions Queue**: List of unprocessed transactions
- **Swipeable Cards**: Approve (swipe right) or reject (swipe left)   
- **Quick Edit**: Modify predictions before approving
- **Bulk Actions**: Approve/reject multiple at once
- **Confidence Indicators**: Visual cues for prediction quality

### 4. Learning & Adaptation

- **Pattern Recognition**: Learns from approved/edited transactions
- **Merchant Database**: Builds local merchant → category mapping
- **Amount Patterns**: Recognizes recurring amounts (subscriptions, bills)
- **Time-based Patterns**: Learns transaction timing preferences

## 🏗️ Technical Architecture

### Data Model

```typescript
// Pending transaction awaiting review
interface PendingTransaction {
  id: string;
  userId: string;
  
  // Raw transaction data
  rawAmount: number;
  rawCurrency: string;
  rawDescription: string;
  transactionDate: Date;
  source: 'sms' | 'manual' | 'csv';
  
  // SMS metadata (if from SMS)
  smsBody?: string;
  smsSender?: string;
  smsTimestamp?: Date;
  
  // AI Predictions
  prediction: TransactionPrediction;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  reviewedAt?: Date;
  
  // If approved/edited, reference to created entry
  entryId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

interface TransactionPrediction {
  // Book prediction
  bookId: string;
  bookName: string;
  bookConfidence: number; // 0-100
  
  // Category prediction
  categoryId: string;
  categoryName: string;
  categoryConfidence: number;
  
  // Enhanced description
  suggestedDescription: string;
  detectedMerchant?: string;
  
  // Payment mode prediction
  paymentMode: PaymentMode;
  paymentModeConfidence: number;
  
  // Overall confidence
  overallConfidence: number;
  
  // Reasoning (for debugging/transparency)
  reasoning: {
    bookReason: string; // "Matched similar transaction from 2 weeks ago"
    categoryReason: string; // "Merchant 'Amazon' typically classified as Shopping"
    merchantReason?: string; // "Recognized from 15 previous transactions"
  };
}

// Learning data for improving predictions
interface AILearningData {
  id: string;
  userId: string;
  
  // Transaction pattern
  merchantPattern: string; // Normalized merchant name
  amountRange: { min: number; max: number };
  
  // Learned associations
  preferredBookId: string;
  preferredCategoryId: string;
  preferredPaymentMode: PaymentMode;
  
  // Confidence building
  matchCount: number; // How many times this pattern was confirmed
  lastMatchedAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### AI Service (`aiTransactionService.ts`)

**Core Functions:**

1. `parseTransaction(rawData)` - Extract structured data from SMS/CSV
2. `predictTransaction(transaction)` - Generate predictions
3. `approvePrediction(transactionId)` - Create entry from approved prediction
4. `rejectPrediction(transactionId)` - Discard prediction
5. `editAndApprove(transactionId, edits)` - Modify then approve
6. `learnFromCorrection(original, corrected)` - Update learning data

**Prediction Algorithm:**

```typescript
// Scoring system for book prediction
function predictBook(transaction, books, learningData) {
  const scores = books.map(book => {
    let score = 0;
  
    // 1. Merchant match (40 points)
    const merchantMatch = learningData.find(
      ld => ld.merchantPattern === normalizeMerchant(transaction.description) 
        && ld.preferredBookId === book.id
    );
    if (merchantMatch) {
      score += 40 * (merchantMatch.matchCount / (merchantMatch.matchCount + 5));
    }
  
    // 2. Amount pattern (30 points)
    const amountMatches = learningData.filter(
      ld => transaction.amount >= ld.amountRange.min 
        && transaction.amount <= ld.amountRange.max
        && ld.preferredBookId === book.id
    );
    if (amountMatches.length > 0) {
      score += 30 * (amountMatches.length / learningData.length);
    }
  
    // 3. Recent usage frequency (20 points)
    const recentTransactions = getRecentEntriesInBook(book.id, 30); // Last 30 days
    score += 20 * (recentTransactions.length / 100); // Cap at 100 transactions
  
    // 4. Currency match (10 points)
    if (book.currency === transaction.rawCurrency) {
      score += 10;
    }
  
    return { bookId: book.id, bookName: book.name, score };
  });
  
  // Return top prediction
  const topScore = Math.max(...scores.map(s => s.score));
  const prediction = scores.find(s => s.score === topScore);
  
  return {
    ...prediction,
    confidence: Math.min(topScore, 100)
  };
}
```

### SMS Parser (Android)

```typescript
// SMS parsing patterns for Indian banks
const SMS_PATTERNS = {
  UPI: /(?:received|sent|paid|debited|credited)\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/i,
  MERCHANT: /(?:to|from|at)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+using|\.)/i,
  DATE: /on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  AMOUNT: /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i,
};

function parseTransactionSMS(smsBody: string): ParsedTransaction | null {
  // Extract amount
  const amountMatch = smsBody.match(SMS_PATTERNS.AMOUNT);
  if (!amountMatch) return null;
  
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  
  // Extract merchant
  const merchantMatch = smsBody.match(SMS_PATTERNS.MERCHANT);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown';
  
  // Determine transaction type (debit/credit)
  const isDebit = /debited|paid|sent/i.test(smsBody);
  
  return {
    amount,
    merchant,
    type: isDebit ? 'debit' : 'credit',
    rawDescription: smsBody,
    currency: 'INR' // Default for Indian transactions
  };
}
```

## 🎨 UI/UX Flow

### Navigation Structure

```
Bottom Tab Bar:
├── Dashboard
├── Books
├── 🆕 AI Transactions (with badge for pending count)
├── Analytics
└── Settings
```

### AI Transactions Screen Layout

```
┌─────────────────────────────────────┐
│ AI Transactions          [⚙️ Settings] │
├─────────────────────────────────────┤
│ 📊 Pending: 12  Approved: 45        │
│ [All] [High Conf] [Low Conf] [Manual]│
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🟢 95% Confidence               │ │
│ │ ₹1,299.00 • Amazon              │ │
│ │ 📘 Personal → Shopping          │ │
│ │ 💳 UPI • Today 2:30 PM          │ │
│ │                                 │ │
│ │ [❌ Reject] [✏️ Edit] [✓ Approve] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🟡 72% Confidence               │ │
│ │ ₹15,000.00 • Landlord Payment   │ │
│ │ 📗 Shared → Bills & Utilities   │ │
│ │ 🏦 Bank Transfer • Yesterday    │ │
│ │                                 │ │
│ │ [❌ Reject] [✏️ Edit] [✓ Approve] │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Confidence Indicators

- 🟢 **80-100%**: High confidence (green)
- 🟡 **50-79%**: Medium confidence (yellow)
- 🔴 **0-49%**: Low confidence (red)

### Quick Actions

- **Swipe Right**: Auto-approve (if confidence > 80%)
- **Swipe Left**: Reject and archive
- **Tap Card**: Open edit dialog
- **Long Press**: View full transaction details

## 🔧 Settings & Preferences

### AI Transaction Settings

```typescript
interface AITransactionSettings {
  // Auto-processing
  autoApproveThreshold: number; // 0-100, default 95
  autoApproveEnabled: boolean; // default false
  
  // SMS monitoring (Android)
  smsMonitoringEnabled: boolean; // default false
  allowedSmsSenders: string[]; // Whitelist of bank codes
  
  // Notifications
  notifyOnNewTransaction: boolean; // default true
  notifyOnAutoApprove: boolean; // default true
  
  // Learning
  learningEnabled: boolean; // default true
  retainRejectedTransactions: boolean; // default false (for privacy)
  
  // Data privacy
  storeSmsContent: boolean; // default false
  anonymizeMerchantNames: boolean; // default false
}
```

## 📱 Implementation Phases

### Phase 1: Core Infrastructure (This PR)

- ✅ Data models (types.ts)
- ✅ AI service structure
- ✅ Database schema updates
- ✅ Navigation integration

### Phase 2: Basic UI

- AI Transactions screen
- Transaction card component
- Approve/reject/edit actions
- Basic SMS parser

### Phase 3: AI Engine

- Prediction algorithm
- Learning system
- Merchant recognition
- Confidence scoring

### Phase 4: Advanced Features

- SMS auto-capture (Android)
- CSV import
- Bulk operations
- Auto-approve with threshold

### Phase 5: Polish

- Animations
- Settings page
- Analytics integration
- Performance optimization

## 🔒 Privacy & Security

1. **SMS Permissions**: Only requested when user enables SMS monitoring
2. **Data Storage**: SMS content optional (can be discarded after parsing)
3. **Local Processing**: All AI runs on-device (no external API calls)
4. **User Control**: Can disable learning/monitoring anytime
5. **Data Retention**: Configurable retention for rejected transactions

## 📊 Success Metrics

- **Time Saved**: Measure entry creation time (manual vs AI-assisted)
- **Accuracy**: Track approval rate without edits
- **Adoption**: % of users who enable feature
- **Learning Curve**: How quickly predictions improve per user
- **User Satisfaction**: In-app rating after using feature

## 🚀 Future Enhancements

1. **Bank API Integration**: Direct integration with bank APIs (when available)
2. **Receipt OCR**: Scan receipt photos to extract transaction details
3. **Recurring Detection**: Auto-detect subscriptions and recurring bills
4. **Split Transactions**: AI suggests split entries for complex transactions
5. **Budget Alerts**: Warn before approving if over budget
6. **Export Integration**: One-tap export to tax software

---

**Status**: 🚧 In Development
**Target Release**: Phase 1 completion by end of sprint
**Owner**: Development Team
