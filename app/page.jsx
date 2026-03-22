import Image from "next/image";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  CarFront,
  ChevronRight,
  Coffee,
  MapPin,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";

const networks = ["Hill Patrol", "Mountain Hosts", "Nordic"];

const highlights = [
  "Coordinate carpool rides to Mount Hood in seconds",
  "See open seats and confirmed riders at a glance",
  "Get instant updates when ride details change",
];

const steps = [
  {
    title: "Post a Ride",
    description:
      "Drivers share departure location, time, and open seats for upcoming patrol days.",
    icon: CarFront,
  },
  {
    title: "Book a Seat",
    description:
      "Patrollers and Hosts browse rides by network and reserve spots without back-and-forth texting.",
    icon: Users,
  },
  {
    title: "Stay Synced",
    description:
      "Automatic notifications keep everyone aligned when timing or pickup details shift.",
    icon: BellRing,
  },
];

export default function Home() {
  return (
    <main className="landing-page">
      <section id="home" className="landing-hero">
        <Image
          src="/assets/IMG_1106.jpg"
          alt="Snowy Mount Hood slope and chairlift"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="landing-overlay" />
        <div className="landing-snow-drift" />

        <header className="landing-header">
          <Link href="/" className="landing-brand">
            <Image
              src="/assets/MHSP-Logo.png"
              alt="MHSPRide logo"
              width={54}
              height={54}
            />
            <div>
              <p>MHSPRide</p>
              <span>Mount Hood Ski Patrol Carpooling</span>
            </div>
          </Link>

          <nav className="landing-nav">
            <a href="#home">Home</a>
            <a href="#how-it-works">How It Works</a>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Log In</Link>
          </nav>
        </header>

        <div className="landing-content">
          <div className="landing-copy">
            <p className="landing-kicker">
              Built for the volunteers and pros who keep Mount Hood safe
            </p>
            <h1>Ride Together, Serve Together</h1>
            <p className="landing-description">
              Coordinate rides with your crew, reduce solo drives, and
              show up ready to serve on time. One shared app, one mountain, one
              stronger team.
            </p>

            <div className="landing-actions">
              <Link href="/register" className="landing-primary">
                Sign Up
                <ChevronRight />
              </Link>
              <Link href="/login" className="landing-secondary">
                Log In
              </Link>
            </div>

            <div className="landing-network-pills">
              {networks.map((network) => (
                <span key={network}>{network}</span>
              ))}
            </div>
          </div>

          <aside className="landing-feature-card">
            <h2>Patroller Carpooling Made Easy</h2>
            <ul>
              {highlights.map((item) => (
                <li key={item}>
                  <span>
                    <Route size={16} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="landing-mini-grid">
              <div>
                <MapPin size={18} />
                <p>Smart Pickup Planning</p>
              </div>
              <div>
                <CalendarClock size={18} />
                <p>Upcoming & Past Ride History</p>
              </div>
              <div>
                <ShieldCheck size={18} />
                <p>Network-Based Access</p>
              </div>
            </div>

            <div className="landing-bmc-wrap">
              <a
                href="https://buymeacoffee.com/russellneville"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-bmc-btn"
              >
                <Coffee size={18} />
                Support this site
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="landing-workflow">
        <div className="landing-section-title">
          <p>How It Works</p>
          <h2>Built for Real Patrol Mornings</h2>
        </div>

        <div className="landing-steps">
          {steps.map(({ title, description, icon: Icon }) => (
            <article key={title}>
              <div className="landing-step-icon">
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <div className="landing-workflow-bmc">
          <a
            href="https://buymeacoffee.com/russellneville"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-bmc-btn"
          >
            <Coffee size={18} />
            Support this site
          </a>
        </div>
      </section>

      <section id="download" className="landing-download">
        <div className="landing-download-card">
          <div className="landing-download-brand">
            <Image
              src="/assets/MHSP-Logo.png"
              alt="MHSPRide mark"
              width={44}
              height={44}
            />
            <span>MHSPRide</span>
          </div>

          <h2>Register and Start Carpooling to the Mountain</h2>
          <p>
            Coordinate with your crew faster, save parking spaces, cut gas costs, and make every
            shift commute feel like team time.
          </p>

          <div className="landing-download-actions">
            <Link href="/register">Create Account</Link>
            <Link href="/dashboard">Open Dashboard</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
