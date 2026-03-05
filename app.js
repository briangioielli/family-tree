// ============================================
//   OUR FAMILY STORY — Application
//   A warm, story-first family memoir.
// ============================================

class FamilyStoryApp {
    constructor() {
        this.people = [];
        this.stories = [];
        this.currentView = null;
        this.currentAudio = null;
        this.isFirebaseReady = false;
        this.scrollObserver = null;
    }

    // ─── INITIALIZATION ────────────────────────

    async init() {
        // Guard against double-initialization
        if (this.isFirebaseReady) return;

        // Wait for Firebase to be ready
        if (!window.firebaseDb) {
            window.addEventListener('firebase-ready', () => this.init());
            return;
        }

        this.isFirebaseReady = true;

        // Setup routing
        window.addEventListener('hashchange', () => this.navigate());

        // Setup nav scroll behavior
        this.setupNavScroll();

        // Setup scroll animations observer
        this.setupScrollObserver();

        // Setup modal UX (click-outside-to-close, Escape key)
        this.setupModalBehavior();

        // Load data from Firestore
        await this.loadData();

        // Initial route
        this.navigate();
    }

    setupNavScroll() {
        const nav = document.getElementById('siteNav');
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    if (window.scrollY > 20) {
                        nav.classList.add('scrolled');
                    } else {
                        nav.classList.remove('scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    setupScrollObserver() {
        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    }

    setupModalBehavior() {
        // Click outside modal content to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('open');
                }
            });
        });

        // Escape key closes any open modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach(m => {
                    m.classList.remove('open');
                });
            }
        });
    }

    observeElements() {
        requestAnimationFrame(() => {
            document.querySelectorAll('.story-card, .fade-in').forEach(el => {
                if (!el.classList.contains('visible')) {
                    this.scrollObserver.observe(el);
                }
            });
        });
    }

    // ─── DATA LOADING ──────────────────────────

    async loadData() {
        try {
            const [peopleSnap, storiesSnap] = await Promise.all([
                window.firebaseGetDocs(
                    window.firebaseCollection(window.firebaseDb, 'people')
                ),
                window.firebaseGetDocs(
                    window.firebaseCollection(window.firebaseDb, 'stories')
                ).catch(() => ({ docs: [], forEach: () => {} }))
            ]);

            this.people = [];
            peopleSnap.forEach(doc => {
                this.people.push({ id: doc.id, ...doc.data() });
            });

            this.stories = [];
            storiesSnap.forEach(doc => {
                this.stories.push({ id: doc.id, ...doc.data() });
            });

            // Sort stories: those with sortOrder first (ascending), then by date descending
            this.stories.sort((a, b) => {
                const aHasOrder = a.sortOrder !== undefined;
                const bHasOrder = b.sortOrder !== undefined;
                if (aHasOrder && bHasOrder) return a.sortOrder - b.sortOrder;
                if (aHasOrder) return -1;
                if (bHasOrder) return 1;
                return (b.date || '').localeCompare(a.date || '');
            });

            // Sort people alphabetically by name
            this.people.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        } catch (err) {
            console.error('Error loading data:', err);
        }
    }

    // ─── DATA HELPERS ──────────────────────────

    getPerson(id) {
        return this.people.find(p => p.id === id);
    }

    getStoriesForPerson(personId) {
        return this.stories.filter(s =>
            s.peopleIds && s.peopleIds.includes(personId)
        );
    }

    getChildren(personId) {
        return this.people.filter(p =>
            p.fatherId === personId || p.motherId === personId
        );
    }

    getSiblings(personId) {
        const person = this.getPerson(personId);
        if (!person) return [];
        return this.people.filter(p =>
            p.id !== personId && (
                (person.fatherId && p.fatherId === person.fatherId) ||
                (person.motherId && p.motherId === person.motherId)
            )
        );
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ')
            .filter(w => w.length > 0)
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    formatDateRange(birth, death) {
        if (!birth && !death) return '';
        if (birth && death) return `${birth} \u2013 ${death}`;
        if (birth) return `b. ${birth}`;
        return `d. ${death}`;
    }

    // ─── ROUTING ───────────────────────────────

    navigate() {
        const hash = window.location.hash || '#/';
        const main = document.getElementById('mainContent');

        // Scroll to top on navigation
        window.scrollTo(0, 0);

        // Stop any playing audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (hash === '#/' || hash === '') {
                link.classList.remove('active');
            } else if (hash.startsWith(href) && href !== '#/') {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Route to the correct view
        if (hash === '#/' || hash === '' || hash === '#') {
            this.renderHome(main);
        } else if (hash === '#/stories') {
            this.renderStories(main);
        } else if (hash.startsWith('#/person/')) {
            const id = decodeURIComponent(hash.replace('#/person/', ''));
            this.renderPerson(main, id);
        } else if (hash === '#/family') {
            this.renderFamily(main);
        } else {
            this.renderHome(main);
        }
    }

    // ============================================
    //   HOME PAGE
    // ============================================

    renderHome(container) {
        this.currentView = 'home';

        const featuredStory = this.stories[0];
        const displayPeople = this.people.slice(0, 8);

        let html = `
            <section class="home-hero">
                <div class="home-hero-content">
                    <h1>Our Family Story</h1>
                    <div class="home-hero-actions">
                        <a href="#/stories" class="btn btn-primary">Read Our Stories</a>
                        <a href="#/family" class="btn btn-secondary">Meet the Family</a>
                    </div>
                </div>
                <div class="scroll-hint">
                    <span>Explore</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                </div>
            </section>
        `;

        // Featured Story section
        if (featuredStory) {
            const excerpt = this.truncate(featuredStory.narrative || '', 220);
            html += `
                <section class="home-section">
                    <div class="home-section-header">
                        <h2>Featured Story</h2>
                        <a href="#/stories">View all stories &rarr;</a>
                    </div>
                    <div class="featured-story fade-in">
                        <div class="featured-story-image">
                            ${featuredStory.coverPhotoUrl
                                ? `<img src="${featuredStory.coverPhotoUrl}" alt="${this.esc(featuredStory.title)}">`
                                : ''
                            }
                        </div>
                        <div class="featured-story-content">
                            <div class="featured-story-label">Featured</div>
                            <h3>${this.esc(featuredStory.title)}</h3>
                            ${featuredStory.date ? `<div class="featured-story-date">${this.esc(featuredStory.date)}</div>` : ''}
                            <p class="featured-story-excerpt">${excerpt}</p>
                            <a href="#/stories" class="btn btn-secondary btn-small">Read the story &rarr;</a>
                        </div>
                    </div>
                </section>
            `;
        }

        // Meet the Family section
        if (displayPeople.length > 0) {
            html += `
                <section class="home-section">
                    <div class="home-section-header">
                        <h2>The Family</h2>
                        <a href="#/family">View all &rarr;</a>
                    </div>
                    <div class="people-grid">
                        ${displayPeople.map(p => this.renderPersonThumb(p)).join('')}
                    </div>
                </section>
            `;
        }

        // Empty state when no content exists yet
        if (this.stories.length === 0 && this.people.length === 0) {
            html += `
                <section class="home-section">
                    <div class="empty-state">
                        <div class="empty-state-icon">&#10022;</div>
                        <h3>Your family story starts here</h3>
                        <p>Add your first family members and stories to begin building your family memoir.</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="btn btn-primary" onclick="app.openPersonModal()">Add a Person</button>
                            <button class="btn btn-secondary" onclick="app.openStoryModal()">Add a Story</button>
                        </div>
                    </div>
                </section>
            `;
        }

        container.innerHTML = html;
        this.observeElements();
    }

    renderPersonThumb(person) {
        const initials = this.getInitials(person.name);
        const dates = this.formatDateRange(person.birthDate, person.deathDate);

        return `
            <div class="person-thumb fade-in" onclick="window.location.hash='#/person/${encodeURIComponent(person.id)}'">
                <div class="person-thumb-avatar">
                    ${person.photoUrl
                        ? `<img src="${person.photoUrl}" alt="${this.esc(person.name)}">`
                        : initials
                    }
                </div>
                <div class="person-thumb-name">${this.esc(person.name)}</div>
                ${dates ? `<div class="person-thumb-dates">${this.esc(dates)}</div>` : ''}
            </div>
        `;
    }

    // ============================================
    //   STORIES PAGE
    // ============================================

    renderStories(container) {
        this.currentView = 'stories';

        let html = `
            <div class="stories-page">
                <div class="stories-header">
                    <h1>Our Stories</h1>
                    <p>The moments and memories that shaped our family</p>
                </div>
                <div class="stories-actions">
                    <button class="btn btn-accent btn-small" onclick="app.openStoryModal()">+ Add Story</button>
                </div>
        `;

        if (this.stories.length === 0) {
            html += `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128214;</div>
                    <h3>No stories yet</h3>
                    <p>Every family has stories worth telling. Add your first one &mdash; it could be a cherished memory, an immigration tale, or just a funny moment at the dinner table.</p>
                    <button class="btn btn-primary" onclick="app.openStoryModal()">Tell a Story</button>
                </div>
            `;
        } else {
            html += this.stories.map(s => this.renderStoryCard(s)).join('');
        }

        html += `</div>`;
        container.innerHTML = html;
        this.observeElements();
    }

    renderStoryCard(story) {
        const taggedPeople = (story.peopleIds || [])
            .map(id => this.getPerson(id))
            .filter(Boolean);

        const metaParts = [];
        if (story.date) metaParts.push(`<span>${this.esc(story.date)}</span>`);
        if (story.location) metaParts.push(`<span>${this.esc(story.location)}</span>`);

        const narrativeHtml = (story.narrative || '')
            .split('\n')
            .filter(p => p.trim())
            .map(p => `<p>${this.esc(p)}</p>`)
            .join('');

        return `
            <article class="story-card">
                ${story.coverPhotoUrl
                    ? `<div class="story-card-image"><img src="${story.coverPhotoUrl}" alt="${this.esc(story.title)}"></div>`
                    : `<div class="story-card-image no-image"></div>`
                }
                <div class="story-card-body">
                    ${metaParts.length ? `<div class="story-card-meta">${metaParts.join('')}</div>` : ''}
                    <h2>${this.esc(story.title)}</h2>
                    <div class="story-card-narrative">${narrativeHtml}</div>
                    ${story.audioUrl ? this.renderAudioPlayer(story) : ''}
                    ${taggedPeople.length > 0 ? `
                        <div class="story-people">
                            <span class="story-people-label">People in this story:</span>
                            ${taggedPeople.map(p => this.renderPersonTag(p)).join('')}
                        </div>
                    ` : ''}
                    <div class="story-card-actions">
                        <button class="story-action-btn" onclick="app.openStoryModal('${story.id}')">Edit</button>
                        <button class="story-action-btn" onclick="app.deleteStory('${story.id}')">Delete</button>
                    </div>
                </div>
            </article>
        `;
    }

    renderPersonTag(person) {
        const initials = this.getInitials(person.name);
        return `
            <a href="#/person/${encodeURIComponent(person.id)}" class="person-tag">
                <span class="person-tag-avatar">
                    ${person.photoUrl
                        ? `<img src="${person.photoUrl}" alt="">`
                        : initials
                    }
                </span>
                ${this.esc(person.name)}
            </a>
        `;
    }

    // ─── AUDIO PLAYER ──────────────────────────

    renderAudioPlayer(story) {
        const aid = `audio-${story.id}`;
        return `
            <div class="story-audio">
                <button class="audio-play-btn" onclick="app.toggleAudio('${aid}')">
                    <svg id="${aid}-icon" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
                <div class="audio-info">
                    <div class="audio-label">Listen to this story</div>
                    ${(story.audioToldBy || story.audioRecordedBy) ? `
                        <div class="audio-credits">
                            ${story.audioToldBy ? `Told by ${this.esc(story.audioToldBy)}` : ''}
                            ${story.audioToldBy && story.audioRecordedBy ? ' &middot; ' : ''}
                            ${story.audioRecordedBy ? `Recorded by ${this.esc(story.audioRecordedBy)}` : ''}
                        </div>
                    ` : ''}
                    <div class="audio-progress">
                        <div class="audio-progress-bar" id="${aid}-progress"></div>
                    </div>
                </div>
                <span class="audio-time" id="${aid}-time">0:00</span>
                <audio id="${aid}" src="${story.audioUrl}" preload="none"></audio>
            </div>
        `;
    }

    toggleAudio(audioId) {
        const audio = document.getElementById(audioId);
        const icon = document.getElementById(`${audioId}-icon`);
        const progress = document.getElementById(`${audioId}-progress`);
        const timeEl = document.getElementById(`${audioId}-time`);
        if (!audio) return;

        // Stop any other currently playing audio
        if (this.currentAudio && this.currentAudio !== audio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            const prevId = this.currentAudio.id;
            const prevIcon = document.getElementById(`${prevId}-icon`);
            const prevProgress = document.getElementById(`${prevId}-progress`);
            const prevTime = document.getElementById(`${prevId}-time`);
            if (prevIcon) prevIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
            if (prevProgress) prevProgress.style.width = '0%';
            if (prevTime) prevTime.textContent = '0:00';
        }

        if (audio.paused) {
            audio.play();
            icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            this.currentAudio = audio;

            audio.ontimeupdate = () => {
                if (audio.duration) {
                    const pct = (audio.currentTime / audio.duration) * 100;
                    if (progress) progress.style.width = pct + '%';
                    if (timeEl) timeEl.textContent = this.formatTime(audio.currentTime);
                }
            };

            audio.onended = () => {
                icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
                if (progress) progress.style.width = '0%';
                if (timeEl) timeEl.textContent = '0:00';
                this.currentAudio = null;
            };
        } else {
            audio.pause();
            icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
            this.currentAudio = null;
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ============================================
    //   PERSON PAGE
    // ============================================

    renderPerson(container, personId) {
        this.currentView = 'person';
        const person = this.getPerson(personId);

        if (!person) {
            container.innerHTML = `
                <div class="person-page">
                    <div class="empty-state" style="padding-top:140px;">
                        <div class="empty-state-icon">&#128269;</div>
                        <h3>Person not found</h3>
                        <p>We couldn't find this person in the family.</p>
                        <a href="#/" class="btn btn-secondary">Go Home</a>
                    </div>
                </div>
            `;
            return;
        }

        const initials = this.getInitials(person.name);
        const dates = this.formatDateRange(person.birthDate, person.deathDate);
        const stories = this.getStoriesForPerson(personId);
        const children = this.getChildren(personId);
        const siblings = this.getSiblings(personId);
        const father = person.fatherId ? this.getPerson(person.fatherId) : null;
        const mother = person.motherId ? this.getPerson(person.motherId) : null;
        const spouses = (person.spouseIds || []).map(id => this.getPerson(id)).filter(Boolean);

        const timelineEvents = this.getTimelineEvents(person);
        const photos = person.photos || [];
        const hasRichContent = person.biography || stories.length > 0 || person.photoUrl || timelineEvents.length > 0 || photos.length > 0 || (person.documents && person.documents.length > 0);
        const connectionsHtml = this.buildConnectionsText(person, father, mother, spouses, children, siblings);

        let html = `
            <div class="person-page">
                <section class="person-hero">
                    <div class="person-hero-bg ${person.photoUrl ? '' : 'no-photo'}">
                        ${person.photoUrl ? `<img src="${person.photoUrl}" alt="">` : ''}
                    </div>
                    <div class="person-hero-content">
                        <div class="person-avatar-large">
                            ${person.photoUrl
                                ? `<img src="${person.photoUrl}" alt="${this.esc(person.name)}">`
                                : initials
                            }
                        </div>
                        <h1>${this.esc(person.name)}</h1>
                        ${dates ? `<div class="person-dates">${this.esc(dates)}</div>` : ''}
                        ${person.birthPlace ? `<div class="person-birthplace">${this.esc(person.birthPlace)}</div>` : ''}
                    </div>
                </section>

                <div class="person-body">
        `;

        // Biography
        if (person.biography) {
            const bioParagraphs = person.biography
                .split('\n').filter(p => p.trim())
                .map(p => `<p>${this.esc(p)}</p>`).join('');
            html += `
                <section class="person-section fade-in">
                    <div class="person-section-title">About</div>
                    <div class="person-biography">${bioParagraphs}</div>
                </section>
            `;
        }

        // Life events timeline
        if (timelineEvents.length > 0) {
            html += `
                <section class="person-section fade-in">
                    <div class="person-section-title">Life Events</div>
                    <div class="person-timeline">
                        ${timelineEvents.map(e => this.renderTimelineEvent(e)).join('')}
                    </div>
                </section>
            `;
        }

        // Photo gallery
        if (photos.length > 0) {
            html += `
                <section class="person-section fade-in">
                    <div class="person-section-title">Photos</div>
                    <div class="person-photos-grid">
                        ${photos.map(p => `
                            <div class="person-photo-item">
                                <img src="${p.url}" alt="${this.esc(p.caption || '')}">
                                ${p.caption ? `<div class="person-photo-caption">${this.esc(p.caption)}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        // Documents & records
        const docs = person.documents || [];
        if (docs.length > 0) {
            html += `
                <section class="person-section fade-in">
                    <div class="person-section-title">Documents &amp; Records</div>
                    <div class="person-documents">
                        ${docs.map(d => `
                            <a href="${this.esc(d.url)}" target="_blank" rel="noopener" class="document-link">
                                <span class="document-icon">${this.getDocIcon(d.type)}</span>
                                <span class="document-info">
                                    <span class="document-label">${this.esc(d.label)}</span>
                                    ${d.description ? `<span class="document-desc">${this.esc(d.description)}</span>` : ''}
                                </span>
                                <span class="document-external">&#8599;</span>
                            </a>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        // Family connections as natural readable text
        if (connectionsHtml) {
            html += `
                <section class="person-section fade-in">
                    <div class="person-section-title">Family</div>
                    <div class="family-connections">${connectionsHtml}</div>
                </section>
            `;
        }

        // Stories featuring this person
        if (stories.length > 0) {
            html += `
                <section class="person-section fade-in">
                    <div class="person-section-title">Their Stories</div>
                    <div class="person-stories-list">
                        ${stories.map(s => this.renderStoryCard(s)).join('')}
                    </div>
                </section>
            `;
        }

        // Relationship finder
        html += this.renderRelationshipFinder(personId);

        // Warm "beginning" treatment for minimal-content pages
        if (!hasRichContent && !connectionsHtml) {
            const firstName = this.esc((person.name || '').split(' ')[0] || 'This person');
            html += `
                <div class="person-beginning fade-in">
                    <div class="person-beginning-ornament">&#10022;</div>
                    <p class="person-beginning-text">
                        ${firstName}'s story is just beginning.<br>
                        Every detail you add helps keep their memory alive.
                    </p>
                    <button class="btn btn-secondary btn-small" onclick="app.openPersonModal('${person.id}')">
                        Add to their story
                    </button>
                </div>
            `;
        }

        // Edit button
        html += `
                    <div class="person-actions fade-in">
                        <button class="btn btn-secondary btn-small" onclick="app.openPersonModal('${person.id}')">Edit</button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.observeElements();
    }

    buildConnectionsText(person, father, mother, spouses, children, siblings) {
        const parts = [];

        // Parents
        if (father || mother) {
            let text = 'Child of ';
            if (father && mother) {
                text += `<a href="#/person/${encodeURIComponent(father.id)}">${this.esc(father.name)}</a>`;
                text += ` and <a href="#/person/${encodeURIComponent(mother.id)}">${this.esc(mother.name)}</a>.`;
            } else if (father) {
                text += `<a href="#/person/${encodeURIComponent(father.id)}">${this.esc(father.name)}</a>.`;
            } else {
                text += `<a href="#/person/${encodeURIComponent(mother.id)}">${this.esc(mother.name)}</a>.`;
            }
            parts.push(`<p>${text}</p>`);
        }

        // Spouses (with divorce awareness)
        if (spouses.length > 0) {
            spouses.forEach(s => {
                const link = `<a href="#/person/${encodeURIComponent(s.id)}">${this.esc(s.name)}</a>`;
                const status = this.getMarriageStatus(person.id, s.id);
                if (status === 'divorced') {
                    parts.push(`<p>Formerly married to ${link}.</p>`);
                } else {
                    parts.push(`<p>Married ${link}.</p>`);
                }
            });
        }

        // Children
        if (children.length > 0) {
            const links = children.map(c =>
                `<a href="#/person/${encodeURIComponent(c.id)}">${this.esc(c.name)}</a>`
            );
            parts.push(`<p>Parent of ${this.naturalJoin(links)}.</p>`);
        }

        // Siblings
        if (siblings.length > 0) {
            const links = siblings.map(s =>
                `<a href="#/person/${encodeURIComponent(s.id)}">${this.esc(s.name)}</a>`
            );
            parts.push(`<p>Sibling of ${this.naturalJoin(links)}.</p>`);
        }

        return parts.join('');
    }

    naturalJoin(items) {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0];
        if (items.length === 2) return `${items[0]} and ${items[1]}`;
        return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
    }

    getMarriageStatus(personId, spouseId) {
        const person = this.getPerson(personId);
        if (!person || !person.marriages) return 'married';
        const entry = person.marriages.find(m => m.spouseId === spouseId);
        return entry ? (entry.status || 'married') : 'married';
    }

    // ─── LIFE EVENTS TIMELINE ──────────────────

    getTimelineEvents(person) {
        return (person.events || [])
            .filter(e => e.type !== 'birth' && e.type !== 'death')
            .filter(e => e.date || e.location || e.description)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }

    renderTimelineEvent(event) {
        const typeLabels = {
            baptism: 'Baptism',
            burial: 'Burial',
            immigration: 'Immigration',
            arrival: 'Arrival',
            naturalization: 'Naturalization',
            residence: 'Residence',
            occupation: 'Occupation',
            military: 'Military Service',
            draft: 'Draft Registration',
            graduation: 'Graduation',
            marriage: 'Marriage',
            divorce: 'Divorce',
            census: 'Census',
            confirmation: 'Confirmation',
            communion: 'Communion',
            ordination: 'Ordination',
            adoption: 'Adoption',
            retirement: 'Retirement',
            other: 'Event'
        };
        const label = typeLabels[event.type] || this.esc(event.type || 'Event');
        const date = event.date ? this.formatEventDate(event.date) : '';
        const location = event.location ? this.esc(event.location) : '';
        const description = event.description ? this.esc(event.description) : '';

        return `
            <div class="timeline-event">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-type">${label}</div>
                    ${date ? `<div class="timeline-date">${date}</div>` : ''}
                    ${location ? `<div class="timeline-location">${location}</div>` : ''}
                    ${description ? `<div class="timeline-description">${description}</div>` : ''}
                </div>
            </div>
        `;
    }

    formatEventDate(dateStr) {
        if (!dateStr) return '';
        // Handle ISO dates like "1918-03-31"
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const year = parts[0];
            const monthIdx = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (months[monthIdx]) {
                return `${months[monthIdx]} ${day}, ${year}`;
            }
        }
        // Handle partial dates like "1918" or "1918-03"
        if (parts.length === 2) {
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const monthIdx = parseInt(parts[1], 10) - 1;
            if (months[monthIdx]) {
                return `${months[monthIdx]} ${parts[0]}`;
            }
        }
        // Return as-is for other formats (decades, descriptive dates)
        return this.esc(dateStr);
    }

    // ============================================
    //   FAMILY PAGE
    // ============================================

    renderFamily(container) {
        this.currentView = 'family';

        let html = `
            <div class="family-page">
                <div class="family-header">
                    <h1>The Family</h1>
                    <p>Explore the branches of our family tree</p>
                </div>
                <div class="family-actions">
                    <button class="btn btn-accent btn-small" onclick="app.openPersonModal()">+ Add Person</button>
                </div>
        `;

        if (this.people.length === 0) {
            html += `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128106;</div>
                    <h3>No family members yet</h3>
                    <p>Start by adding the people who matter most &mdash; parents, grandparents, the ones whose stories you want to remember.</p>
                    <button class="btn btn-primary" onclick="app.openPersonModal()">Add Someone</button>
                </div>
            `;
        } else {
            const branches = this.groupByBranch();
            for (const [branchName, members] of Object.entries(branches)) {
                html += this.renderFamilyBranch(branchName, members);
            }
        }

        html += `</div>`;
        container.innerHTML = html;
        this.observeElements();
    }

    groupByBranch() {
        const branches = {};

        this.people.forEach(person => {
            const branchStr = person.branch || 'Family';
            // Support comma-separated branches (e.g., "Miller, Gioielli")
            const branchList = branchStr.split(',').map(b => b.trim()).filter(Boolean);
            branchList.forEach(branch => {
                if (!branches[branch]) branches[branch] = [];
                branches[branch].push(person);
            });
        });

        // Sort each branch into family-tree order
        for (const branch of Object.keys(branches)) {
            branches[branch] = this.orderByGeneration(branches[branch]);
        }

        return branches;
    }

    orderByGeneration(people) {
        const peopleIds = new Set(people.map(p => p.id));

        // Find roots: people whose parents are NOT in this group
        const roots = people.filter(p =>
            (!p.fatherId || !peopleIds.has(p.fatherId)) &&
            (!p.motherId || !peopleIds.has(p.motherId))
        );

        const ordered = [];
        const visited = new Set();

        const walk = (person, indent) => {
            if (visited.has(person.id)) return;
            visited.add(person.id);
            ordered.push({ ...person, _indent: indent });

            // Add spouse(s) at the same indent level
            if (person.spouseIds) {
                person.spouseIds.forEach(sid => {
                    const spouse = people.find(p => p.id === sid);
                    if (spouse && !visited.has(spouse.id)) {
                        visited.add(spouse.id);
                        const isDivorced = this.getMarriageStatus(person.id, sid) === 'divorced';
                        ordered.push({ ...spouse, _indent: indent, _isSpouse: true, _isDivorced: isDivorced });
                    }
                });
            }

            // Add children indented one level
            const kids = people.filter(p =>
                p.fatherId === person.id || p.motherId === person.id
            );
            kids.sort((a, b) => (a.birthDate || '').localeCompare(b.birthDate || ''));
            kids.forEach(child => walk(child, indent + 1));
        };

        // Sort roots: prefer those with more descendants for better tree structure
        const countDesc = (person) => {
            const seen = new Set();
            const stack = [person.id];
            while (stack.length > 0) {
                const pid = stack.pop();
                people.forEach(p => {
                    if (!seen.has(p.id) && (p.fatherId === pid || p.motherId === pid)) {
                        seen.add(p.id);
                        stack.push(p.id);
                    }
                });
            }
            return seen.size;
        };
        roots.sort((a, b) => {
            const diff = countDesc(b) - countDesc(a);
            return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
        });

        // Walk from each root
        roots.forEach(root => walk(root, 0));

        // Add anyone not visited (no family links to others in group)
        people.forEach(p => {
            if (!visited.has(p.id)) {
                ordered.push({ ...p, _indent: 0 });
            }
        });

        return ordered;
    }

    renderFamilyBranch(branchName, members) {
        let html = `
            <div class="family-branch fade-in">
                <div class="family-branch-header">
                    <h2>${this.esc(branchName)}</h2>
                    <div class="family-branch-line"></div>
                </div>
        `;

        members.forEach(person => {
            const indent = Math.min(person._indent || 0, 4);
            const initials = this.getInitials(person.name);
            const dates = this.formatDateRange(person.birthDate, person.deathDate);

            html += `
                <div class="family-member${indent > 0 ? ` family-member-indent-${indent}` : ''}"
                     onclick="window.location.hash='#/person/${encodeURIComponent(person.id)}'">
                    ${indent > 0 ? `<span class="family-member-connector">${person._isSpouse ? '\u2665' : '\u2514'}</span>` : ''}
                    <div class="family-member-avatar">
                        ${person.photoUrl
                            ? `<img src="${person.photoUrl}" alt="">`
                            : initials
                        }
                    </div>
                    <div class="family-member-info">
                        <div class="family-member-name">${this.esc(person.name)}</div>
                        ${dates ? `<div class="family-member-detail">${this.esc(dates)}</div>` : ''}
                        ${person._isSpouse ? `<div class="family-member-spouse${person._isDivorced ? ' divorced' : ''}">${person._isDivorced ? 'former spouse' : 'spouse'}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    // ============================================
    //   STORY MODAL
    // ============================================

    openStoryModal(editId = null) {
        const modal = document.getElementById('storyModal');
        const form = document.getElementById('storyForm');
        const title = document.getElementById('storyModalTitle');

        form.reset();
        document.getElementById('storyEditId').value = '';
        document.getElementById('coverPhotoPreview').innerHTML = '';

        // Populate the people picker
        this.populateStoryPeoplePicker();

        if (editId) {
            const story = this.stories.find(s => s.id === editId);
            if (story) {
                title.textContent = 'Edit Story';
                document.getElementById('storyEditId').value = editId;
                document.getElementById('storyTitle').value = story.title || '';
                document.getElementById('storyDate').value = story.date || '';
                document.getElementById('storyLocation').value = story.location || '';
                document.getElementById('storyNarrative').value = story.narrative || '';
                document.getElementById('storyToldBy').value = story.audioToldBy || '';
                document.getElementById('storyRecordedBy').value = story.audioRecordedBy || '';

                if (story.coverPhotoUrl) {
                    document.getElementById('coverPhotoPreview').innerHTML =
                        `<img src="${story.coverPhotoUrl}" alt="Cover preview">`;
                }

                // Pre-select tagged people
                (story.peopleIds || []).forEach(pid => {
                    const chip = document.querySelector(`#storyPeoplePicker [data-person-id="${pid}"]`);
                    if (chip) chip.classList.add('selected');
                });
            }
        } else {
            title.textContent = 'Add Story';
        }

        modal.classList.add('open');
    }

    closeStoryModal() {
        document.getElementById('storyModal').classList.remove('open');
    }

    populateStoryPeoplePicker() {
        const picker = document.getElementById('storyPeoplePicker');
        if (!picker) return;
        picker.innerHTML = this.people.map(p => `
            <span class="people-picker-chip" data-person-id="${p.id}"
                  onclick="this.classList.toggle('selected')">
                ${this.esc(p.name)}
            </span>
        `).join('');
    }

    async handleStorySubmit(event) {
        event.preventDefault();

        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving\u2026';

        try {
            const editId = document.getElementById('storyEditId').value;
            const storyId = editId || `story-${Date.now()}`;

            const selectedPeople = Array.from(
                document.querySelectorAll('#storyPeoplePicker .selected')
            ).map(chip => chip.dataset.personId);

            const storyData = {
                title: document.getElementById('storyTitle').value.trim(),
                date: document.getElementById('storyDate').value.trim(),
                location: document.getElementById('storyLocation').value.trim(),
                narrative: document.getElementById('storyNarrative').value.trim(),
                audioToldBy: document.getElementById('storyToldBy').value.trim(),
                audioRecordedBy: document.getElementById('storyRecordedBy').value.trim(),
                peopleIds: selectedPeople,
                updatedAt: new Date().toISOString()
            };

            if (!editId) {
                storyData.createdAt = new Date().toISOString();
            }

            // Upload cover photo if provided
            const coverFile = document.getElementById('storyCoverPhoto').files[0];
            if (coverFile) {
                const url = await this.uploadFile(coverFile, `stories/${storyId}/cover`);
                storyData.coverPhotoUrl = url;
            }

            // Upload audio if provided
            const audioFile = document.getElementById('storyAudio').files[0];
            if (audioFile) {
                const url = await this.uploadFile(audioFile, `stories/${storyId}/audio`);
                storyData.audioUrl = url;
            }

            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'stories', storyId),
                storyData,
                { merge: true }
            );

            this.closeStoryModal();
            await this.loadData();
            this.navigate();

        } catch (err) {
            console.error('Error saving story:', err);
            alert('Error saving story. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Story';
        }
    }

    async deleteStory(storyId) {
        if (!confirm('Are you sure you want to delete this story? This cannot be undone.')) return;

        try {
            await window.firebaseDeleteDoc(
                window.firebaseDoc(window.firebaseDb, 'stories', storyId)
            );
            await this.loadData();
            this.navigate();
        } catch (err) {
            console.error('Error deleting story:', err);
            alert('Error deleting story. Please try again.');
        }
    }

    // ============================================
    //   PERSON MODAL
    // ============================================

    openPersonModal(editId = null) {
        const modal = document.getElementById('personModal');
        const form = document.getElementById('personForm');
        const title = document.getElementById('personModalTitle');

        form.reset();
        document.getElementById('personEditId').value = '';
        document.getElementById('personPhotoPreview').innerHTML = '';

        this.populateParentSelects(editId);
        this.populateSpousePicker(editId);

        // Clear events and photos and documents editors
        this._pendingPhotos = [];
        document.getElementById('eventsEditor').innerHTML = '';
        document.getElementById('photosEditor').innerHTML = '';
        document.getElementById('documentsEditor').innerHTML = '';

        if (editId) {
            const person = this.getPerson(editId);
            if (person) {
                title.textContent = 'Edit Person';
                document.getElementById('personEditId').value = editId;
                document.getElementById('personName').value = person.name || '';
                document.getElementById('personBirthDate').value = person.birthDate || '';
                document.getElementById('personDeathDate').value = person.deathDate || '';
                document.getElementById('personBirthPlace').value = person.birthPlace || '';
                document.getElementById('personBiography').value = person.biography || '';
                document.getElementById('personBranch').value = person.branch || '';
                document.getElementById('personFather').value = person.fatherId || '';
                document.getElementById('personMother').value = person.motherId || '';

                if (person.photoUrl) {
                    document.getElementById('personPhotoPreview').innerHTML =
                        `<img src="${person.photoUrl}" alt="Photo preview">`;
                }

                // Pre-select spouses with marriage status
                (person.spouseIds || []).forEach(sid => {
                    const chip = document.querySelector(`#spousePicker [data-person-id="${sid}"]`);
                    if (chip) {
                        chip.classList.add('selected');
                        const status = this.getMarriageStatus(person.id, sid);
                        chip.dataset.status = status;
                        if (status === 'divorced') {
                            chip.classList.add('divorced');
                        }
                    }
                });

                // Populate existing events
                (person.events || []).forEach(e => this.addEventRow(e));

                // Show existing additional photos
                this._pendingPhotos = [...(person.photos || [])];
                this.renderPhotosEditor();

                // Populate existing documents
                (person.documents || []).forEach(d => this.addDocumentRow(d));
            }
        } else {
            title.textContent = 'Add Person';
        }

        modal.classList.add('open');
    }

    closePersonModal() {
        document.getElementById('personModal').classList.remove('open');
    }

    populateParentSelects(excludeId) {
        const fatherSelect = document.getElementById('personFather');
        const motherSelect = document.getElementById('personMother');

        const options = this.people
            .filter(p => p.id !== excludeId)
            .map(p => `<option value="${p.id}">${this.esc(p.name)}</option>`)
            .join('');

        fatherSelect.innerHTML = `<option value="">Father...</option>${options}`;
        motherSelect.innerHTML = `<option value="">Mother...</option>${options}`;
    }

    populateSpousePicker(excludeId) {
        const picker = document.getElementById('spousePicker');
        if (!picker) return;
        picker.innerHTML = this.people
            .filter(p => p.id !== excludeId)
            .map(p => `
                <span class="people-picker-chip" data-person-id="${p.id}" data-status=""
                      onclick="app.cycleSpouseStatus(this)">
                    ${this.esc(p.name)}
                </span>
            `).join('');
    }

    cycleSpouseStatus(chip) {
        const current = chip.dataset.status || '';
        if (current === '') {
            // Not selected → married
            chip.classList.add('selected');
            chip.dataset.status = 'married';
        } else if (current === 'married') {
            // Married → divorced
            chip.classList.add('divorced');
            chip.dataset.status = 'divorced';
        } else {
            // Divorced → unselected
            chip.classList.remove('selected', 'divorced');
            chip.dataset.status = '';
        }
    }

    async handlePersonSubmit(event) {
        event.preventDefault();

        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving\u2026';

        try {
            const editId = document.getElementById('personEditId').value;
            const personId = editId || `p${Date.now()}`;

            const selectedSpouseChips = Array.from(
                document.querySelectorAll('#spousePicker .selected')
            );
            const selectedSpouses = selectedSpouseChips.map(chip => chip.dataset.personId);
            const marriages = selectedSpouseChips.map(chip => ({
                spouseId: chip.dataset.personId,
                status: chip.dataset.status || 'married'
            }));

            // Gather events from editor
            const events = this.gatherEventsFromEditor();

            // Gather documents from editor
            const documents = this.gatherDocumentsFromEditor();

            const personData = {
                name: document.getElementById('personName').value.trim(),
                birthDate: document.getElementById('personBirthDate').value.trim(),
                deathDate: document.getElementById('personDeathDate').value.trim(),
                birthPlace: document.getElementById('personBirthPlace').value.trim(),
                biography: document.getElementById('personBiography').value.trim(),
                branch: document.getElementById('personBranch').value.trim(),
                fatherId: document.getElementById('personFather').value || null,
                motherId: document.getElementById('personMother').value || null,
                spouseIds: selectedSpouses,
                marriages: marriages,
                events: events,
                documents: documents,
                photos: this._pendingPhotos || [],
                updatedAt: new Date().toISOString()
            };

            if (!editId) {
                personData.createdAt = new Date().toISOString();
            }

            // Upload primary photo if provided
            const photoFile = document.getElementById('personPhoto').files[0];
            if (photoFile) {
                const url = await this.uploadFile(photoFile, `people/${personId}/photo`);
                personData.photoUrl = url;
            }

            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'people', personId),
                personData,
                { merge: true }
            );

            // Update reciprocal spouse references
            for (const spouseId of selectedSpouses) {
                const spouse = this.getPerson(spouseId);
                if (spouse) {
                    const existing = new Set(spouse.spouseIds || []);
                    existing.add(personId);
                    await window.firebaseSetDoc(
                        window.firebaseDoc(window.firebaseDb, 'people', spouseId),
                        { spouseIds: Array.from(existing) },
                        { merge: true }
                    );
                }
            }

            this.closePersonModal();
            await this.loadData();
            this.navigate();

        } catch (err) {
            console.error('Error saving person:', err);
            alert('Error saving person. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Person';
        }
    }

    // ─── EVENTS EDITOR ─────────────────────────

    addEventRow(existing = null) {
        const editor = document.getElementById('eventsEditor');
        if (!editor) return;

        const row = document.createElement('div');
        row.className = 'event-row';
        row.innerHTML = `
            <div class="form-row" style="margin-bottom:8px;align-items:flex-start">
                <select class="form-group-half event-type">
                    <option value="">Type...</option>
                    <option value="baptism">Baptism</option>
                    <option value="communion">Communion</option>
                    <option value="confirmation">Confirmation</option>
                    <option value="graduation">Graduation</option>
                    <option value="marriage">Marriage</option>
                    <option value="divorce">Divorce</option>
                    <option value="occupation">Occupation</option>
                    <option value="military">Military Service</option>
                    <option value="draft">Draft Registration</option>
                    <option value="immigration">Immigration</option>
                    <option value="arrival">Arrival</option>
                    <option value="naturalization">Naturalization</option>
                    <option value="residence">Residence</option>
                    <option value="census">Census</option>
                    <option value="adoption">Adoption</option>
                    <option value="ordination">Ordination</option>
                    <option value="retirement">Retirement</option>
                    <option value="burial">Burial</option>
                    <option value="other">Other</option>
                </select>
                <input type="text" class="form-group-half event-date" placeholder="Date (e.g., 1918-03-31)">
            </div>
            <div class="form-row" style="margin-bottom:12px;align-items:flex-start">
                <input type="text" class="form-group-half event-location" placeholder="Location">
                <div class="form-group-half" style="display:flex;gap:8px;align-items:center">
                    <input type="text" style="flex:1" class="event-description" placeholder="Description (optional)">
                    <button type="button" class="story-action-btn" onclick="this.closest('.event-row').remove()" title="Remove">&times;</button>
                </div>
            </div>
        `;

        // Pre-fill if editing existing event
        if (existing) {
            row.querySelector('.event-type').value = existing.type || '';
            row.querySelector('.event-date').value = existing.date || '';
            row.querySelector('.event-location').value = existing.location || '';
            row.querySelector('.event-description').value = existing.description || '';
        }

        editor.appendChild(row);
    }

    gatherEventsFromEditor() {
        const rows = document.querySelectorAll('#eventsEditor .event-row');
        const events = [];
        rows.forEach((row, i) => {
            const type = row.querySelector('.event-type').value;
            const date = row.querySelector('.event-date').value.trim();
            const location = row.querySelector('.event-location').value.trim();
            const description = row.querySelector('.event-description').value.trim();
            if (type || date || location) {
                events.push({
                    id: `e_${Date.now()}_${i}`,
                    type: type || 'other',
                    date,
                    location,
                    description
                });
            }
        });
        return events;
    }

    // ─── PHOTOS EDITOR ─────────────────────────

    async addPhotoToEditor() {
        const fileInput = document.getElementById('additionalPhoto');
        const captionInput = document.getElementById('additionalPhotoCaption');
        const file = fileInput.files[0];
        if (!file) return;

        const editId = document.getElementById('personEditId').value;
        const personId = editId || `p${Date.now()}`;

        try {
            const url = await this.uploadFile(file, `people/${personId}/photos/${Date.now()}`);
            if (!this._pendingPhotos) this._pendingPhotos = [];
            this._pendingPhotos.push({
                url,
                caption: captionInput.value.trim(),
                uploadedAt: new Date().toISOString()
            });
            this.renderPhotosEditor();
            fileInput.value = '';
            captionInput.value = '';
        } catch (err) {
            console.error('Error uploading photo:', err);
            alert('Error uploading photo. Please try again.');
        }
    }

    renderPhotosEditor() {
        const container = document.getElementById('photosEditor');
        if (!container) return;
        if (!this._pendingPhotos || this._pendingPhotos.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = this._pendingPhotos.map((p, i) => `
            <div class="photo-editor-item" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <img src="${p.url}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:6px">
                <span style="flex:1;font-size:0.85rem;color:var(--text-light)">${this.esc(p.caption) || 'No caption'}</span>
                <button type="button" class="story-action-btn" onclick="app.removeEditorPhoto(${i})">&times;</button>
            </div>
        `).join('');
    }

    removeEditorPhoto(index) {
        if (this._pendingPhotos) {
            this._pendingPhotos.splice(index, 1);
            this.renderPhotosEditor();
        }
    }

    // ─── DOCUMENT HELPERS ────────────────────────

    getDocIcon(type) {
        const icons = {
            census: '📋',
            immigration: '🚢',
            military: '🎖️',
            certificate: '📜',
            photo: '📷',
            newspaper: '📰',
            letter: '✉️',
            legal: '⚖️',
            religious: '✝️',
            other: '📄'
        };
        return icons[type] || icons.other;
    }

    // ─── DOCUMENTS EDITOR ───────────────────────

    addDocumentRow(existing = null) {
        const editor = document.getElementById('documentsEditor');
        if (!editor) return;

        const row = document.createElement('div');
        row.className = 'document-row';
        row.innerHTML = `
            <div class="form-row" style="margin-bottom:8px;align-items:flex-start">
                <input type="text" class="doc-label" placeholder="Label (e.g., 1920 Census)" style="flex:1">
                <select class="doc-type" style="width:130px">
                    <option value="other">Type...</option>
                    <option value="census">Census</option>
                    <option value="immigration">Immigration</option>
                    <option value="military">Military</option>
                    <option value="certificate">Certificate</option>
                    <option value="photo">Photo</option>
                    <option value="newspaper">Newspaper</option>
                    <option value="letter">Letter</option>
                    <option value="legal">Legal</option>
                    <option value="religious">Religious</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-row" style="margin-bottom:12px;align-items:flex-start">
                <input type="text" class="doc-url" placeholder="URL (Google Drive share link, etc.)" style="flex:1">
                <div style="display:flex;gap:8px;align-items:center">
                    <input type="text" class="doc-description" placeholder="Note (optional)" style="width:160px">
                    <button type="button" class="story-action-btn" onclick="this.closest('.document-row').remove()" title="Remove">&times;</button>
                </div>
            </div>
        `;

        if (existing) {
            row.querySelector('.doc-label').value = existing.label || '';
            row.querySelector('.doc-type').value = existing.type || 'other';
            row.querySelector('.doc-url').value = existing.url || '';
            row.querySelector('.doc-description').value = existing.description || '';
        }

        editor.appendChild(row);
    }

    gatherDocumentsFromEditor() {
        const rows = document.querySelectorAll('#documentsEditor .document-row');
        const documents = [];
        rows.forEach((row, i) => {
            const label = row.querySelector('.doc-label').value.trim();
            const type = row.querySelector('.doc-type').value;
            const url = row.querySelector('.doc-url').value.trim();
            const description = row.querySelector('.doc-description').value.trim();
            if (label && url) {
                documents.push({
                    id: `d_${Date.now()}_${i}`,
                    label,
                    type: type || 'other',
                    url,
                    description
                });
            }
        });
        return documents;
    }

    // ─── RELATIONSHIP CALCULATOR ────────────────

    findRelationship(personId1, personId2) {
        if (personId1 === personId2) return 'This is the same person!';

        // BFS to find the path between two people through parent/child/spouse links
        const visited = new Set();
        const queue = [{ id: personId1, path: [{ id: personId1, rel: 'start' }] }];
        visited.add(personId1);

        while (queue.length > 0) {
            const { id, path } = queue.shift();
            const person = this.getPerson(id);
            if (!person) continue;

            // Don't search too deep
            if (path.length > 20) continue;

            const neighbors = [];

            // Parents
            if (person.fatherId) neighbors.push({ id: person.fatherId, rel: 'parent' });
            if (person.motherId) neighbors.push({ id: person.motherId, rel: 'parent' });

            // Children
            const children = this.getChildren(id);
            children.forEach(c => neighbors.push({ id: c.id, rel: 'child' }));

            // Spouses
            (person.spouseIds || []).forEach(sid => neighbors.push({ id: sid, rel: 'spouse' }));

            for (const neighbor of neighbors) {
                if (visited.has(neighbor.id)) continue;
                visited.add(neighbor.id);

                const newPath = [...path, { id: neighbor.id, rel: neighbor.rel }];

                if (neighbor.id === personId2) {
                    return this.describeRelationship(newPath);
                }

                queue.push({ id: neighbor.id, path: newPath });
            }
        }

        return 'No known family connection found.';
    }

    describeRelationship(path) {
        // Build a sequence of moves: 'parent', 'child', 'spouse'
        const moves = path.slice(1).map(p => p.rel);
        const person1 = this.getPerson(path[0].id);
        const person2 = this.getPerson(path[path.length - 1].id);
        if (!person1 || !person2) return 'Unknown relationship';

        const name1 = person1.name;
        const name2 = person2.name;

        // Try to determine gender from relationships for proper terms
        const getGender = (person) => {
            // Check if this person is someone's father or mother
            for (const p of this.people) {
                if (p.fatherId === person.id) return 'male';
                if (p.motherId === person.id) return 'female';
            }
            return 'unknown';
        };

        const gender2 = getGender(person2);

        // Count parent/child moves
        const ups = moves.filter(m => m === 'parent').length;    // going up to ancestors
        const downs = moves.filter(m => m === 'child').length;   // going down to descendants
        const hasSpouse = moves.includes('spouse');

        // Simple direct relationships
        if (moves.length === 1) {
            if (moves[0] === 'spouse') return `${name2} is ${name1}'s spouse.`;
            if (moves[0] === 'parent') return `${name2} is ${name1}'s ${gender2 === 'female' ? 'mother' : gender2 === 'male' ? 'father' : 'parent'}.`;
            if (moves[0] === 'child') return `${name2} is ${name1}'s ${gender2 === 'female' ? 'daughter' : gender2 === 'male' ? 'son' : 'child'}.`;
        }

        // Pure ancestor chain (all 'parent')
        if (downs === 0 && !hasSpouse && ups > 0) {
            const prefix = ups === 1 ? '' : ups === 2 ? 'grand' : 'great-'.repeat(ups - 2) + 'grand';
            const term = gender2 === 'female' ? 'mother' : gender2 === 'male' ? 'father' : 'parent';
            return `${name2} is ${name1}'s ${prefix}${term}.`;
        }

        // Pure descendant chain (all 'child')
        if (ups === 0 && !hasSpouse && downs > 0) {
            const prefix = downs === 1 ? '' : downs === 2 ? 'grand' : 'great-'.repeat(downs - 2) + 'grand';
            const term = gender2 === 'female' ? 'daughter' : gender2 === 'male' ? 'son' : 'child';
            return `${name2} is ${name1}'s ${prefix}${term}.`;
        }

        // Siblings: 1 up, 1 down
        if (ups === 1 && downs === 1 && !hasSpouse) {
            const term = gender2 === 'female' ? 'sister' : gender2 === 'male' ? 'brother' : 'sibling';
            return `${name2} is ${name1}'s ${term}.`;
        }

        // Uncle/Aunt: 2 up, 1 down
        if (ups === 2 && downs === 1 && !hasSpouse) {
            const term = gender2 === 'female' ? 'aunt' : gender2 === 'male' ? 'uncle' : 'aunt/uncle';
            return `${name2} is ${name1}'s ${term}.`;
        }

        // Niece/Nephew: 1 up, 2 down
        if (ups === 1 && downs === 2 && !hasSpouse) {
            const term = gender2 === 'female' ? 'niece' : gender2 === 'male' ? 'nephew' : 'niece/nephew';
            return `${name2} is ${name1}'s ${term}.`;
        }

        // Great uncle/aunt: 3 up, 1 down
        if (ups === 3 && downs === 1 && !hasSpouse) {
            const term = gender2 === 'female' ? 'great-aunt' : gender2 === 'male' ? 'great-uncle' : 'great-aunt/uncle';
            return `${name2} is ${name1}'s ${term}.`;
        }

        // Great-niece/nephew: 1 up, 3 down
        if (ups === 1 && downs === 3 && !hasSpouse) {
            const term = gender2 === 'female' ? 'great-niece' : gender2 === 'male' ? 'great-nephew' : 'great-niece/nephew';
            return `${name2} is ${name1}'s ${term}.`;
        }

        // Cousins: same ups and downs (2+, 2+)
        if (ups === downs && ups >= 2 && !hasSpouse) {
            if (ups === 2) return `${name2} is ${name1}'s first cousin.`;
            if (ups === 3) return `${name2} is ${name1}'s second cousin.`;
            return `${name2} is ${name1}'s ${this.ordinal(ups - 1)} cousin.`;
        }

        // Cousins removed: different ups and downs (both >= 2)
        if (ups >= 2 && downs >= 2 && !hasSpouse) {
            const cousinDeg = Math.min(ups, downs) - 1;
            const removed = Math.abs(ups - downs);
            if (cousinDeg >= 1 && removed >= 1) {
                return `${name2} is ${name1}'s ${this.ordinal(cousinDeg)} cousin, ${removed}x removed.`;
            }
        }

        // In-law via spouse: ends or starts with spouse
        if (hasSpouse && moves.length >= 2) {
            // Spouse's parent = in-law
            if (moves[0] === 'spouse' && moves.slice(1).every(m => m === 'parent')) {
                const inlawUps = ups;
                if (inlawUps === 1) {
                    const term = gender2 === 'female' ? 'mother-in-law' : gender2 === 'male' ? 'father-in-law' : 'parent-in-law';
                    return `${name2} is ${name1}'s ${term}.`;
                }
            }
            // Parent's spouse (step-parent)
            if (moves[moves.length - 1] === 'spouse' && moves.slice(0, -1).every(m => m === 'parent')) {
                const term = gender2 === 'female' ? 'step-mother' : gender2 === 'male' ? 'step-father' : 'step-parent';
                return `${name2} is ${name1}'s ${term}.`;
            }
            // Spouse's sibling = sibling-in-law
            if (moves.length === 3 && moves[0] === 'spouse' && moves[1] === 'parent' && moves[2] === 'child') {
                const term = gender2 === 'female' ? 'sister-in-law' : gender2 === 'male' ? 'brother-in-law' : 'sibling-in-law';
                return `${name2} is ${name1}'s ${term}.`;
            }
            // Sibling's spouse = sibling-in-law
            if (moves.length === 3 && moves[0] === 'parent' && moves[1] === 'child' && moves[2] === 'spouse') {
                const term = gender2 === 'female' ? 'sister-in-law' : gender2 === 'male' ? 'brother-in-law' : 'sibling-in-law';
                return `${name2} is ${name1}'s ${term}.`;
            }
            // Child's spouse = child-in-law
            if (moves.length === 2 && moves[0] === 'child' && moves[1] === 'spouse') {
                const term = gender2 === 'female' ? 'daughter-in-law' : gender2 === 'male' ? 'son-in-law' : 'child-in-law';
                return `${name2} is ${name1}'s ${term}.`;
            }
            // Spouse's child = step-child
            if (moves.length === 2 && moves[0] === 'spouse' && moves[1] === 'child') {
                const term = gender2 === 'female' ? 'step-daughter' : gender2 === 'male' ? 'step-son' : 'step-child';
                return `${name2} is ${name1}'s ${term}.`;
            }
        }

        // Fallback: describe the path
        return `${name2} is related to ${name1} (${moves.length - (hasSpouse ? 0 : 0)} steps through the family tree).`;
    }

    ordinal(n) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    }

    renderRelationshipFinder(personId) {
        const others = this.people.filter(p => p.id !== personId);
        if (others.length === 0) return '';

        return `
            <section class="person-section fade-in">
                <div class="person-section-title">How Are We Related?</div>
                <div class="relationship-finder">
                    <div class="relationship-finder-row">
                        <select id="relationshipTarget" class="relationship-select">
                            <option value="">Select a person...</option>
                            ${others.map(p => `<option value="${p.id}">${this.esc(p.name)}</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary btn-small" onclick="app.showRelationship('${personId}')">Find Relationship</button>
                    </div>
                    <div id="relationshipResult" class="relationship-result"></div>
                </div>
            </section>
        `;
    }

    showRelationship(fromPersonId) {
        const targetId = document.getElementById('relationshipTarget').value;
        const resultEl = document.getElementById('relationshipResult');
        if (!targetId) {
            resultEl.innerHTML = '<p class="relationship-empty">Pick someone from the list above.</p>';
            return;
        }
        const result = this.findRelationship(fromPersonId, targetId);
        resultEl.innerHTML = `<p class="relationship-answer">${this.esc(result)}</p>`;
    }

    // ─── FILE UPLOAD ───────────────────────────

    async uploadFile(file, path) {
        const ref = window.firebaseStorageRef(window.firebaseStorage, path);
        const snapshot = await window.firebaseUploadBytes(ref, file);
        return await window.firebaseGetDownloadURL(snapshot.ref);
    }

    // ─── UTILITIES ─────────────────────────────

    esc(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    truncate(text, maxLen) {
        if (!text) return '';
        if (text.length <= maxLen) return this.esc(text);
        return this.esc(text.substring(0, maxLen).trim()) + '\u2026';
    }

    // ─── ADMIN: DATA CLEANUP ────────────────────

    async cleanupToCore() {
        const keepIds = new Set(['p1', 'p2', 'p3', 'p4', 'p7', 'p8', 'p9', 'p12']);

        if (!confirm(
            'This will remove all people except the 8 core family members ' +
            '(Brian, Allison, Gene, Debra, Robert, Maryann, Conrad, Gladys) ' +
            'and delete all stories. Continue?'
        )) {
            return;
        }

        try {
            console.log('Starting cleanup...');

            // Delete people not in keep list
            const peopleSnap = await window.firebaseGetDocs(
                window.firebaseCollection(window.firebaseDb, 'people')
            );
            const deletePromises = [];
            peopleSnap.forEach(doc => {
                if (!keepIds.has(doc.id)) {
                    deletePromises.push(
                        window.firebaseDeleteDoc(
                            window.firebaseDoc(window.firebaseDb, 'people', doc.id)
                        )
                    );
                }
            });
            await Promise.all(deletePromises);
            console.log(`Deleted ${deletePromises.length} people`);

            // Clean up dangling parent references
            // Robert (p9): parents p30, p31 were deleted
            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'people', 'p9'),
                { fatherId: null, motherId: null },
                { merge: true }
            );

            // Maryann (p7): parents p15, p13 were deleted
            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'people', 'p7'),
                { fatherId: null, motherId: null },
                { merge: true }
            );

            // Conrad (p12): parents deleted, remove Joan (p20) from spouseIds,
            // set marriage to Gladys as divorced (Joan was second wife)
            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'people', 'p12'),
                {
                    fatherId: null,
                    motherId: null,
                    spouseIds: ['p8'],
                    marriages: [{ spouseId: 'p8', status: 'divorced' }]
                },
                { merge: true }
            );

            // Gladys (p8): set her marriage to Conrad as divorced too
            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'people', 'p8'),
                {
                    marriages: [{ spouseId: 'p12', status: 'divorced' }]
                },
                { merge: true }
            );

            // Delete all stories (fresh start)
            const storiesSnap = await window.firebaseGetDocs(
                window.firebaseCollection(window.firebaseDb, 'stories')
            );
            const storyDeletes = [];
            storiesSnap.forEach(doc => {
                storyDeletes.push(
                    window.firebaseDeleteDoc(
                        window.firebaseDoc(window.firebaseDb, 'stories', doc.id)
                    )
                );
            });
            await Promise.all(storyDeletes);
            console.log(`Deleted ${storyDeletes.length} stories`);

            console.log('Cleanup complete! Refreshing data...');
            await this.loadData();
            this.navigate();
            alert('Cleanup complete! Only core family members remain.');

        } catch (err) {
            console.error('Cleanup failed:', err);
            alert('Cleanup failed: ' + err.message);
        }
    }
}

// ============================================
//   BOOTSTRAP
// ============================================

const app = new FamilyStoryApp();

// Initialize when Firebase is ready
if (window.firebaseDb) {
    app.init();
} else {
    window.addEventListener('firebase-ready', () => app.init());
}

// Setup photo preview listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const setupPreview = (inputId, previewId) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById(previewId);
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
            }
        });
    };

    setupPreview('storyCoverPhoto', 'coverPhotoPreview');
    setupPreview('personPhoto', 'personPhotoPreview');
});
