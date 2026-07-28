import { NextResponse } from 'next/server'
import { icsFileContent } from '@/lib/calendarLinks'

// Stateless: takes the event fields straight from the query string (the same
// values already embedded in the Google/Outlook calendar links in the email)
// rather than looking anything up in Firestore, so no auth is required and no
// additional data is exposed beyond what's already in the email itself.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!title || !start || !end) {
    return NextResponse.json({ error: 'title, start, and end are required' }, { status: 400 })
  }

  const ics = icsFileContent({
    title,
    description: searchParams.get('description') || '',
    location: searchParams.get('location') || '',
    start,
    end,
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ride.ics"',
    },
  })
}
