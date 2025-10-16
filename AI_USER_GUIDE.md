# 🚀 AI Transaction Automation - User Guide

## Welcome to AI-Powered Expense Tracking! 🤖

Your budget app just got smarter. The AI Transaction feature automatically categorizes your expenses, predicts which book they belong to, and saves you time.

---

## 🎯 What Does It Do?

The AI analyzes your transactions and predicts:
- ✅ **Which Book** (Personal, Business, Shared, etc.)
- ✅ **Which Category** (Food, Shopping, Transport, etc.)
- ✅ **Payment Mode** (UPI, Card, Cash, etc.)
- ✅ **Confidence Score** (How sure the AI is)

You review predictions and approve/edit/reject them. Over time, the AI learns your preferences and gets better!

---

## 🎬 Quick Start (3 Easy Steps)

### Step 1: Add a Transaction
1. Open the app
2. Tap the **"AI"** tab at the bottom (sparkle ✨ icon)
3. Tap the **"Add Manually"** button (bottom-right)
4. Enter:
   - **Amount**: e.g., ₹1,299
   - **Description**: e.g., "Amazon Order" or "Swiggy Delivery"
5. Tap **"Add Transaction"**

### Step 2: Review AI Prediction
The AI analyzes your transaction and shows:
```
🟢 85% Confidence
₹1,299.00 • Amazon
📘 Personal → Shopping
💳 UPI • Today 2:30 PM
```

### Step 3: Approve or Edit
- **Approve**: Tap green "Approve" button → Entry created!
- **Edit**: Tap "Edit" → Fix anything → Tap "Approve"
- **Reject**: Tap "Reject" → Transaction discarded

**That's it!** The AI learns from your choice and improves next time.

---

## 📱 Screen Overview

### Top Section: Statistics
```
┌────────────────────────────────┐
│ Pending: 5  Avg: 82%  Acc: 95% │
└────────────────────────────────┘
```
- **Pending**: Transactions waiting for review
- **Avg**: Average AI confidence score
- **Acc**: Accuracy rate (how often you approve without editing)

### Filter Buttons
```
[All] [High] [Medium] [Low]
```
- **All**: Show all pending transactions
- **High**: 80-100% confidence (usually correct)
- **Medium**: 50-79% confidence (might need review)
- **Low**: < 50% confidence (probably needs editing)

### Transaction Cards
Each card shows:
```
┌─────────────────────────────┐
│ 🟢 85% Confidence           │ ← Confidence badge
│ ₹1,299.00 • Amazon          │ ← Amount & Merchant
│ 📘 Personal → Shopping      │ ← Book & Category
│ 💳 UPI • Today 2:30 PM      │ ← Payment & Date
│                             │
│ [Reject] [Edit] [✓ Approve] │ ← Actions
└─────────────────────────────┘
```

---

## 🎨 Understanding Confidence Scores

### 🟢 High Confidence (80-100%)
- **Meaning**: AI is very sure about this prediction
- **Action**: Usually safe to approve directly
- **Example**: "Swiggy" always goes to "Food & Dining"

### 🟡 Medium Confidence (50-79%)
- **Meaning**: AI has a good guess but not 100% sure
- **Action**: Quick review recommended
- **Example**: New merchant or unusual amount

### 🔴 Low Confidence (< 50%)
- **Meaning**: AI isn't sure, needs your help
- **Action**: Review and edit before approving
- **Example**: Very generic description like "Payment"

---

## 🧠 How AI Learns

The AI gets smarter every time you interact with it:

### 1. First Time (Cold Start)
```
You: Add "Amazon ₹1,299"
AI: Guesses "Personal → Shopping" (65% confidence)
You: Approve ✅
Result: AI remembers this pattern
```

### 2. Second Time (Learning)
```
You: Add "Amazon Prime ₹199"
AI: Predicts "Personal → Shopping" (85% confidence)
       ↑ Higher confidence because it learned!
You: Approve ✅
Result: Pattern reinforced
```

### 3. Third Time (Confident)
```
You: Add "Amazon Gift ₹500"
AI: Predicts "Personal → Shopping" (95% confidence)
       ↑ Very confident now!
       ↑ Could auto-approve if enabled
```

### What AI Learns From:
- ✅ **Merchant names**: "Swiggy" → Food, "Uber" → Transport
- ✅ **Amount patterns**: ₹15,000 → Rent, ₹50 → Snacks
- ✅ **Your corrections**: You change category → AI learns new mapping
- ✅ **Recent activity**: Books you use often get higher priority

---

## ✏️ Editing Predictions

### When to Edit?
- AI chose wrong book
- AI chose wrong category
- Description needs refinement
- Payment mode is incorrect

### How to Edit?
1. Tap **"Edit"** button on transaction card
2. Edit dialog opens with:
   - **Book selector**: Tap chips to choose different book
   - **Category selector**: Tap chips to choose different category
   - **Description field**: Type new description
3. Tap **"Approve"** to save
4. **AI learns from your correction!** 🧠

### Example Edit Flow:
```
Original Prediction:
  Book: Personal
  Category: Shopping
  
You Edit:
  Book: Business ← Changed
  Category: Office Supplies ← Changed
  
Next Time:
  AI: "Ah, this type of transaction belongs to Business!"
  Predicts: Business → Office Supplies (higher confidence)
```

---

## ❌ Rejecting Transactions

### When to Reject?
- Duplicate transaction
- Wrong transaction detected
- Not an expense you want to track
- Test transaction

### What Happens?
- Transaction is discarded (deleted)
- No entry is created
- Optional: Can be kept for learning (check settings)

### Pro Tip:
If you reject by mistake, you can't undo it. Better to:
1. Approve first
2. Delete the entry manually later if needed

---

## 📊 Tips for Better Predictions

### ✅ DO:
1. **Include merchant names** in descriptions
   - Good: "Amazon Order - Headphones"
   - Bad: "Online shopping"

2. **Be consistent** with naming
   - Use "Swiggy" not "swiggy food delivery order"

3. **Let AI learn** from a few transactions first
   - First 5-10 transactions might have lower confidence
   - By transaction 20+, accuracy should be 85%+

4. **Edit instead of reject** when possible
   - Edits teach the AI
   - Rejects don't provide learning signals

### ❌ DON'T:
1. Don't use vague descriptions
   - Bad: "Payment", "Transaction", "Shopping"

2. Don't change merchant names frequently
   - Bad: "Swiggy", "Swiggy Food", "Swiggy Delivery"
   - Good: Always use "Swiggy"

3. Don't expect perfection immediately
   - AI needs 5-10 examples to learn patterns

---

## 🔧 Advanced Features

### Filter by Confidence
Use filter buttons to:
- Review only **Low Confidence** transactions first
- Bulk approve **High Confidence** transactions
- Focus on **Medium** when you have time

### Pull to Refresh
Swipe down on the screen to:
- Reload transaction list
- Refresh statistics
- Check for new AI predictions

### Statistics Tracking
Monitor your AI performance:
- **Pending**: How many need review
- **Avg Confidence**: Overall AI accuracy
- **Accuracy Rate**: % of approvals without edits

---

## 🎓 Real-World Examples

### Example 1: Food Delivery
```
Input: ₹350, "Swiggy order lunch"
AI Predicts:
  Book: Personal (95%)
  Category: Food & Dining (92%)
  Payment: UPI (90%)
Action: Approve ✅
Result: Perfect match!
```

### Example 2: Rent Payment
```
Input: ₹15,000, "Monthly rent to landlord"
AI Predicts:
  Book: Personal (75%)
  Category: Bills & Utilities (70%)
  Payment: Bank Transfer (85%)
Action: Edit → Category to "Rent" → Approve
Result: AI learns rent pattern
```

### Example 3: Shopping
```
Input: ₹2,499, "Amazon electronics"
AI Predicts:
  Book: Personal (88%)
  Category: Shopping (85%)
  Payment: Card (65%)
Action: Edit → Payment to "UPI" → Approve
Result: AI learns you use UPI for Amazon
```

---

## 🔮 Coming Soon

### Future Features (In Development):
- 📱 **SMS Auto-Capture** (Android): Auto-detect bank transaction SMS
- 📄 **CSV Import**: Upload bank statements in bulk
- 🔁 **Bulk Actions**: Approve multiple transactions at once
- 🏃 **Auto-Approve**: Automatically approve high-confidence (95%+) transactions
- 📊 **AI Analytics**: Track AI performance over time
- 🔔 **Smart Notifications**: Get notified about new transactions

---

## ❓ FAQs

### Q: How accurate is the AI?
**A**: Starts at 50-70%, improves to 85-95% after 10-20 transactions as it learns your patterns.

### Q: Does AI data sync between devices?
**A**: Currently, AI learning is local-only (not synced). Syncing coming in future update.

### Q: Can I delete AI data?
**A**: Yes! Go to Settings → AI Settings → "Clear Learning Data"

### Q: What if AI predicts wrong every time?
**A**: Keep editing for 5-10 transactions. AI learns from corrections and will improve. If still wrong, check if:
- Descriptions are clear and consistent
- You have at least 2-3 books and 5+ categories
- Merchant names don't change

### Q: Is my data private?
**A**: Yes! All AI processing is **local** (on your device). No data sent to external servers.

### Q: Can I disable AI features?
**A**: Yes! Simply don't use the AI tab. All manual entry features still work normally.

### Q: How do I report issues?
**A**: Settings → About → "Send Feedback" or contact support

---

## 🎉 Pro Tips from Power Users

1. **Morning Review Routine**
   - Open AI tab first thing
   - Approve yesterday's transactions (takes 2-3 minutes)
   - Let AI handle the boring stuff

2. **Merchant Consistency**
   - Create "nicknames" for merchants
   - Always use same name (e.g., "Zomato" not "Zomato Food")
   - AI learns faster with consistent names

3. **Confidence Filtering**
   - Filter "Low" → Edit those first
   - Filter "High" → Bulk approve later
   - Filter "Medium" → Quick review when time

4. **Learning Phase**
   - First week: Expect 60-70% accuracy
   - Second week: Should be 75-85%
   - Third week+: Should be 85-95%
   - If not improving, check descriptions!

---

## 📞 Need Help?

- **In-App**: Settings → Help & Support
- **Email**: support@yourbudgetapp.com
- **Community**: Join our Discord/Telegram
- **Docs**: Full documentation at docs.yourbudgetapp.com

---

**Enjoy your AI-powered expense tracking!** 🚀✨

Remember: The more you use it, the smarter it gets. Give it a few transactions to learn, and soon you'll be approving entries in seconds!
