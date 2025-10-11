# 📍 How to Find Your Firebase Configuration

## Method 1: Add New Web App (If First Time)

1. **In Firebase Console**: Click the **⚙️ Settings gear** > **Project settings**
2. **Scroll down** to "Your apps" section
3. **Click the Web icon** `</>` (if no web app exists)
4. **Register app**:
   - App nickname: `ExpenseTrackerApp`
   - ❌ Don't check "Firebase Hosting"
   - Click **Register app**
5. **Copy the config object** that appears

## Method 2: Get Existing Web App Config

1. **In Firebase Console**: Click **⚙️ Settings** > **Project settings**
2. **Scroll down** to "Your apps" section
3. **Find your web app** (or any app with `</>` icon)
4. **Click on the app name**
5. **Scroll down** to "SDK setup and configuration"
6. **Select "Config"** radio button
7. **Copy the firebaseConfig object**

## Method 3: General Tab

1. **In Firebase Console**: Click **⚙️ Settings** > **General**
2. **Scroll down** to "Your apps"
3. **Click on your web app**
4. **In "Firebase SDK snippet"** section
5. **Choose "Config"**
6. **Copy the configuration**

## 📋 What You'll Get

Your config will look exactly like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-12345.firebaseapp.com",
  projectId: "your-project-12345",
  storageBucket: "your-project-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};
```

## ✅ After Getting Config

1. **Copy the entire firebaseConfig object**
2. **Open**: `src/services/firebase.ts` in your project
3. **Replace the demo values** with your real values
4. **Save the file**

## 🎯 Quick Visual Guide

```
Firebase Console → ⚙️ Settings → Project Settings → Scroll Down → Your Apps → Web App → Config
```

## 💡 Can't Find Web App?

If you don't see a web app in "Your apps":
1. **Click the `</>` icon** to add a web app
2. **Give it a name**: ExpenseTrackerApp  
3. **Don't enable hosting**
4. **Register and get your config**

Need help with any of these steps? Let me know! 🚀