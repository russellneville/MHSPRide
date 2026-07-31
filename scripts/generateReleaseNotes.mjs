/**
 * generateReleaseNotes.mjs
 *
 * Drafts a new entry for lib/releaseNotes.js from git log, by diffing the two
 * most recent tags (or an explicit range). Commit subjects become bullets,
 * with trailing PR references like " (#123)" or " (#123) (#124)" stripped.
 *
 * The output is a draft, not final copy — it includes every commit in range,
 * bug fixes included. Review it, trim it down to user-facing features, and
 * paste the result into lib/releaseNotes.js (newest entry first) before
 * committing.
 *
 * Usage:
 *   node scripts/generateReleaseNotes.mjs                # newest tag vs. the one before it
 *   node scripts/generateReleaseNotes.mjs v0.9.5          # given tag vs. the one before it
 *   node scripts/generateReleaseNotes.mjs v0.9.5 v0.9.0   # explicit range
 */

import { execFileSync } from 'child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function allTagsByDate() {
  return git(['tag', '--sort=creatordate']).split('\n').filter(Boolean)
}

const [, , tagArg, prevTagArg] = process.argv

const tags = allTagsByDate()
if (tags.length === 0) {
  console.error('No git tags found.')
  process.exit(1)
}

const tag = tagArg || tags[tags.length - 1]
const tagIndex = tags.indexOf(tag)
if (tagIndex === -1) {
  console.error(`Tag "${tag}" not found. Known tags: ${tags.join(', ')}`)
  process.exit(1)
}

const prevTag = prevTagArg || tags[tagIndex - 1]
const range = prevTag ? `${prevTag}..${tag}` : tag

const date = git(['log', '-1', '--format=%ad', '--date=short', tag])
const subjects = git(['log', '--format=%s', range]).split('\n').filter(Boolean)

const bullets = subjects.map(subject =>
  subject.replace(/(\s*\(#\d+\))+$/, '').trim()
)

console.log(`{`)
console.log(`  version: '${tag}',`)
console.log(`  date: '${date}',`)
console.log(`  highlights: [`)
for (const bullet of bullets) {
  console.log(`    ${JSON.stringify(bullet)},`)
}
console.log(`  ],`)
console.log(`},`)
