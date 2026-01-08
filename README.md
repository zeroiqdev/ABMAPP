# ABM Workshop & Marketplace Mobile App

A comprehensive mobile application built with Expo framework for automotive workshop management, customer service, and auto parts marketplace. The app supports both iOS and Android platforms.

## Features

### A. Customer Mobile App (Client-Facing)

**User Registration & Login**
- Secure signup/login with Firebase authentication
- Password reset & profile recovery
- User profile management

**Profile & Vehicle Management**
- Add, edit, and delete vehicle records
- Store VIN, license plate, make, model, and year
- Link multiple vehicles under one account

**Book Service / Lodge Complaint**
- Select service or report faults
- Upload photos or videos of issues
- Schedule appointments

**Real-Time Job Tracking**
- Live status tracking (Received → Diagnosed → Repairing → Completed)
- Assigned technician visibility
- Detailed job progress timeline

**Job History & Service Records**
- Access past jobs, replaced parts, and notes
- Download receipts or service reports (PDF generation)

**View Invoices & Make Payments**
- Integrated Monnify payments (Virtual Accounts)
- Payment history with filters
- Invoice download and sharing

**Push Notifications**
- Instant alerts for progress, approvals, and reminders
- Notification service implemented with Expo Notifications

**Settings & Preferences**
- Manage profile, password, and notification settings
- User preferences management

**Support & Messaging**
- In-app communication with service advisors
- Real-time messaging interface

### B. Workshop Management System (Internal Staff-Facing)

**Role-Based Dashboards**
- **Admin Dashboard**: Full workshop overview, staff management, settings
- **Technician Dashboard**: Assigned jobs, progress tracking
- **Storekeeper Dashboard**: Inventory management, low stock alerts
- **Accountant Dashboard**: Financial management, invoices, reports
- **Service Advisor Dashboard**: Customer check-in, job management

**Customer & Vehicle Management**
- Centralized database for customers and vehicles
- Add/edit vehicle and service records
- View complete service history

**Complaint & Job Intake**
- Create job cards and record issues
- Assign technician(s)
- Update job status and comments

**Technician Dashboard**
- View assigned jobs
- Log time spent, parts used, and progress
- Update repair stages

**Storekeeper Dashboard (Inventory Management)**
- Manage stock-in and stock-out
- Approve and issue parts
- Receive automatic low-stock alerts
- Supplier and restock record management

**Accountant Dashboard (Billing & Payments)**
- Create invoices
- Add VAT, discounts, and payment terms
- Monitor daily/weekly/monthly income reports
- Track outstanding payments

**Service Advisor Dashboard**
- Handle vehicle check-in and delivery
- Capture fuel level, dents, in-car items
- Generate job cards
- Send repair updates to customers

**Admin Dashboard**
- Manage staff roles and permissions
- Configure VAT rates and workshop settings
- Approve transactions
- Access full workshop analytics

**Reports & Insights**
- Financial summaries and performance reports
- Technician efficiency and revenue contribution
- Inventory usage and restock tracking
- Customer visit patterns and service frequency

**Notifications & Alerts**
- Alerts for job status changes, low inventory, and pending approvals
- Internal workshop notifications across departments

**Multi-Role Access**
- Dedicated dashboards for all roles
- Role-based permissions and access control

### C. Auto Parts Marketplace Module

**Product Listings**
- Categories: Engine, Electrical, Suspension, Accessories, etc.
- Each listing includes name, image, price, and compatibility
- Search and filter functionality

**Vendor Management**
- Vendor signup, approval, and management (structure ready)
- Dashboard for vendors to monitor sales and stock

**Search & Filter**
- Advanced filters by name, price, vehicle, or category
- Real-time search functionality

**Cart & Checkout**
- Add to cart functionality
- Secure checkout with Monnify
- Option for delivery or in-store pickup

**Customer Account**
- Order history (structure ready)
- Track deliveries
- Save favorite items

**Admin Control**
- Approve vendor listings
- Manage commissions, disputes, and payouts
- Platform sales analytics

### D. Subscription Model for Other Workshops

**Structure Ready**
- Multi-tenant support with `workshopId` in user and job records
- Workshop subscription status tracking
- Settings for VAT rates and workshop configuration

## Tech Stack

- **Framework**: Expo (~51.0.0)
- **Routing**: Expo Router (~3.5.0)
- **State Management**: Zustand
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Notifications**: Expo Notifications
- **Payments**: Monnify integration
- **Image Handling**: Expo Image Picker, Expo Camera
- **PDF Generation**: Expo Print
- **Date Handling**: date-fns
- **Forms**: React Hook Form with Zod validation

## Project Structure

```
ABMAPP/
├── app/
│   ├── (auth)/          # Authentication screens
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (customer)/      # Customer-facing screens
│   │   ├── home.tsx
│   │   ├── vehicles.tsx
│   │   ├── add-vehicle.tsx
│   │   ├── book-service.tsx
│   │   ├── bookings.tsx
│   │   ├── job-details.tsx
│   │   ├── invoices.tsx
│   │   ├── invoice-details.tsx
│   │   ├── payment.tsx
│   │   ├── notifications.tsx
│   │   ├── profile.tsx
│   │   └── support.tsx
│   ├── (workshop)/      # Workshop management screens
│   │   ├── dashboard.tsx
│   │   ├── jobs.tsx
│   │   ├── job-details.tsx
│   │   ├── customers.tsx
│   │   ├── vehicles.tsx
│   │   ├── inventory.tsx
│   │   ├── invoices.tsx
│   │   ├── reports.tsx
│   │   └── settings.tsx
│   ├── (marketplace)/   # Marketplace screens
│   │   ├── home.tsx
│   │   ├── product-details.tsx
│   │   ├── cart.tsx
│   │   └── checkout.tsx
│   └── _layout.tsx       # Root layout
├── config/
│   └── firebase.ts       # Firebase configuration
├── services/
│   ├── firebaseService.ts    # Firestore operations
│   ├── paymentService.ts     # Payment integration
│   └── notificationService.ts # Push notifications
├── store/
│   └── authStore.ts      # Authentication state
└── types/
    └── index.ts           # TypeScript type definitions
```

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Add a Web app and copy the config

2. **Set Environment Variables**
   - Copy `.env.example` to `.env`
   - Add your Firebase credentials:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

3. **Enable Firebase Services**
   - **Authentication**: Enable Email/Password sign-in
   - **Firestore**: Create database (start in test mode)
   - **Storage**: Get started (test mode)

4. **Set Security Rules** (See `DATABASE_SETUP.md` for detailed rules)
   - Firestore: Allow authenticated read/write for development
   - Storage: Allow authenticated read/write for development

**Note**: Collections (database tables) are created automatically when you first use the app. No manual setup required!

### 3. Run the App

```bash
# Start development server
npm start

# iOS Simulator (macOS only)
npm run ios

# Android Emulator
npm run android

# Or use Expo Go app on your phone (scan QR code)
```

### 4. Test on Physical Devices

**iOS:**
- Install "Expo Go" from App Store
- Scan QR code from terminal

**Android:**
- Install "Expo Go" from Play Store
- Scan QR code from terminal

## Key Features Implementation

### Authentication
- Firebase Authentication with email/password
- Persistent authentication state
- Role-based routing

### Real-Time Updates
- Firestore real-time listeners for jobs and notifications
- Live status updates

### File Uploads
- Image upload to Firebase Storage
- Support for multiple images per job
- Video upload capability

### Payments
- Monnify integration
- Payment verification
- Invoice generation

### Notifications
- Expo Push Notifications
- Local notifications
- Firestore notification storage

## Next Steps / TODO

1. **Subscription Model Implementation**
   - Complete multi-tenant workshop subscription screens
   - Subscription payment integration
   - Workshop onboarding flow

2. **Enhanced Features**
   - Complete vendor dashboard
   - Order tracking system
   - Advanced reporting with charts
   - Customer analytics

3. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

4. **Performance Optimization**
   - Image optimization
   - Code splitting
   - Caching strategies

5. **Additional Integrations**
   - SMS notifications
   - Email notifications
   - Analytics integration

## Notes

- The app uses Expo Router for file-based routing
- All screens are built with React Native components
- Firebase is used as the backend (Firestore for database, Storage for files)
- Payment integrations are set up but require actual API keys for production
- Some features like vendor dashboard and subscription screens have structure but need completion
- The notification service is implemented and ready for push notifications

## License

Private - ABM TEK LIMITED
