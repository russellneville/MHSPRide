'use client'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RELEASE_NOTES } from '@/lib/releaseNotes'

export default function ReleaseNotesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold">Release Notes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            What's changed in MHSP Ride, tagged version by version.
          </p>
        </div>

        {RELEASE_NOTES.map(({ version, date, highlights }) => (
          <Card key={version}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between gap-3">
                <span>{version}</span>
                <span className="text-sm font-normal text-muted-foreground">{date}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
                {highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  )
}
