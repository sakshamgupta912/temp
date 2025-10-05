# Budget Management App

A React Native expense tracking application built with Expo, Firebase, and SQLite.

## Features

✅ **Completed MVP Features:**
- 📱 Cross-platform React Native app with TypeScript
- 🔐 Authentication system (Demo mode for testing)
- 📚 Book management (Create, view, delete expense books)
- 🗄️ Local SQLite database for offline storage
- 🧭 Navigation with React Navigation 6
- 🎨 Material Design UI with React Native Paper
- 📊 Dashboard with balance overview

🚧 **In Development:**
- 💰 Entry management (Add, edit, delete income/expenses)
- 📂 Categories and labels
- 📈 Reports and insights
- ☁️ Firebase cloud sync
- 🤖 AI-powered transaction categorization
- 📱 Google Drive backup

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI
- iOS Simulator or Android Studio (for device testing)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd ExpenseBudgetApp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Test the app:**
   - Scan QR code with Expo Go app on your phone, OR
   - Press 'a' for Android emulator, OR
   - Press 'i' for iOS simulator, OR
   - Press 'w' for web browser

### Demo Mode

The app includes a demo mode that allows you to test all features without creating an account:
- Click "Continue as Demo User" on the login screen
- All data is stored locally and persists between app sessions
- Perfect for exploring the app's functionality

## Project Structure

```
src/
├── contexts/          # React contexts (Auth, etc.)
├── models/           # TypeScript type definitions
├── navigation/       # React Navigation setup
├── screens/          # App screens
├── services/         # Database, Firebase, and API services
└── utils/           # Utility functions
```

## Core Architecture

- **Frontend:** React Native with Expo
- **Database:** SQLite for local storage
- **Cloud:** Firebase (Firestore + Storage + Auth)
- **UI Library:** React Native Paper
- **Navigation:** React Navigation 6
- **State Management:** React Context + Hooks

## Current Status

The app is in **Phase 1 (MVP)** with core book management functionality working. Users can:

1. Sign in with demo mode
2. View dashboard with total balance overview
3. Create new expense books
4. Browse existing books
5. Access settings and logout

## Next Steps

### Phase 2: Entry Management
- Complete Add Entry form with all fields
- Entry listing in Book Detail screen
- Edit and delete entry functionality
- Category selection and management

### Phase 3: Reports & Cloud Sync
- Visual charts and reports
- Firebase authentication integration
- Real-time cloud synchronization
- Data backup and restore

## Firebase Setup (Optional)

To enable cloud features, create a Firebase project and update `src/services/firebase.ts` with your configuration:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};
```

## Contributing

This is a demonstration project showcasing React Native best practices:
- TypeScript for type safety
- Modular architecture
- Offline-first approach
- Material Design principles
- Comprehensive error handling

## License

MIT License - feel free to use this code for learning and development!