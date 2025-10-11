# Android Studio Emulator Setup - Step by Step

## You've Downloaded Android Studio ✅

Now let's create an emulator for testing your multi-device sync!

---

## Step 1: Open Device Manager

1. **Launch Android Studio**
2. On the welcome screen, click:
   - **More Actions** (three vertical dots)
   - Select **"Virtual Device Manager"** or **"Device Manager"**

   OR if you have a project open:
   - Go to **Tools → Device Manager**

---

## Step 2: Create Virtual Device

1. **Click "Create Device" button** (big + icon or "Create Virtual Device")

2. **Select Hardware**
   - Category: **Phone**
   - Choose: **Pixel 5** (recommended) or **Pixel 6**
   - Click **Next**

3. **Select System Image** (Android Version)
   - Click the **"Recommended"** tab
   - Look for:
     - **Tiramisu** (API 33, Android 13) ← Best choice
     - OR **UpsideDownCake** (API 34, Android 14)
   
   - If you see "Download" next to it:
     - Click **Download**
     - Wait for download (500MB-1GB)
     - Accept license
     - Wait for installation
   
   - Once installed, select it
   - Click **Next**

4. **Verify Configuration**
   - AVD Name: Leave default (e.g., "Pixel 5 API 33")
   - Startup orientation: Portrait
   - Click **Show Advanced Settings** (optional, for performance):
     - RAM: 2048 MB (or 4096 if you have 16GB+ RAM)
     - Internal Storage: 2048 MB
     - SD Card: Can leave blank
   
   - Click **Finish**

---

## Step 3: Launch Your Emulator

1. In **Device Manager**, find your new device
2. Click the **▶️ Play button** (triangle icon)
3. **Wait 30-60 seconds** for emulator to boot up
4. You should see an Android phone screen appear!

---

## Step 4: Install Expo Go on Emulator

### Method A: Automatic (Easiest)

1. Make sure your emulator is running
2. In your project terminal (VS Code), run:
   ```bash
   npx expo start
   ```
3. Press **'a'** for Android
4. Expo will automatically:
   - Detect the emulator
   - Install Expo Go
   - Open your app

### Method B: Manual (If Method A doesn't work)

1. **Open Play Store** in the emulator
2. **Search** for "Expo Go"
3. **Install** Expo Go
4. Once installed, in your terminal:
   ```bash
   npx expo start
   ```
5. Scan the QR code with Expo Go in the emulator

---

## Step 5: Test Your App!

Now you have 3 devices for testing:
- 📱 **Phone 1** (your first physical device)
- 📱 **Phone 2** (your second physical device)  
- 💻 **Emulator** (virtual device on your computer)

### Test Multi-Device Sync:

1. **Sign in with same account on all 3 devices**
2. **Enable Cloud Sync** on all 3 (Settings → Preferences)
3. **Create a book on Phone 1**
   - Wait 2-3 seconds
   - Check Phone 2 → Should appear
   - Check Emulator → Should appear
4. **Edit entry on Emulator**
   - Check phones → Should update

---

## Troubleshooting

### Issue 1: Emulator Won't Start
**Error**: "Intel HAXM is required to run this AVD"

**Solution**:
1. Open **BIOS** (restart computer, press F2/Del/F12 during boot)
2. Find **Virtualization** settings
   - Intel: Enable **Intel VT-x**
   - AMD: Enable **AMD-V** or **SVM Mode**
3. Save and exit BIOS
4. Try launching emulator again

### Issue 2: Emulator is Very Slow
**Solutions**:
- Close other heavy programs (Chrome, etc.)
- In Device Manager → Edit your device (pencil icon)
  - Show Advanced Settings
  - RAM: Increase to 4096 MB (if you have 16GB RAM)
  - Graphics: Change to "Hardware - GLES 2.0"

### Issue 3: "Expo Go not installed"
**Solution**:
```bash
# In your terminal
adb install <path-to-expo-go.apk>

# OR just press 'a' again, Expo will auto-install
```

### Issue 4: Can't Connect to Expo Server
**Error**: "Could not connect to development server"

**Solution**:
```bash
# Use tunnel mode
npx expo start --tunnel

# Then reload app in emulator
```

### Issue 5: Emulator Stuck on Boot Screen
**Solution**:
1. Close emulator
2. In Device Manager → Click ▼ dropdown next to Play
3. Select **"Cold Boot Now"** instead of regular start
4. Wait 1-2 minutes

---

## Quick Commands

```bash
# List all emulators
emulator -list-avds

# Start emulator from command line
emulator -avd Pixel_5_API_33

# Check connected devices
adb devices

# Install app on emulator
adb -e install app.apk

# Clear emulator data (if needed)
adb -e shell pm clear com.cocona.budgetapp
```

---

## Performance Tips

1. **Enable Hardware Acceleration**
   - Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK
   - SDK Tools tab → Check "Intel x86 Emulator Accelerator (HAXM)"
   - Install it

2. **Use Emulator Snapshots**
   - Device Manager → Edit device
   - Check "Store a snapshot for faster startup"
   - Saves emulator state, faster next time

3. **Disable Animations** (makes emulator feel faster)
   - In emulator: Settings → About Phone
   - Tap "Build Number" 7 times (enables Developer Options)
   - Settings → Developer Options
   - Window animation scale: 0.5x (or Off)
   - Transition animation scale: 0.5x (or Off)
   - Animator duration scale: 0.5x (or Off)

---

## Alternative: Run on Physical Device Without Emulator

If emulator is too slow or won't work:

1. **Enable Developer Options** on your phone:
   - Settings → About Phone → Tap "Build Number" 7 times
   
2. **Enable USB Debugging**:
   - Settings → Developer Options → USB Debugging (ON)

3. **Connect phone via USB**

4. **Run**:
   ```bash
   npx expo start
   # Press 'a' to install on connected phone
   ```

---

## What's Next?

Once emulator is running with Expo Go:

1. ✅ You'll have 3 devices for testing
2. ✅ Test real-time sync between all 3
3. ✅ Test conflict resolution
4. ✅ Test offline/online scenarios

**Your multi-device sync system is ready to test!** 🎉
