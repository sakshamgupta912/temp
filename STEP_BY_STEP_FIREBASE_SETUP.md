# 🔥 Firebase Setup Guide for Expo Project

## Step 1: Create Firebase Project

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Create a new project** (or select existing one)
   - Project name: `ExpenseBudgetApp` (or your preferred name)
   - Enable Google Analytics (recommended)
   - Choose your country/region

## Step 2: Add Web App to Firebase Project

1. **In your Firebase project dashboard**, click the **Web icon** `</>`
2. **Register your app**:
   - App nickname: `ExpenseBudgetApp-Web`
   - Check "Also set up Firebase Hosting" (optional)
   - Click **Register app**

3. **Copy the Firebase configuration**:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key-here",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "your-app-id"
   };
   ```

## Step 3: Enable Firebase Services

### Enable Authentication
1. Go to **Authentication** in the left sidebar
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Google** provider:
   - Click on Google
   - Toggle **Enable**
   - Set project support email
   - Click **Save**

### Enable Firestore Database
1. Go to **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in test mode** (we'll set up security rules later)
4. Select your preferred location (choose closest to your users)
5. Click **Done**

### Enable Storage (for file backups)
1. Go to **Storage** in the left sidebar
2. Click **Get started**
3. Choose **Start in test mode**
4. Select same location as Firestore
5. Click **Done**

## Step 4: Set up Google OAuth (for Google Sign-In)

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your Firebase project** (same project ID)
3. **Enable APIs**:
   - Go to **APIs & Services** > **Library**
   - Search for "Google+ API" and enable it
   - Search for "People API" and enable it

4. **Create OAuth 2.0 Credentials**:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth 2.0 Client IDs**
   
   **For Web application**:
   - Application type: Web application
   - Name: ExpenseBudgetApp-Web
   - Authorized redirect URIs: `https://auth.expo.io/@your-username/your-app-slug`
   
   **For Android** (if building for Android):
   - Application type: Android
   - Package name: Your app's package name
   - SHA-1 certificate fingerprint: Get from Expo

## Step 5: Update Your Project Configuration

After getting your Firebase config, you need to:

1. **Update `src/services/firebase.ts`** with your actual config
2. **Add your OAuth client ID** to the Google auth service
3. **Test the connection**

## Step 6: Firestore Security Rules

Once everything is working, update your Firestore rules for security:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Books and entries are user-specific
    match /books/{bookId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    match /entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## Next Steps

After completing the Firebase Console setup:
1. Copy your Firebase configuration
2. I'll help you update the project files
3. We'll test the Google Sign-In integration
4. Set up data synchronization

---

📝 **Keep your Firebase configuration secure and never commit it to public repositories!**