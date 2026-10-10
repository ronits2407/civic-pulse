import ReportPage from '@/app/report/page'

// Public mirror of /report (which is behind auth) so the deck can embed it.
export default function DeckReportPreview() {
  return <ReportPage />
}
