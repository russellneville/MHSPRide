# MHSPRide - Carpooling for Mount Hood Ski Patrol

**MHSPRide** is a private carpooling web app built for the Mount Hood Ski Patrol community. It connects drivers and passengers within the patrol network, making it easier to coordinate rides to the mountain. Access is private and role-based, so only MHSP members can participate.

Built with `Next.js` and `Shadcn` on the frontend, powered by `Firebase` and `Firestore` on the backend.

## Features

### Role-based access
User authentication with roles: drivers, riders, and admin (Director).

### Director
- Create and manage private networks.
- Share unique join codes with members.
- Approve or reject member requests.

### Driver
- Join a network via join code.
- Post rides visible only within the network.
- Manage ride status (not started, in progress, canceled, finished).

### Passenger
- Join a network using a join code.
- Search for rides by departure point, destination, and date.
- Book seats and settle up in cash after the ride.

### Responsive UI
Built with Tailwind CSS, Shadcn, and lucide-react.

## Tech Stack

| Layer         | Tech                        |
|---------------|-----------------------------|
| Frontend      | Next.js                     |
| UI Components | Tailwind CSS + Shadcn       |
| Backend & DB  | Firebase & Firestore        |

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Ourouimed/MHSPRide.git
```

### 2. Install dependencies

```bash
cd MHSPRide
npm install
```

### 3. Configure Firebase

Create a `.env` file in the project root and add your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### 4. Start the dev server

```bash
npm run dev
```

Open your browser at: http://localhost:3000

## Project Structure

```
MHSPRide/
├── app/                                         # Next.js application
│   ├── dashboard/                               # Protected dashboard area
│   │   ├── bookings/                            # Passenger booking pages
│   │   │   ├── [bookingId]/page.jsx             # Booking details
│   │   │   └── page.jsx                         # Bookings list
│   │   ├── network/                             # Private network views
│   │   │   └── [networkId]/
│   │   │       ├── find/page.jsx                # Find rides in network
│   │   │       ├── rides/[rideId]/page.jsx      # Ride details
│   │   │       └── page.jsx                     # Network home
│   │   ├── networks/page.jsx                    # All networks
│   │   ├── profile/page.jsx                     # User profile
│   │   ├── rides/page.jsx                       # Driver ride management
│   │   ├── dashboardLayout.jsx                  # Dashboard layout
│   │   └── page.jsx                             # Dashboard home
│   ├── login/page.jsx                           # Login page
│   ├── register/page.jsx                        # Registration page
│   ├── globals.css                              # Global styles
│   ├── layout.jsx                               # Root layout
│   └── page.jsx                                 # Landing page
│
├── components/                                  # Reusable UI components
├── context/                                     # React contexts
│   ├── AuthContext.jsx
│   ├── NetworksContext.jsx
│   ├── PopupContext.jsx
│   └── ThemeContext.jsx
│
├── hooks/                                       # Custom hooks
│   └── use-mobile.js
│
├── lib/                                         # Utilities and config
│   ├── firebaseClient.js
│   ├── services.js
│   ├── testimons/
│   └── utils/
│
├── public/                                      # Static assets
│   ├── documentation/
│   └── assets/
│
├── components.json
├── eslint.config.mjs
├── jsconfig.json
├── next.config.mjs
├── package.json
└── postcss.config.mjs
```

## Screenshots

### Home Page
![Home Page](/public/documentation/homepage.png)
![Home Page Dark](/public/documentation/homepage_dark.png)

### Dashboard
![Login](/public/documentation/login.png)
![Register](/public/documentation/register.png)
![Dashboard](/public/documentation/dashboard.png)
![Networks](/public/documentation/networks.png)
![Network View](/public/documentation/network.png)
![Offer Ride](/public/documentation/offer-ride.png)
![Driver Rides](/public/documentation/rides.png)
![Ride Details](/public/documentation/ride.png)

## License

This project is licensed under the [MIT License](LICENCE).
