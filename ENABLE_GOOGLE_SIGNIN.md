# 🔥 Enable Google Sign-In - Step by Step

## Step 1: Enable Authentication in Firebase Console

🌐 **Go to**: https://console.firebase.google.com/project/cocona-472b7

### Enable Authentication:
1. Click **Authentication** in left sidebar
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Click **Google**
5. Toggle **Enable**
6. Set **Project support email** (your email)
7. Click **Save**

### Enable Firestore Database:
1. Click **Firestore Database** in left sidebar  
2. Click **Create database**
3. Choose **Start in test mode**
4. Select location (choose closest to you)
5. Click **Done**

## Step 2: Set up Google OAuth Credentials

🌐 **Go to**: https://console.cloud.google.com/apis/credentials?project=cocona-472b7

1. **Click**: "Create Credentials" → "OAuth 2.0 Client IDs"
2. **Application type**: Web application
3. **Name**: ExpenseTracker-Web
4. **Authorized redirect URIs**: Add your domain (for now, leave empty)
5. **Click**: Create
6. **Copy the Client ID** - you'll need this!

## Step 3: Update Your App

Once you complete Steps 1 & 2, I'll help you:
1. ✅ Connect the real Google Auth service
2. ✅ Replace placeholder implementations  
3. ✅ Test Google Sign-In functionality
4. ✅ Enable Firebase sync

## 🚀 Quick Test

Want to test if your Firebase project is ready? Let me know when you complete the console setup and I'll integrate the real authentication! 

**Current Status:**
- ✅ Firebase Config: Connected to cocona-472b7
- ✅ App Running: No errors
- 🔄 Waiting for: Firebase Console setup
- 🎯 Next: Real Google Sign-In implementation