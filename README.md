# Factory Ledger

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8.x-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)
![Android](https://img.shields.io/badge/Android-Native-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore_%26_Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

<p align="center">
  <b>A state-of-the-art commercial dispatch, quality blending, and party ledger accounting system.</b><br>
  Engineered specifically for coal trading, factory logistics, and industrial procurement.
</p>

<p align="center">
  <sub>Offline-First • Real-Time Cloud Sync • Native Biometric Security • Apple iOS 18 HIG Interface</sub>
</p>

</div>

---

## Screenshots

<!-- Place your screenshots here! Replace the placeholders below with your images -->
<div align="center">
  <table>
    <tr>
      <td align="center" width="33%">
        <b>Security Lock Screen</b><br>
        <sub>5-digit PIN & Biometrics</sub><br><br>
        <i><!-- <img src="path/to/lockscreen.png" width="240" /> --></i>
      </td>
      <td align="center" width="33%">
        <b>New Dispatch & Profit</b><br>
        <sub>Live formulas & blending</sub><br><br>
        <i><!-- <img src="path/to/dispatch.png" width="240" /> --></i>
      </td>
      <td align="center" width="33%">
        <b>Settings & Cloud Sync</b><br>
        <sub>Multi-device Google Sync</sub><br><br>
        <i><!-- <img src="path/to/settings.png" width="240" /> --></i>
      </td>
    </tr>
  </table>
</div>

---

## Overview

**Factory Ledger** bridges the gap between field-level logistics and financial accounting. Traditional bookkeeping apps fail when dealing with commodities like coal, minerals, and bulk materials that require complex quality deductions (GCV formulas, moisture adjustments), truck axle weights (gross/tare/net), multi-source recipe blending, and live margin forecasts.

Factory Ledger provides an **all-in-one mobile and web powerhouse**: manage party debts, track dispatches, calculate truck profits in real-time, generate professional Excel sheets and PDF receipts, and synchronize safely across devices with enterprise security.

---

## Core Features

### Smart Logistics & Dispatch Tracking
- **Live Profit Engine:** Calculates real-time projected profit per truck based on selling rate, purchase costs, transport deductions, and commission.
- **Coal Blending Recipe Matrix:** Blend multiple coal sources/grades per truck with individual tonnage and cost ratios.
- **Contract Agreement Formulas:** Custom GCV (Gross Calorific Value) penalty matrices, moisture deductions, and base rate specifications.
- **Weight Station Integration:** Automatic net weight calculation from gross and tare readings.
- **Deal Estimator:** Simulate hypothetical multi-truck contracts and margin calculations before dispatching.

### Commercial Party Ledger & Accounting
- **Double-Entry Financial Accounting:** Full debit, credit, balance, and running statement tracking.
- **Receivables & Payables:** Instant visibility into net balances, outstanding invoices, and overpaid advances.
- **Payment Receipts:** One-tap generated payment and dispatch vouchers with printable views.
- **Automatic Balancing:** Real-time balance recomputation upon editing or removing transactions.

### Enterprise-Grade Privacy & Security
- **iOS 18 Passcode Lock Screen:** 5-digit PIN lock screen with Apple HIG layout and tactile keypad animations.
- **Hardware Biometrics:** Native Android fingerprint and biometric prompt via custom native plugin (`AppBiometricPlugin.java`).
- **Master Offline Recovery Key (`FL-XXXX-XXXX`):** Self-service, zero-knowledge offline recovery key allowing passcode resets without needing server connectivity.
- **Sensitive Gate Protection:** PIN verification required to change passcodes, export ledger data, or import backups.
- **Smart Data Import Protection:** Interactive modal with choice between **Nuke & Overwrite** or intelligent **Merge** resolution.

### Cloud Sync & Offline-First Resilience
- **Offline-First by Design:** Uses local IndexedDB caching so operators can record dispatches without internet access at remote mines or weighing bridges.
- **Firebase Firestore Subcollections:** Scalable cloud architecture synchronizing party records, dispatches, and payments as subcollections under the user's secure account ID.
- **Write-Through Synchronization:** Automatic background synchronization with retry handling and manual "Sync Now" triggers.
- **Google Single Sign-On (SSO):** Seamless one-tap authentication via Capacitor Firebase Auth.

### Professional Exporting & Invoicing
- **Multi-Sheet Excel Reports:** Formatted `.xlsx` workbooks with color-coded profit badges, summary metrics, and ledger breakdowns.
- **PDF Slips & Receipts:** Clean, customer-ready printable receipts with business branding and headers.
- **WhatsApp Formatted Summaries:** Instant text formatting for quick sharing with truck drivers, factory owners, and suppliers.
- **Full JSON Backups:** Complete data export for off-site archiving and recovery.

### Apple iOS 18 Design Experience
- **Adaptive Light & Dark Themes:** Fully responsive interface that seamlessly transitions between deep OLED dark mode and crisp iOS light mode.
- **Color Accent Themes:** Personalize your interface with presets like *Electric Sapphire*, *Emerald Green*, *Royal Violet*, and *Sunset Amber*.
- **Haptics & Audio Chimes:** Tactile button feedbacks, cash chime audio cues, and modal pop sounds.
- **Automatic Currency Formatting:** Native commas, PKR notation, and localized numerical inputs.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Styling & Design System** | [Tailwind CSS v4](https://tailwindcss.com/), Apple iOS 18 HIG Tokens & Glassmorphism |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android) |
| **Local Database** | IndexedDB / Browser Storage Engine |
| **Cloud Backend** | [Firebase Firestore](https://firebase.google.com/docs/firestore), [Firebase Authentication](https://firebase.google.com/docs/auth) |
| **Reporting & Exporting** | `exceljs`, `xlsx`, `jspdf`, `jspdf-autotable`, `html2canvas` |
| **Icons & Typography** | [Lucide React](https://lucide.dev/), Plus Jakarta Sans, Outfit, JetBrains Mono |

---

## Directory Structure

```text
├── android/                        # Android Native Project (Capacitor)
│   ├── app/
│   │   ├── build.gradle            # App-level build & signing configuration
│   │   └── src/main/java/.../      # MainActivity & native AppBiometricPlugin
│   ├── keystore.properties         # Local release keystore properties (gitignored)
│   └── release.keystore            # Local production signing key (gitignored)
├── src/
│   ├── components/                 # Reusable UI & iOS modals
│   │   ├── IOSAppLockScreen.tsx    # 5-digit PIN & biometric lock screen
│   │   ├── IOSRecoveryKeyModal.tsx # Master offline recovery dialog
│   │   ├── DealEstimatorModal.tsx  # Profit & recipe forecasting tool
│   │   ├── DispatchReceipt.tsx     # Dispatch slip view
│   │   ├── PaymentReceipt.tsx      # Payment voucher view
│   │   └── Layout.tsx              # Root app shell, navigation & audio system
│   ├── pages/                      # Application route screens
│   │   ├── Summary.tsx             # Financial overview & KPIs
│   │   ├── PartiesList.tsx         # Commercial accounts directory
│   │   ├── PartyLedger.tsx         # Individual party transaction history
│   │   ├── DispatchForm.tsx        # Dispatch entry & coal blending builder
│   │   ├── AllEntries.tsx          # Filterable global ledger entries
│   │   └── Settings.tsx            # Cloud sync, security & theme options
│   ├── lib/                        # Infrastructure
│   │   ├── db.ts                   # Local IndexedDB database & sync bridges
│   │   ├── firebase.ts             # Firebase client configuration
│   │   └── syncManager.ts          # Firestore background synchronization
│   ├── utils/                      # Business logic & utilities
│   │   ├── calculations.ts         # GCV, moisture & profit algorithms
│   │   ├── securityLock.ts         # PIN hashing, offline key & biometric hooks
│   │   ├── exportSharing.ts        # Excel, PDF & WhatsApp generation
│   │   └── currency.ts             # Currency formatting & comma parsers
│   ├── types.ts                    # Strict TypeScript domain interfaces
│   └── index.css                   # iOS 18 Design tokens, dark mode & animations
```

---

## Getting Started

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Android SDK:** Platform tools & Build tools (for Android compilation)
- **Java Development Kit:** OpenJDK 17 or 21

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/talhaawan-044/Factory-Ledger.git
cd Factory-Ledger
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Build & Sync Native Android
```bash
# Compile web assets
npm run build

# Synchronize Capacitor native bridge
npx cap sync android
```

### 4. Run Directly on Connected Android Device
```bash
npx cap run android
```
*(Or use the ADB deployment chain to build and launch immediately):*
```bash
./android/gradlew -p android assembleDebug && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Building a Signed Production APK

The project is preconfigured to generate cryptographically signed release builds using Gradle and Android SDK `apksigner`.

1. Ensure `android/keystore.properties` is present (excluded from version control):
   ```properties
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyPassword=YOUR_KEYSTORE_PASSWORD
   keyAlias=factoryledger
   storeFile=release.keystore
   ```

2. Run the release build pipeline:
   ```bash
   npm run build && npx cap sync android && cd android && ./gradlew assembleRelease
   ```

3. Your optimized, signed, and aligned production APK is generated at:
   ```text
   android/app/build/outputs/apk/release/app-release.apk
   ```

---

## Security & Privacy Architecture

- **No Remote Telemetry:** The app collects zero user tracking or diagnostic metrics.
- **Zero-Knowledge Recovery:** Your Master Recovery Key is stored exclusively on your device. Even if an attacker gains access to your cloud account, they cannot bypass your local lock without this offline key.
- **Biometric Hardware Isolation:** Biometric authentication runs entirely on-device via Android's `androidx.biometric` APIs; biometric data never leaves your device's hardware secure enclave.

---

## License

This project is licensed under the [MIT License](LICENSE).
Distributed as an industrial management solution for factories, dealers, and logistics operators.
