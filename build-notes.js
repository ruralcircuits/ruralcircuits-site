#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

console.log('🌿 Rural Circuits - Build Field Notes');
console.log('=====================================\n');

const DRAFTS_DIR = 'drafts';
const FIELD_NOTES_DIR = 'field-notes';
const TAGS_DIR = 'tags';
const ABOUT_FILE = 'about.md';
const RSS_FILE = 'feed.xml';
const SITE_URL = 'https://ruralcircuits.earth';

// Parse YAML-like frontmatter (simple parser for our use case)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterStr = match[1];
  const markdownContent = match[2];
  const frontmatter = {};

  let currentKey = null;
  let inArray = false;

  for (const line of frontmatterStr.split('\n')) {
    // Array item
    if (line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, '').trim();
      if (currentKey && Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey].push(value);
      }
    }
    // Key-value pair
    else if (line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (value === '') {
        // Empty value means array follows
        frontmatter[key] = [];
        currentKey = key;
        inArray = true;
      } else {
        frontmatter[key] = value;
        currentKey = key;
        inArray = false;
      }
    }
  }

  return { frontmatter, content: markdownContent };
}

// Generate slug from title
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Format date for display (MM/DD/YYYY)
function formatDateDisplay(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

// Format date for filename (YYYY-MM-DD)
function formatDateFilename(dateStr) {
  // Handle both YYYY-MM-DD and Date objects
  if (typeof dateStr === 'string') {
    // Already in correct format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    // Try parsing
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// Escape HTML for safe insertion
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Generate tag HTML for display
function generateTagsHtml(tags, basePath = '') {
  if (!tags || tags.length === 0) return '';

  const tagLinks = tags.map(tag =>
    `<a href="${basePath}tags/${slugify(tag)}/index.html" class="field-note-tag">${escapeHtml(tag)}</a>`
  ).join(' ');

  return `<div class="field-note-tags">${tagLinks}</div>`;
}

// Generate prev/next navigation HTML
function generatePrevNextHtml(prev, next) {
  if (!prev && !next) return '';

  const prevLink = prev
    ? `<a href="${prev.filename}" class="prev-next-link prev-link">← ${escapeHtml(prev.frontmatter.title)}</a>`
    : '<span class="prev-next-link prev-link disabled"></span>';

  const nextLink = next
    ? `<a href="${next.filename}" class="prev-next-link next-link">${escapeHtml(next.frontmatter.title)} →</a>`
    : '<span class="prev-next-link next-link disabled"></span>';

  return `<nav class="prev-next-nav">${prevLink}${nextLink}</nav>`;
}

// Generate individual field note HTML
function generateNoteHtml(note, prev, next) {
  const { title, date, image, tags } = note.frontmatter;
  const dateDisplay = formatDateDisplay(date);
  const htmlContent = marked.parse(note.content);
  const tagsHtml = generateTagsHtml(tags, '../');
  const prevNextHtml = generatePrevNextHtml(prev, next);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} – Rural Circuits</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(note.frontmatter.excerpt || '')}">
  <link rel="stylesheet" href="../styles.css">
  <link rel="alternate" type="application/rss+xml" title="Rural Circuits RSS Feed" href="../feed.xml">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <div class="brand">
        <h1 class="site-title">Rural Circuits</h1>
        <p class="site-tagline">Ideas for a better life on earth</p>
      </div>
      <nav class="site-nav">
        <a href="../index.html">Home</a>
        <a href="index.html">Archive</a>
        <a href="../tags/index.html">Tags</a>
        <a href="../index.html#contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="section">
    <div class="container">
      <article>
        <header>
          <h2>${escapeHtml(title)}</h2>
          <p class="field-notes-meta">${dateDisplay}</p>
          ${tagsHtml}
        </header>

        <div class="section-content">
          <img src="${image}" alt="${escapeHtml(title)}" class="section-image">
          ${htmlContent}
        </div>

        ${prevNextHtml}
      </article>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>Building in the open, growing at nature's pace.</p>
      <p>Nourishing the earth, community minded, peaceful.</p>
      <p class="footer-meta"><a href="../index.html">← Back to Home</a> · <a href="../feed.xml">RSS</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

// Generate about card HTML from about.md content
function generateAboutCardHtml(about) {
  const { headline, image, image_alt } = about.frontmatter;
  const htmlContent = marked.parse(about.content);

  return `<!-- About -->
          <article class="field-note-card field-note-pinned">
            <div class="field-note-link">
              <img src="${image}" alt="${escapeHtml(image_alt || headline)}" class="field-note-image">
              <div class="field-note-content">
                <h3>${escapeHtml(headline)}</h3>
                ${htmlContent}
                <div class="pinned-actions">
                  <a href="#contact" class="field-note-read-more">Get in touch →</a>
                </div>
              </div>
            </div>
          </article>`;
}

// Generate tag HTML for cards (no links, since card is already a link)
function generateTagsHtmlPlain(tags) {
  if (!tags || tags.length === 0) return '';

  const tagSpans = tags.map(tag =>
    `<span class="field-note-tag">${escapeHtml(tag)}</span>`
  ).join(' ');

  return `<div class="field-note-tags">${tagSpans}</div>`;
}

// Generate homepage card HTML
function generateCardHtml(note) {
  const { title, date, image, excerpt, tags } = note.frontmatter;
  const dateDisplay = formatDateDisplay(date);
  const tagsHtml = generateTagsHtmlPlain(tags);

  return `<!-- Field Note Card -->
          <article class="field-note-card">
            <a href="field-notes/${note.filename}" class="field-note-link">
              <img src="field-notes/${image}" alt="${escapeHtml(title)}" class="field-note-image">
              <div class="field-note-content">
                <h3>${escapeHtml(title)}</h3>
                <p class="field-note-date">${dateDisplay}</p>
                ${tagsHtml}
                <p class="field-note-excerpt">
                  ${escapeHtml(excerpt)}
                </p>
                <span class="field-note-read-more">Read more →</span>
              </div>
            </a>
          </article>`;
}

// Generate archive page
function generateArchiveHtml(notes) {
  const notesList = notes.map(note => {
    const { title, date, tags } = note.frontmatter;
    const dateDisplay = formatDateDisplay(date);
    const tagsHtml = tags && tags.length > 0
      ? ` <span class="archive-tags">${tags.map(t => `<a href="../tags/${slugify(t)}/index.html" class="field-note-tag">${escapeHtml(t)}</a>`).join(' ')}</span>`
      : '';
    return `<li><a href="${note.filename}">${escapeHtml(title)}</a> <span class="field-notes-meta">${dateDisplay}</span>${tagsHtml}</li>`;
  }).join('\n            ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Field Notes Archive – Rural Circuits</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Archive of all field notes from Rural Circuits">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <div class="brand">
        <h1 class="site-title">Rural Circuits</h1>
        <p class="site-tagline">Ideas for a better life on earth</p>
      </div>
      <nav class="site-nav">
        <a href="../index.html">Home</a>
        <a href="index.html">Archive</a>
        <a href="../tags/index.html">Tags</a>
        <a href="../index.html#contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="section">
    <div class="container">
      <h2>Field Notes Archive</h2>
      <p class="section-intro">All field notes, newest first.</p>
      <ul class="field-notes-list">
            ${notesList}
          </ul>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>Building in the open, growing at nature's pace.</p>
      <p>Nourishing the earth, community minded, peaceful.</p>
      <p class="footer-meta"><a href="../index.html">← Back to Home</a> · <a href="../feed.xml">RSS</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

// Generate tag archive page
function generateTagPageHtml(tag, notes) {
  const notesList = notes.map(note => {
    const { title, date } = note.frontmatter;
    const dateDisplay = formatDateDisplay(date);
    return `<li><a href="../../field-notes/${note.filename}">${escapeHtml(title)}</a> <span class="field-notes-meta">${dateDisplay}</span></li>`;
  }).join('\n            ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tag: ${escapeHtml(tag)} – Rural Circuits</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Field notes tagged with '${escapeHtml(tag)}'">
  <link rel="stylesheet" href="../../styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <div class="brand">
        <h1 class="site-title">Rural Circuits</h1>
        <p class="site-tagline">Ideas for a better life on earth</p>
      </div>
      <nav class="site-nav">
        <a href="../../index.html">Home</a>
        <a href="../../field-notes/index.html">Archive</a>
        <a href="../index.html">Tags</a>
        <a href="../../index.html#contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="section">
    <div class="container">
      <h2>Tag: ${escapeHtml(tag)}</h2>
      <p class="section-intro">Field notes tagged with "${escapeHtml(tag)}".</p>
      <ul class="field-notes-list">
            ${notesList}
          </ul>
      <p class="tag-nav"><a href="../index.html">← All tags</a></p>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>Building in the open, growing at nature's pace.</p>
      <p>Nourishing the earth, community minded, peaceful.</p>
      <p class="footer-meta"><a href="../../index.html">← Back to Home</a> · <a href="../../feed.xml">RSS</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

// Generate tags index page
function generateTagsIndexHtml(tagCounts) {
  const tagsList = Object.entries(tagCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, count]) =>
      `<li><a href="${slugify(tag)}/index.html" class="field-note-tag tag-large">${escapeHtml(tag)}</a> <span class="tag-count">(${count})</span></li>`
    ).join('\n            ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tags – Rural Circuits</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Browse field notes by tag">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <div class="brand">
        <h1 class="site-title">Rural Circuits</h1>
        <p class="site-tagline">Ideas for a better life on earth</p>
      </div>
      <nav class="site-nav">
        <a href="../index.html">Home</a>
        <a href="../field-notes/index.html">Archive</a>
        <a href="index.html">Tags</a>
        <a href="../index.html#contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="section">
    <div class="container">
      <h2>Tags</h2>
      <p class="section-intro">Browse field notes by topic.</p>
      <ul class="tags-list">
            ${tagsList}
          </ul>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>Building in the open, growing at nature's pace.</p>
      <p>Nourishing the earth, community minded, peaceful.</p>
      <p class="footer-meta"><a href="../index.html">← Back to Home</a> · <a href="../feed.xml">RSS</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

// Generate RSS feed
function generateRssFeed(notes) {
  const now = new Date().toUTCString();

  const items = notes.map(note => {
    const { title, date, excerpt } = note.frontmatter;
    const url = `${SITE_URL}/field-notes/${note.filename}`;
    const pubDate = new Date(date).toUTCString();

    return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeHtml(excerpt || '')}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Rural Circuits</title>
    <link>${SITE_URL}</link>
    <description>Ideas for a better life on earth. Field notes on regenerative living, homesteading, and gentle technology.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

// Update homepage with about card and field note cards
function updateHomepage(notes, about) {
  let indexHtml = fs.readFileSync('index.html', 'utf8');

  // Generate about card HTML
  const aboutCardHtml = generateAboutCardHtml(about);

  // Generate all field note cards HTML
  const cardsHtml = notes.map(note => generateCardHtml(note)).join('\n\n');

  // Strategy: Find the About card marker and replace everything
  // between it and the grid closing </div>

  // Find the About card by its comment marker
  const aboutMarker = indexHtml.indexOf('<!-- About -->');
  if (aboutMarker === -1) {
    console.error('❌ Could not find "<!-- About -->" marker in index.html');
    process.exit(1);
  }

  // Find the closing </div> of field-notes-grid
  // It's followed by </div> and </section>
  const gridEndPattern = '</div>\n      </div>\n    </section>';
  const gridEndIndex = indexHtml.indexOf(gridEndPattern);
  if (gridEndIndex === -1) {
    console.error('❌ Could not find grid end pattern in index.html');
    process.exit(1);
  }

  // Build the new HTML - replace from about marker to grid end
  const beforeAbout = indexHtml.slice(0, aboutMarker);
  const afterCards = indexHtml.slice(gridEndIndex);

  indexHtml = beforeAbout + aboutCardHtml + '\n\n' + cardsHtml + '\n        ' + afterCards;

  fs.writeFileSync('index.html', indexHtml);
}

// Main build function
function build() {
  // Read and parse about.md
  if (!fs.existsSync(ABOUT_FILE)) {
    console.error(`❌ Could not find ${ABOUT_FILE}`);
    process.exit(1);
  }

  const aboutRaw = fs.readFileSync(ABOUT_FILE, 'utf8');
  const about = parseFrontmatter(aboutRaw);

  if (!about.frontmatter.headline || !about.frontmatter.image) {
    console.error(`❌ ${ABOUT_FILE} missing required frontmatter (headline, image)`);
    process.exit(1);
  }

  console.log(`📄 About: ${about.frontmatter.headline}\n`);

  // Ensure directories exist
  if (!fs.existsSync(DRAFTS_DIR)) {
    console.log(`📁 No ${DRAFTS_DIR}/ folder found. Nothing to build.`);
    return;
  }

  if (!fs.existsSync(FIELD_NOTES_DIR)) {
    fs.mkdirSync(FIELD_NOTES_DIR);
  }

  if (!fs.existsSync(TAGS_DIR)) {
    fs.mkdirSync(TAGS_DIR);
  }

  // Read all markdown files from drafts (ignore files starting with _)
  const draftFiles = fs.readdirSync(DRAFTS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .sort();

  if (draftFiles.length === 0) {
    console.log('📝 No markdown files found in drafts/');
    return;
  }

  console.log(`📝 Found ${draftFiles.length} draft(s):\n`);

  const notes = [];
  const tagMap = {}; // tag -> [notes]

  // Process each draft
  for (const draftFile of draftFiles) {
    const draftPath = path.join(DRAFTS_DIR, draftFile);
    const rawContent = fs.readFileSync(draftPath, 'utf8');
    const { frontmatter, content } = parseFrontmatter(rawContent);

    // Validate required fields
    if (!frontmatter.title || !frontmatter.date || !frontmatter.image) {
      console.error(`⚠️  Skipping ${draftFile}: missing required frontmatter (title, date, image)`);
      continue;
    }

    const slug = slugify(frontmatter.title);
    const dateStr = formatDateFilename(frontmatter.date);
    const filename = `${dateStr}-${slug}.html`;

    const note = {
      draftFile,
      filename,
      frontmatter,
      content
    };

    notes.push(note);

    // Track tags
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      for (const tag of frontmatter.tags) {
        if (!tagMap[tag]) {
          tagMap[tag] = [];
        }
        tagMap[tag].push(note);
      }
    }
  }

  // Sort notes by date (newest first)
  notes.sort((a, b) => {
    const dateA = formatDateFilename(a.frontmatter.date);
    const dateB = formatDateFilename(b.frontmatter.date);
    return dateB.localeCompare(dateA);
  });

  // Generate individual note HTML files (after sorting, so we know prev/next)
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const prev = i > 0 ? notes[i - 1] : null;
    const next = i < notes.length - 1 ? notes[i + 1] : null;

    const noteHtml = generateNoteHtml(note, prev, next);
    const notePath = path.join(FIELD_NOTES_DIR, note.filename);
    fs.writeFileSync(notePath, noteHtml);

    console.log(`   ✅ ${note.frontmatter.title}`);
    console.log(`      → ${notePath}`);
  }

  // Generate archive page
  const archiveHtml = generateArchiveHtml(notes);
  fs.writeFileSync(path.join(FIELD_NOTES_DIR, 'index.html'), archiveHtml);
  console.log(`\n   ✅ Archive page → ${FIELD_NOTES_DIR}/index.html`);

  // Generate tag pages
  const tagCounts = {};
  for (const [tag, tagNotes] of Object.entries(tagMap)) {
    const tagSlug = slugify(tag);
    const tagDir = path.join(TAGS_DIR, tagSlug);

    if (!fs.existsSync(tagDir)) {
      fs.mkdirSync(tagDir, { recursive: true });
    }

    // Sort tag notes by date (newest first)
    tagNotes.sort((a, b) => {
      const dateA = formatDateFilename(a.frontmatter.date);
      const dateB = formatDateFilename(b.frontmatter.date);
      return dateB.localeCompare(dateA);
    });

    const tagPageHtml = generateTagPageHtml(tag, tagNotes);
    fs.writeFileSync(path.join(tagDir, 'index.html'), tagPageHtml);

    tagCounts[tag] = tagNotes.length;
    console.log(`   ✅ Tag: ${tag} (${tagNotes.length} notes) → ${tagDir}/index.html`);
  }

  // Generate tags index
  const tagsIndexHtml = generateTagsIndexHtml(tagCounts);
  fs.writeFileSync(path.join(TAGS_DIR, 'index.html'), tagsIndexHtml);
  console.log(`   ✅ Tags index → ${TAGS_DIR}/index.html`);

  // Update homepage
  updateHomepage(notes, about);
  console.log(`\n   ✅ Updated: index.html`);

  // Generate RSS feed
  const rssFeed = generateRssFeed(notes);
  fs.writeFileSync(RSS_FILE, rssFeed);
  console.log(`   ✅ RSS feed → ${RSS_FILE}`);

  console.log(`\n🌿 Build complete! Generated ${notes.length} field notes.`);
}

// Run build
try {
  build();
} catch (error) {
  console.error('\n❌ Build error:', error.message);
  process.exit(1);
}
