/**
 * News reports shown on the Ask stage's records canvas. An item is added only after its URL was opened and the page
 * says what `title` and `summary` say; `quote` is the sentence that says it (docs/real_data_plan.md, section 6).
 * Checked by newsRecords.test.ts; a person spot-checks them (docs/VERIFICATION.md, row RD-1).
 */
export type NewsRecord = {
  id: string
  place_key: string   // a REGION_REGISTRY key
  date: string        // ISO date of the report
  title: string
  publisher: string
  url: string
  summary: string
  quote: string
  checked: string     // ISO date the URL was opened
}

export const NEWS_RECORDS: NewsRecord[] = []
