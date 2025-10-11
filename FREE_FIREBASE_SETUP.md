# 🆓 FREE Firebase Setup for Expense Tracker

## Step 1: Create Free Firebase Project

1. **Go to**: https://console.firebase.google.com/
2. **Click**: "Create a project"
3. **Project name**: `expense-tracker-free` (or any name)
4. **Google Analytics**: Optional (can disable to keep it simple)
5. **Plan**: Stay on **Spark (Free)** - DO NOT upgrade!

## Step 2: Add Web App (Free)

1. **In project dashboard**, click **Web icon** `</>`
2. **App nickname**: `ExpenseTrackerApp`
3. **Firebase Hosting**: ❌ Uncheck this (not needed)
4. **Click**: "Register app"
5. **Copy the config** - you'll need this!

```javascript
// Your FREE Firebase config will look like:
const firebaseConfig = {
  apiKey: "your-free-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-free-project-id", 
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-free-app-id"
};
```

## Step 3: Enable FREE Services

### 🔐 Authentication (Free)
1. **Go to**: Authentication > Get started
2. **Sign-in method** tab
3. **Enable Google**: 
   - Toggle ON
   - Add support email
   - Save

### 🗄️ Firestore Database (Free)  
1. **Go to**: Firestore Database > Create database
2. **Start in test mode** (we'll secure it later)
3. **Location**: Choose closest to you
4. **Done**

## Step 4: Update Your Project

Replace the demo config in `src/services/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "paste-your-api-key-here",
  authDomain: "paste-your-auth-domain-here", 
  projectId: "paste-your-project-id-here",
  storageBucket: "paste-your-storage-bucket-here",
  messagingSenderId: "paste-your-sender-id-here",
  appId: "paste-your-app-id-here"
};
```

## 🚀 Free Tier Limits (More Than Enough!)

**For a personal expense tracker:**
- ✅ **Users**: Unlimited Google sign-ins
- ✅ **Data**: 1 GiB storage (= ~1 million expense entries!)
- ✅ **Reads**: 50,000/day (= checking data 50,000 times daily!)
- ✅ **Writes**: 20,000/day (= adding 20,000 expenses daily!)

**These limits are HUGE for personal use!** 📈

## ❌ What to AVOID (Paid Features)

- **App Hosting** - You don't need this
- **Cloud Functions** - Not required for your app  
- **Firebase Extensions** - Not needed
- **Performance Monitoring** - Optional paid feature
- **Crashlytics** - Optional (has free tier too)

## ✅ You're All Set!

Your expense tracker will work 100% on the free plan. The limits are very generous for personal apps.

**Need help with setup?** Just paste your Firebase config and I'll help you integrate it! 🚀