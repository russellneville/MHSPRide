export default function PrivacyPolicyContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <p className="font-semibold text-foreground text-base">MHSP Ride Privacy Policy</p>

      <div className="space-y-1">
        <p className="font-medium text-foreground">1. What This Covers</p>
        <p>This policy explains what information MHSP Ride collects, why it's collected, and who can see it. It applies to the MHSP Ride web application only.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">2. Information We Collect</p>
        <p>MHSP Ride stores membership identifiers, name, login email, phone, home address, profile information, vehicles, network preferences, rides, bookings, requests, feedback, badges, and related activity records needed to verify membership and operate the carpool service. Profile photos are stored in Firebase Storage.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">3. Why We Collect It</p>
        <p>This information verifies that you're an eligible MHSP member and lets the app match riders and drivers, process bookings and ride requests, and send the notifications those actions require.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">4. Cookies &amp; Analytics</p>
        <p>Essential browser storage supports application operation and preference state. In production, Google Analytics is enabled unless you choose the analytics opt-out option; advertising storage and personalization are always denied.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">5. Who Can See Your Information</p>
        <p>You must be an MHSP member to use the app. Drivers and passengers receive one another's contact details in booking emails relevant to a shared ride. Administrators can access member records to operate the service, and authenticated members can read ride and open-request details.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">6. Do We Share or Sell Your Information</p>
        <p>No. MHSP Ride was built on the Golden Rule — treat others like you'd like to be treated — and isn't monetized. Your information isn't sold, shared with advertisers, or used for anything beyond running the carpool service.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">7. How We Protect Your Information</p>
        <p>The application was developed with OWASP security standards and has been through multiple security scans for both client and server vulnerabilities. Every effort is made to keep it secure and vulnerability free. That said, your information is visible to other MHSP members through the app — only enter information you're comfortable sharing with the community.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">8. Notifications</p>
        <p>MHSP Ride sends email, not text or push notifications. Phone numbers are shared with the driver and riders on a shared booking so they can contact each other directly, not for any other purpose.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">9. Managing or Deleting Your Data</p>
        <p>You can update your profile and change your email or password from the account security area at any time. The app doesn't currently have a self-service option to delete your account or export your data — send a deletion request through the Feedback widget or the Contact Us page and it will be handled directly.</p>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">10. Changes to This Policy</p>
        <p>This policy may be updated at any time without prior notice. Continued use of the site after changes are posted constitutes acceptance of the revised policy.</p>
      </div>

      <p className="text-xs text-muted-foreground pt-2 border-t border-border">Last updated: August 2026</p>
    </div>
  )
}
