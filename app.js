// Family Tree Application

class FamilyTree {
    constructor() {
        this.people = [];
        this.focusedPersonId = null;
        this.currentPersonId = null; // For timeline view
        this.currentYear = new Date().getFullYear();
        this.firebaseReady = false;
        this.unsubscribe = null; // For real-time listener

        // Event type definitions
        this.eventTypes = {
            birth: { label: 'Birth', color: '#10b981' },
            baptism: { label: 'Baptism', color: '#8b5cf6' },
            education: { label: 'Education', color: '#3b82f6' },
            graduation: { label: 'Graduation', color: '#3b82f6' },
            military: { label: 'Military Service', color: '#6b7280' },
            occupation: { label: 'Career', color: '#f59e0b' },
            marriage: { label: 'Marriage', color: '#ec4899' },
            divorce: { label: 'Divorce', color: '#78716c' },
            residence: { label: 'Residence', color: '#06b6d4' },
            immigration: { label: 'Immigration', color: '#06b6d4' },
            medical: { label: 'Medical', color: '#ef4444' },
            achievement: { label: 'Achievement', color: '#eab308' },
            story: { label: 'Story', color: '#8b5cf6' },
            death: { label: 'Death', color: '#64748b' },
            burial: { label: 'Burial', color: '#57534e' },
            custom: { label: 'Event', color: '#6b7280' }
        };

        this.init();
    }

    init() {
        this.loadTheme();
        this.bindEvents();

        // Wait for Firebase to be ready before loading data
        if (window.firebaseDb) {
            this.firebaseReady = true;
            this.loadData();
        } else {
            window.addEventListener('firebase-ready', () => {
                this.firebaseReady = true;
                this.loadData();
            });
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            toggle.checked = savedTheme === 'dark';
        }
    }

    toggleDarkMode() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    // ==================== Data Management ====================

    async loadData() {
        if (!this.firebaseReady) {
            console.log('Firebase not ready, waiting...');
            return;
        }

        try {
            const db = window.firebaseDb;
            const collection = window.firebaseCollection;
            const onSnapshot = window.firebaseOnSnapshot;

            // Set up real-time listener for changes
            const peopleRef = collection(db, 'people');

            this.unsubscribe = onSnapshot(peopleRef, (snapshot) => {
                this.people = [];
                snapshot.forEach((doc) => {
                    this.people.push(doc.data());
                });

                console.log('Loaded', this.people.length, 'people from Firebase');

                // Recalculate best focus person when data changes
                // This ensures the tree shows the fullest view after new people are added
                if (this.people.length > 0) {
                    const bestFocus = this.findBestFocusPerson();
                    // Only change focus if current focused person doesn't exist or if we can show more ancestors
                    if (!this.focusedPersonId || !this.getPerson(this.focusedPersonId)) {
                        this.focusedPersonId = bestFocus;
                    }
                }

                // Render the tree (even if empty - will show empty state)
                this.render();
            }, (error) => {
                console.error('Error loading data from Firebase:', error);
                // Fall back to localStorage if Firebase fails
                this.loadFromLocalStorage();
            });

        } catch (error) {
            console.error('Error setting up Firebase:', error);
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('familyTreeV3');
        if (saved) {
            this.people = JSON.parse(saved);
            if (this.people.length > 0 && !this.focusedPersonId) {
                this.focusedPersonId = this.findBestFocusPerson();
            }
        } else {
            this.loadSampleData();
        }
        this.render();
    }

    findBestFocusPerson() {
        if (this.people.length === 0) return null;

        // Find the person with the most ancestors to show the fullest tree
        // This is typically someone from the youngest generation
        let bestPerson = this.people[0];
        let maxAncestors = 0;

        this.people.forEach(person => {
            const ancestorCount = this.countAncestors(person, 0);
            if (ancestorCount > maxAncestors) {
                maxAncestors = ancestorCount;
                bestPerson = person;
            }
        });

        return bestPerson.id;
    }

    countAncestors(person, depth) {
        if (depth > 10) return 0; // Prevent infinite loops
        let count = 0;

        if (person.fatherId) {
            const father = this.getPerson(person.fatherId);
            if (father) {
                count += 1 + this.countAncestors(father, depth + 1);
            }
        }

        if (person.motherId) {
            const mother = this.getPerson(person.motherId);
            if (mother) {
                count += 1 + this.countAncestors(mother, depth + 1);
            }
        }

        return count;
    }

    async saveData() {
        // Also save to localStorage as backup
        localStorage.setItem('familyTreeV3', JSON.stringify(this.people));

        if (!this.firebaseReady) return;

        try {
            const db = window.firebaseDb;
            const doc = window.firebaseDoc;
            const setDoc = window.firebaseSetDoc;

            // Save each person to Firebase
            for (const person of this.people) {
                const personRef = doc(db, 'people', person.id);
                await setDoc(personRef, person);
            }
            console.log('Data saved to Firebase');
        } catch (error) {
            console.error('Error saving to Firebase:', error);
        }
    }

    async deletePersonFromFirebase(personId) {
        if (!this.firebaseReady) return;

        try {
            const db = window.firebaseDb;
            const doc = window.firebaseDoc;
            const deleteDoc = window.firebaseDeleteDoc;

            const personRef = doc(db, 'people', personId);
            await deleteDoc(personRef);
            console.log('Person deleted from Firebase');
        } catch (error) {
            console.error('Error deleting from Firebase:', error);
        }
    }

    async savePersonToFirebase(person) {
        if (!this.firebaseReady) return;

        try {
            const db = window.firebaseDb;
            const doc = window.firebaseDoc;
            const setDoc = window.firebaseSetDoc;

            const personRef = doc(db, 'people', person.id);
            await setDoc(personRef, person);
            console.log('Person saved to Firebase:', person.name);
        } catch (error) {
            console.error('Error saving person to Firebase:', error);
        }
    }

    loadSampleData() {
        // Create a multi-generational family tree
        const greatGrandfather1 = this.createPerson({
            name: 'William James Thompson',
            birthDate: '1895-03-15',
            deathDate: '1972-11-20',
            birthPlace: 'Boston, Massachusetts',
            biography: 'A hardworking carpenter who immigrated from Ireland in his youth.',
            photoUrl: '',
            events: [
                { type: 'birth', date: '1895-03-15', location: 'County Cork, Ireland', description: 'Born to a farming family' },
                { type: 'immigration', date: '1912-06-01', location: 'Ellis Island, New York', description: 'Arrived in America at age 17, seeking a better life' },
                { type: 'occupation', date: '1915-01-01', endDate: '1965-12-31', location: 'Boston, MA', description: 'Master carpenter, built many homes in the Boston area' },
                { type: 'marriage', date: '1920-06-15', location: 'St. Patrick\'s Church, Boston', description: 'Married Margaret O\'Brien' },
                { type: 'death', date: '1972-11-20', location: 'Boston, Massachusetts', description: '' }
            ]
        });

        const greatGrandmother1 = this.createPerson({
            name: 'Margaret O\'Brien Thompson',
            birthDate: '1898-07-22',
            deathDate: '1985-04-10',
            birthPlace: 'Boston, Massachusetts',
            biography: 'A devoted mother and talented seamstress.',
            events: [
                { type: 'birth', date: '1898-07-22', location: 'Boston, Massachusetts', description: '' },
                { type: 'marriage', date: '1920-06-15', location: 'St. Patrick\'s Church, Boston', description: 'Married William Thompson' },
                { type: 'death', date: '1985-04-10', location: 'Boston, Massachusetts', description: '' }
            ]
        });

        const greatGrandfather2 = this.createPerson({
            name: 'Robert Charles Miller',
            birthDate: '1892-11-08',
            deathDate: '1968-02-14',
            birthPlace: 'Philadelphia, Pennsylvania',
            biography: 'A WWI veteran and factory foreman.',
            events: [
                { type: 'birth', date: '1892-11-08', location: 'Philadelphia, Pennsylvania', description: '' },
                { type: 'military', date: '1917-04-01', endDate: '1918-11-11', location: 'France', description: 'Served in WWI with the American Expeditionary Forces' },
                { type: 'marriage', date: '1919-09-20', location: 'Philadelphia, PA', description: 'Married Helen Smith' },
                { type: 'death', date: '1968-02-14', location: 'Philadelphia, Pennsylvania', description: '' }
            ]
        });

        const greatGrandmother2 = this.createPerson({
            name: 'Helen Smith Miller',
            birthDate: '1896-05-30',
            deathDate: '1978-08-25',
            birthPlace: 'Philadelphia, Pennsylvania',
            biography: 'A schoolteacher who loved poetry and music.',
            events: [
                { type: 'birth', date: '1896-05-30', location: 'Philadelphia, Pennsylvania', description: '' },
                { type: 'education', date: '1914-09-01', endDate: '1916-05-15', location: 'Philadelphia Normal School', description: 'Studied to become a teacher' },
                { type: 'occupation', date: '1916-09-01', endDate: '1919-06-15', location: 'Philadelphia, PA', description: 'Elementary school teacher' },
                { type: 'marriage', date: '1919-09-20', location: 'Philadelphia, PA', description: 'Married Robert Miller' },
                { type: 'death', date: '1978-08-25', location: 'Philadelphia, Pennsylvania', description: '' }
            ]
        });

        const grandfather = this.createPerson({
            name: 'James William Thompson',
            birthDate: '1925-04-12',
            deathDate: '2010-09-05',
            birthPlace: 'Boston, Massachusetts',
            fatherId: greatGrandfather1.id,
            motherId: greatGrandmother1.id,
            biography: 'A Korean War veteran who became a successful businessman.',
            events: [
                { type: 'birth', date: '1925-04-12', location: 'Boston, Massachusetts', description: '' },
                { type: 'military', date: '1950-07-01', endDate: '1953-07-27', location: 'Korea', description: 'Served in the Korean War' },
                { type: 'marriage', date: '1955-08-20', location: 'Boston, MA', description: 'Married Dorothy Miller' },
                { type: 'occupation', date: '1955-01-01', endDate: '1990-12-31', location: 'Boston, MA', description: 'Founded Thompson Hardware, a successful local business' },
                { type: 'death', date: '2010-09-05', location: 'Boston, Massachusetts', description: '' }
            ]
        });

        const grandmother = this.createPerson({
            name: 'Dorothy Miller Thompson',
            birthDate: '1928-12-03',
            deathDate: '2015-03-18',
            birthPlace: 'Philadelphia, Pennsylvania',
            fatherId: greatGrandfather2.id,
            motherId: greatGrandmother2.id,
            biography: 'A loving grandmother who was known for her amazing cooking.',
            events: [
                { type: 'birth', date: '1928-12-03', location: 'Philadelphia, Pennsylvania', description: '' },
                { type: 'education', date: '1946-09-01', endDate: '1950-05-15', location: 'Temple University', description: 'Bachelor\'s degree in English Literature' },
                { type: 'marriage', date: '1955-08-20', location: 'Boston, MA', description: 'Married James Thompson' },
                { type: 'story', date: '1975-12-25', location: 'Boston, MA', description: 'The Christmas she taught all the grandchildren her secret cookie recipe' },
                { type: 'death', date: '2015-03-18', location: 'Boston, Massachusetts', description: '' }
            ]
        });

        // Set spouses
        grandfather.spouseIds = [grandmother.id];
        grandmother.spouseIds = [grandfather.id];
        greatGrandfather1.spouseIds = [greatGrandmother1.id];
        greatGrandmother1.spouseIds = [greatGrandfather1.id];
        greatGrandfather2.spouseIds = [greatGrandmother2.id];
        greatGrandmother2.spouseIds = [greatGrandfather2.id];

        const father = this.createPerson({
            name: 'Michael James Thompson',
            birthDate: '1958-06-22',
            birthPlace: 'Boston, Massachusetts',
            fatherId: grandfather.id,
            motherId: grandmother.id,
            biography: 'A software engineer who loves hiking and photography.',
            events: [
                { type: 'birth', date: '1958-06-22', location: 'Boston, Massachusetts', description: '' },
                { type: 'education', date: '1976-09-01', endDate: '1980-05-15', location: 'MIT', description: 'Bachelor\'s degree in Computer Science' },
                { type: 'marriage', date: '1985-10-12', location: 'Cambridge, MA', description: 'Married Sarah Johnson' },
                { type: 'occupation', date: '1980-06-01', location: 'Various tech companies', description: 'Software engineer, later became CTO at a startup' }
            ]
        });

        const mother = this.createPerson({
            name: 'Sarah Johnson Thompson',
            birthDate: '1960-02-14',
            birthPlace: 'Cambridge, Massachusetts',
            biography: 'A pediatrician who has helped thousands of children.',
            events: [
                { type: 'birth', date: '1960-02-14', location: 'Cambridge, Massachusetts', description: '' },
                { type: 'education', date: '1978-09-01', endDate: '1986-05-15', location: 'Harvard Medical School', description: 'M.D. in Pediatric Medicine' },
                { type: 'marriage', date: '1985-10-12', location: 'Cambridge, MA', description: 'Married Michael Thompson' },
                { type: 'occupation', date: '1986-07-01', location: 'Boston Children\'s Hospital', description: 'Pediatrician, helping families for over 35 years' }
            ]
        });

        father.spouseIds = [mother.id];
        mother.spouseIds = [father.id];

        const child = this.createPerson({
            name: 'Emily Rose Thompson',
            birthDate: '1990-08-30',
            birthPlace: 'Boston, Massachusetts',
            fatherId: father.id,
            motherId: mother.id,
            biography: 'Following in the family tradition of helping others.',
            events: [
                { type: 'birth', date: '1990-08-30', location: 'Boston, Massachusetts', description: '' },
                { type: 'education', date: '2008-09-01', endDate: '2012-05-15', location: 'Boston University', description: 'Bachelor\'s degree in Nursing' },
                { type: 'graduation', date: '2012-05-15', location: 'Boston University', description: 'Graduated with honors' },
                { type: 'occupation', date: '2012-08-01', location: 'Massachusetts General Hospital', description: 'Registered Nurse in the emergency department' }
            ]
        });

        this.people = [
            greatGrandfather1, greatGrandmother1, greatGrandfather2, greatGrandmother2,
            grandfather, grandmother, father, mother, child
        ];

        this.focusedPersonId = child.id;

        // Save all sample people to Firebase
        this.people.forEach(person => this.savePersonToFirebase(person));
        this.saveData();
        this.render();
    }

    createPerson(data) {
        return {
            id: this.generateId(),
            name: data.name || '',
            birthDate: data.birthDate || null,
            deathDate: data.deathDate || null,
            birthPlace: data.birthPlace || '',
            photoUrl: data.photoUrl || '',
            biography: data.biography || '',
            fatherId: data.fatherId || null,
            motherId: data.motherId || null,
            spouseIds: data.spouseIds || [],
            documents: data.documents || [], // General documents for the person
            events: (data.events || []).map(e => ({
                id: this.generateId(),
                type: e.type,
                customTitle: e.customTitle || null,
                date: e.date || null,
                endDate: e.endDate || null,
                location: e.location || '',
                description: e.description || '',
                documents: e.documents || []
            }))
        };
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getPerson(id) {
        return this.people.find(p => p.id === id);
    }

    getChildren(personId) {
        return this.people.filter(p => p.fatherId === personId || p.motherId === personId);
    }

    getSiblings(personId) {
        const person = this.getPerson(personId);
        if (!person) return [];
        return this.people.filter(p =>
            p.id !== personId &&
            ((person.fatherId && p.fatherId === person.fatherId) ||
             (person.motherId && p.motherId === person.motherId))
        );
    }

    addPerson(personData) {
        const person = this.createPerson(personData);
        this.people.push(person);
        this.savePersonToFirebase(person);
        this.saveData();
        return person;
    }

    updatePerson(id, personData) {
        const index = this.people.findIndex(p => p.id === id);
        if (index !== -1) {
            // Preserve events if not provided
            if (!personData.events) {
                personData.events = this.people[index].events;
            }
            this.people[index] = { ...this.people[index], ...personData };
            this.savePersonToFirebase(this.people[index]);
            this.saveData();
        }
    }

    deletePerson(id) {
        // Remove references to this person
        this.people.forEach(p => {
            if (p.fatherId === id) p.fatherId = null;
            if (p.motherId === id) p.motherId = null;
            p.spouseIds = p.spouseIds.filter(sid => sid !== id);
            // Save updated references to Firebase
            this.savePersonToFirebase(p);
        });
        this.people = this.people.filter(p => p.id !== id);

        if (this.focusedPersonId === id) {
            this.focusedPersonId = this.people.length > 0 ? this.people[0].id : null;
        }

        // Delete from Firebase
        this.deletePersonFromFirebase(id);
        this.saveData();
    }

    confirmDeletePerson(id, name) {
        if (confirm(`Are you sure you want to delete ${name}? This will also remove them from any family relationships. This cannot be undone.`)) {
            this.deletePerson(id);
            this.showTree();
        }
    }

    addEvent(personId, eventData) {
        const person = this.getPerson(personId);
        if (person) {
            const event = {
                id: this.generateId(),
                ...eventData
            };
            person.events.push(event);
            this.savePersonToFirebase(person);
            this.saveData();
            return event;
        }
        return null;
    }

    updateEvent(personId, eventId, eventData) {
        const person = this.getPerson(personId);
        if (person) {
            const index = person.events.findIndex(e => e.id === eventId);
            if (index !== -1) {
                person.events[index] = { ...person.events[index], ...eventData };
                this.savePersonToFirebase(person);
                this.saveData();
            }
        }
    }

    deleteEvent(personId, eventId) {
        const person = this.getPerson(personId);
        if (person) {
            person.events = person.events.filter(e => e.id !== eventId);
            this.savePersonToFirebase(person);
            this.saveData();
        }
    }

    createChildBirthEvent(parentId, child) {
        const parent = this.getPerson(parentId);
        if (!parent) return;

        // Check if a birth event for this child already exists on the parent's timeline
        const existingEvent = parent.events.find(e =>
            e.type === 'story' &&
            e.linkedPersonId === child.id &&
            e.customTitle?.includes('Birth of')
        );

        if (existingEvent) return; // Don't duplicate

        // Create a "child's birth" event on the parent's timeline
        const eventData = {
            type: 'story',
            customTitle: `Birth of ${child.name.split(' ')[0]}`,
            date: child.birthDate,
            location: child.birthPlace || '',
            description: `${child.name} was born.`,
            linkedPersonId: child.id,
            documents: []
        };

        this.addEvent(parentId, eventData);
    }

    exportData() {
        const dataStr = JSON.stringify(this.people, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'family-tree-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    this.people = data;
                    this.focusedPersonId = this.people.length > 0 ? this.people[0].id : null;
                    this.saveData();
                    this.render();
                    alert('Data imported successfully!');
                } else {
                    alert('Invalid data format.');
                }
            } catch (error) {
                alert('Error reading file.');
            }
        };
        reader.readAsText(file);
    }

    async clearAllData() {
        if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
            // Delete all people from Firebase
            for (const person of this.people) {
                await this.deletePersonFromFirebase(person.id);
            }

            this.people = [];
            this.focusedPersonId = null;
            this.saveData();
            this.render();
        }
    }

    // ==================== Rendering ====================

    render() {
        this.renderPedigree();
        // Draw connector lines after DOM is rendered
        requestAnimationFrame(() => this.drawConnectorLines());
    }

    drawConnectorLines() {
        const container = document.getElementById('pedigreeContainer');
        const tree = container.querySelector('.pedigree-tree');
        if (!tree) return;

        // Remove existing SVG overlay
        const existingSvg = container.querySelector('.pedigree-connectors');
        if (existingSvg) existingSvg.remove();

        // Create SVG overlay for connectors
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('pedigree-connectors');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.overflow = 'visible';

        const rows = tree.querySelectorAll('.pedigree-row');
        const treeRect = tree.getBoundingClientRect();

        // Get connector color based on theme
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const lineColor = isDarkMode ? '#6b7a8a' : '#c4b5a0';

        // Draw lines connecting parents to children
        // For each family unit in a row, find all their children in the next row
        for (let i = 0; i < rows.length - 1; i++) {
            const parentRow = rows[i];
            const childRow = rows[i + 1];

            const familyUnits = parentRow.querySelectorAll('.family-unit');
            const childCards = childRow.querySelectorAll('.person-card');

            familyUnits.forEach(unit => {
                const parentCards = unit.querySelectorAll('.person-card');
                if (parentCards.length === 0) return;

                // Get parent IDs from this family unit
                const parentIds = [];
                parentCards.forEach(card => {
                    const personId = card.getAttribute('data-person-id');
                    if (personId) parentIds.push(personId);
                });

                if (parentIds.length === 0) return;

                // Find children of these parents
                const children = [];
                childCards.forEach(childCard => {
                    const childId = childCard.getAttribute('data-person-id');
                    if (!childId) return;

                    const child = this.getPerson(childId);
                    if (!child) return;

                    // Check if this child belongs to these parents
                    if ((child.fatherId && parentIds.includes(child.fatherId)) ||
                        (child.motherId && parentIds.includes(child.motherId))) {
                        children.push(childCard);
                    }
                });

                if (children.length === 0) return;

                // Calculate parent center point
                const firstParent = parentCards[0];
                const lastParent = parentCards[parentCards.length - 1];
                const firstRect = firstParent.getBoundingClientRect();
                const lastRect = lastParent.getBoundingClientRect();

                const centerX = (firstRect.left + firstRect.width / 2 + lastRect.left + lastRect.width / 2) / 2 - treeRect.left;
                const topY = Math.max(firstRect.bottom, lastRect.bottom) - treeRect.top;

                // Draw vertical line from parent center down
                const midY = topY + 30; // How far down to go before branching

                const downLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                downLine.setAttribute('x1', centerX);
                downLine.setAttribute('y1', topY);
                downLine.setAttribute('x2', centerX);
                downLine.setAttribute('y2', midY);
                downLine.setAttribute('stroke', lineColor);
                downLine.setAttribute('stroke-width', '2');
                svg.appendChild(downLine);

                // Get child positions
                const childPositions = children.map(childCard => {
                    const childRect = childCard.getBoundingClientRect();
                    return {
                        x: childRect.left + childRect.width / 2 - treeRect.left,
                        y: childRect.top - treeRect.top
                    };
                });

                if (childPositions.length === 1) {
                    // Single child - just draw a line down
                    const child = childPositions[0];

                    if (Math.abs(centerX - child.x) > 2) {
                        // Need horizontal then vertical
                        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        hLine.setAttribute('x1', centerX);
                        hLine.setAttribute('y1', midY);
                        hLine.setAttribute('x2', child.x);
                        hLine.setAttribute('y2', midY);
                        hLine.setAttribute('stroke', lineColor);
                        hLine.setAttribute('stroke-width', '2');
                        svg.appendChild(hLine);
                    }

                    const toChild = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    toChild.setAttribute('x1', child.x);
                    toChild.setAttribute('y1', midY);
                    toChild.setAttribute('x2', child.x);
                    toChild.setAttribute('y2', child.y);
                    toChild.setAttribute('stroke', lineColor);
                    toChild.setAttribute('stroke-width', '2');
                    svg.appendChild(toChild);
                } else {
                    // Multiple children - draw horizontal bar connecting them all
                    const minX = Math.min(...childPositions.map(c => c.x));
                    const maxX = Math.max(...childPositions.map(c => c.x));

                    // Horizontal bar across all children
                    const hBar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    hBar.setAttribute('x1', minX);
                    hBar.setAttribute('y1', midY);
                    hBar.setAttribute('x2', maxX);
                    hBar.setAttribute('y2', midY);
                    hBar.setAttribute('stroke', lineColor);
                    hBar.setAttribute('stroke-width', '2');
                    svg.appendChild(hBar);

                    // Vertical lines down to each child
                    childPositions.forEach(child => {
                        const toChild = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        toChild.setAttribute('x1', child.x);
                        toChild.setAttribute('y1', midY);
                        toChild.setAttribute('x2', child.x);
                        toChild.setAttribute('y2', child.y);
                        toChild.setAttribute('stroke', lineColor);
                        toChild.setAttribute('stroke-width', '2');
                        svg.appendChild(toChild);
                    });
                }
            });
        }

        tree.style.position = 'relative';
        tree.appendChild(svg);
    }

    renderPedigree() {
        const container = document.getElementById('pedigreeContainer');

        if (this.people.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        // Build a complete family tree showing everyone
        const generations = this.buildFamilyTree();

        console.log('Family tree generations:', generations.length, 'Total people:', this.people.length);

        // Render vertical pedigree (top to bottom, oldest at top)
        let html = '<div class="pedigree-tree">';

        generations.forEach((gen, genIndex) => {
            html += `<div class="pedigree-row generation-${genIndex}">`;

            gen.forEach((unit, unitIndex) => {
                // Each unit is either a couple or a single person
                html += '<div class="family-unit">';

                if (unit.person1) {
                    html += this.renderPersonCard(unit.person1, false, genIndex, unitIndex * 2);
                }

                // Show spouse connector if there's a couple
                if (unit.person1 && unit.person2) {
                    html += '<div class="spouse-connector"></div>';
                }

                if (unit.person2) {
                    html += this.renderPersonCard(unit.person2, false, genIndex, unitIndex * 2 + 1);
                }

                html += '</div>';
            });

            html += '</div>';
        });

        html += '</div>';

        // Add a "All People" section below the tree for easy navigation
        html += this.renderAllPeopleSection();

        container.innerHTML = html;
    }

    buildFamilyTree() {
        // Step 1: Find TRUE root ancestors
        // A root is someone who has no parents AND whose spouse (if any) also has no parents
        // This prevents in-laws from appearing at the top level

        const peopleWithChildren = new Set();
        this.people.forEach(p => {
            if (p.fatherId) peopleWithChildren.add(p.fatherId);
            if (p.motherId) peopleWithChildren.add(p.motherId);
        });

        // Helper: does this person have parents in the system?
        const hasParentsInSystem = (person) => {
            return (person.fatherId && this.getPerson(person.fatherId)) ||
                   (person.motherId && this.getPerson(person.motherId));
        };

        // Helper: does this person's spouse have parents?
        const spouseHasParents = (person) => {
            if (!person.spouseIds || person.spouseIds.length === 0) return false;
            return person.spouseIds.some(spouseId => {
                const spouse = this.getPerson(spouseId);
                return spouse && hasParentsInSystem(spouse);
            });
        };

        const rootAncestors = this.people.filter(p => {
            // Must have no parents
            if (hasParentsInSystem(p)) return false;

            // If spouse has parents, this person is NOT a root
            // (they'll be added as a spouse in the spouse's generation)
            if (spouseHasParents(p)) return false;

            return true;
        });

        if (rootAncestors.length === 0 && this.people.length > 0) {
            // Fallback: use the person with most ancestors as focus
            return [[{ person1: this.people[0], person2: null }]];
        }

        // Step 2: Group root ancestors - but don't pair with spouses who aren't roots
        const processedIds = new Set();
        const rootUnits = [];

        rootAncestors.forEach(person => {
            if (processedIds.has(person.id)) return;
            processedIds.add(person.id);

            // Only pair with spouse if spouse is also a root ancestor
            let spouse = null;
            if (person.spouseIds && person.spouseIds.length > 0) {
                for (const spouseId of person.spouseIds) {
                    const potentialSpouse = this.getPerson(spouseId);
                    if (potentialSpouse && rootAncestors.find(r => r.id === spouseId) && !processedIds.has(spouseId)) {
                        spouse = potentialSpouse;
                        processedIds.add(spouseId);
                        break;
                    }
                }
            }

            rootUnits.push({ person1: person, person2: spouse });
        });

        // Step 3: Build generations downward from roots
        const generations = [rootUnits];
        const allProcessedIds = new Set(processedIds);
        let currentGen = rootUnits;
        let maxIterations = 20;

        while (maxIterations-- > 0) {
            const nextGen = [];
            const nextGenIds = new Set();

            currentGen.forEach(unit => {
                const parentIds = [unit.person1?.id, unit.person2?.id].filter(Boolean);

                // Find children of anyone in this unit
                const children = this.people.filter(p =>
                    !allProcessedIds.has(p.id) &&
                    ((p.fatherId && parentIds.includes(p.fatherId)) ||
                     (p.motherId && parentIds.includes(p.motherId)))
                );

                children.forEach(child => {
                    if (nextGenIds.has(child.id)) return;
                    nextGenIds.add(child.id);
                    allProcessedIds.add(child.id);

                    // Find spouse for this child (spouse may not be processed yet)
                    let childSpouse = null;
                    if (child.spouseIds && child.spouseIds.length > 0) {
                        for (const spouseId of child.spouseIds) {
                            if (!allProcessedIds.has(spouseId) && !nextGenIds.has(spouseId)) {
                                childSpouse = this.getPerson(spouseId);
                                if (childSpouse) {
                                    nextGenIds.add(spouseId);
                                    allProcessedIds.add(spouseId);
                                    break;
                                }
                            }
                        }
                    }

                    nextGen.push({ person1: child, person2: childSpouse });
                });
            });

            if (nextGen.length === 0) break;

            generations.push(nextGen);
            currentGen = nextGen;
        }

        // Step 4: Handle anyone not yet in tree (truly disconnected)
        const disconnected = this.people.filter(p => !allProcessedIds.has(p.id));
        if (disconnected.length > 0) {
            const disconnectedProcessed = new Set();
            const disconnectedUnits = [];

            disconnected.forEach(person => {
                if (disconnectedProcessed.has(person.id)) return;
                disconnectedProcessed.add(person.id);

                let spouse = null;
                if (person.spouseIds && person.spouseIds.length > 0) {
                    for (const spouseId of person.spouseIds) {
                        if (!disconnectedProcessed.has(spouseId) && !allProcessedIds.has(spouseId)) {
                            spouse = this.getPerson(spouseId);
                            if (spouse) {
                                disconnectedProcessed.add(spouseId);
                                break;
                            }
                        }
                    }
                }

                disconnectedUnits.push({ person1: person, person2: spouse });
            });

            if (disconnectedUnits.length > 0) {
                // Add as a new generation at the bottom
                generations.push(disconnectedUnits);
            }
        }

        return generations;
    }


    renderAllPeopleSection() {
        if (this.people.length <= 1) return '';

        // Get current sort preference from localStorage
        const sortBy = localStorage.getItem('allPeopleSortBy') || 'name';
        const isCollapsed = localStorage.getItem('allPeopleCollapsed') === 'true';

        // Sort people based on preference
        const sortedPeople = [...this.people].sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'birth') {
                if (!a.birthDate && !b.birthDate) return 0;
                if (!a.birthDate) return 1;
                if (!b.birthDate) return -1;
                return new Date(a.birthDate) - new Date(b.birthDate);
            } else if (sortBy === 'recent') {
                // Sort by most recently added (based on id timestamp)
                const getTimestamp = (id) => {
                    const match = id.match(/id_(\d+)_/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getTimestamp(b.id) - getTimestamp(a.id);
            }
            return 0;
        });

        let html = `
            <div class="all-people-section ${isCollapsed ? 'collapsed' : ''}">
                <div class="all-people-header" onclick="app.toggleAllPeopleSection()">
                    <div class="all-people-header-left">
                        <svg class="collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        <h3 class="all-people-title">All People (${this.people.length})</h3>
                    </div>
                    <div class="all-people-controls" onclick="event.stopPropagation()">
                        <select class="sort-select" onchange="app.sortAllPeople(this.value)">
                            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name A-Z</option>
                            <option value="birth" ${sortBy === 'birth' ? 'selected' : ''}>Birth Date</option>
                            <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Recently Added</option>
                        </select>
                    </div>
                </div>
                <p class="all-people-hint">Click to view timeline</p>
                <div class="all-people-grid">
        `;

        sortedPeople.forEach(person => {
            const initials = this.getInitials(person.name);
            const dates = this.formatLifeDates(person);
            const photoHtml = person.photoUrl
                ? `<img src="${person.photoUrl}" alt="${person.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><span style="display:none">${initials}</span>`
                : initials;
            const isFocused = person.id === this.focusedPersonId;

            html += `
                <div class="all-people-card ${isFocused ? 'focused' : ''}"
                     data-person-id="${person.id}"
                     onclick="app.showTimeline('${person.id}')">
                    <div class="avatar">${photoHtml}</div>
                    <div class="all-people-info">
                        <span class="name">${person.name}</span>
                        <span class="dates">${dates}</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    toggleAllPeopleSection() {
        const isCollapsed = localStorage.getItem('allPeopleCollapsed') === 'true';
        localStorage.setItem('allPeopleCollapsed', !isCollapsed);
        this.render();
    }

    sortAllPeople(sortBy) {
        localStorage.setItem('allPeopleSortBy', sortBy);
        this.render();
    }

    renderConnectorRow(parentGen, childGen, genIndex) {
        // Create SVG connectors between parent pairs and their children
        const numParentPairs = parentGen.length / 2;
        let html = '<div class="connector-row">';
        html += `<svg class="connector-svg" preserveAspectRatio="none">`;

        // We'll calculate actual positions after DOM render, for now create placeholder
        html += '</svg>';
        html += '</div>';
        return html;
    }

    buildAncestorTree(person, maxGenerations) {
        const generations = [[person]];

        for (let gen = 1; gen < maxGenerations; gen++) {
            const prevGen = generations[gen - 1];
            const thisGen = [];

            prevGen.forEach(p => {
                if (p) {
                    const father = p.fatherId ? this.getPerson(p.fatherId) : null;
                    const mother = p.motherId ? this.getPerson(p.motherId) : null;
                    thisGen.push(father, mother);
                } else {
                    thisGen.push(null, null);
                }
            });

            // Only add generation if there's at least one person
            if (thisGen.some(p => p !== null)) {
                generations.push(thisGen);
            } else {
                break;
            }
        }

        return generations;
    }

    renderPersonCard(person, isFocused = false, genIndex = 0, personIndex = 0) {
        const dates = this.formatLifeDates(person);
        const initials = this.getInitials(person.name);
        const photoHtml = person.photoUrl
            ? `<img src="${person.photoUrl}" alt="${person.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><span style="display:none">${initials}</span>`
            : initials;

        return `
            <div class="person-card" data-person-id="${person.id}" data-gen="${genIndex}" data-index="${personIndex}" onclick="app.showTimeline('${person.id}')">
                <div class="card-actions">
                    <button class="card-action-btn" onclick="event.stopPropagation(); app.openPersonModal('${person.id}')" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                </div>
                <div class="avatar">${photoHtml}</div>
                <div class="name">${person.name}</div>
                <div class="dates">${dates}</div>
            </div>
        `;
    }

    renderEmptySlot(generation, child = null, isFatherSlot = true) {
        // Don't render empty slots - keep the tree view clean
        // Users can add people via the "Add Person" button and connect them through the form
        return '';
    }

    renderEmptyState() {
        return `
            <div class="pedigree-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h2>Start Your Family Tree</h2>
                <p>Add your first family member to begin exploring your ancestry.</p>
                <button class="btn btn-primary" onclick="app.openPersonModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add First Person
                </button>
            </div>
        `;
    }

    // ==================== Timeline View ====================

    showTimeline(personId) {
        this.currentPersonId = personId;
        const person = this.getPerson(personId);
        if (!person) return;

        document.getElementById('pedigreeView').classList.add('hidden');
        document.getElementById('timelineView').classList.remove('hidden');

        this.renderPersonHeader(person);
        this.renderTimelineEvents(person);
        this.renderPhotoGallery(person);
    }

    renderPhotoGallery(person) {
        // Collect all photos from person's documents and event documents
        const allPhotos = [];

        // Add person's general documents that are images
        if (person.documents) {
            person.documents.forEach(doc => {
                if (this.isImageUrl(doc.url)) {
                    allPhotos.push({
                        url: doc.url,
                        label: doc.label || 'Photo',
                        source: 'General Documents'
                    });
                }
            });
        }

        // Add profile photo if exists
        if (person.photoUrl && this.isImageUrl(person.photoUrl)) {
            // Don't add duplicate if already in documents
            const isInDocs = allPhotos.some(p => p.url === person.photoUrl);
            if (!isInDocs) {
                allPhotos.unshift({
                    url: person.photoUrl,
                    label: 'Profile Photo',
                    source: 'Profile'
                });
            }
        }

        // Add photos from events
        person.events.forEach(event => {
            if (event.documents) {
                event.documents.forEach(doc => {
                    if (this.isImageUrl(doc.url)) {
                        const eventType = this.eventTypes[event.type] || this.eventTypes.custom;
                        const eventTitle = event.customTitle || eventType.label;
                        allPhotos.push({
                            url: doc.url,
                            label: doc.label || 'Photo',
                            source: eventTitle,
                            eventDate: event.date
                        });
                    }
                });
            }
        });

        // Find or create gallery container
        let galleryContainer = document.getElementById('photoGallerySection');
        if (!galleryContainer) {
            galleryContainer = document.createElement('div');
            galleryContainer.id = 'photoGallerySection';
            document.getElementById('timelineContent').after(galleryContainer);
        }

        if (allPhotos.length === 0) {
            galleryContainer.innerHTML = '';
            return;
        }

        galleryContainer.innerHTML = `
            <div class="photo-gallery-section">
                <div class="gallery-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Photo Gallery (${allPhotos.length})</span>
                </div>
                <div class="photo-gallery-grid">
                    ${allPhotos.map(photo => `
                        <div class="gallery-photo" onclick="app.openDocument('${encodeURIComponent(photo.url)}', '${encodeURIComponent(photo.label)}')">
                            <img src="${photo.url}" alt="${photo.label}" onerror="this.parentElement.style.display='none'">
                            <div class="gallery-photo-overlay">
                                <span class="gallery-photo-label">${photo.label}</span>
                                <span class="gallery-photo-source">${photo.source}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    hideTimeline() {
        document.getElementById('timelineView').classList.add('hidden');
        document.getElementById('pedigreeView').classList.remove('hidden');
        this.currentPersonId = null;
    }

    renderPersonHeader(person) {
        const container = document.getElementById('personHeader');
        const initials = this.getInitials(person.name);
        const dates = this.formatLifeDates(person);

        const photoHtml = person.photoUrl
            ? `<img src="${person.photoUrl}" alt="${person.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><span style="display:none">${initials}</span>`
            : initials;

        // Get family members
        const father = person.fatherId ? this.getPerson(person.fatherId) : null;
        const mother = person.motherId ? this.getPerson(person.motherId) : null;
        const spouses = person.spouseIds.map(id => this.getPerson(id)).filter(Boolean);
        const children = this.getChildren(person.id);
        const siblings = this.getSiblings(person.id);

        // Build family section (FamilySearch style)
        let familySectionHtml = '<div class="family-section">';

        // Parents row
        familySectionHtml += `
            <div class="family-category">
                <div class="family-category-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>Parents</span>
                </div>
                <div class="family-members">
                    ${father ? this.renderFamilyMemberCard(father, 'Father') : this.renderAddFamilyMember('father', person.id)}
                    ${mother ? this.renderFamilyMemberCard(mother, 'Mother') : this.renderAddFamilyMember('mother', person.id)}
                </div>
            </div>
        `;

        // Spouse row
        familySectionHtml += `
            <div class="family-category">
                <div class="family-category-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span>Spouse</span>
                </div>
                <div class="family-members">
                    ${spouses.length > 0 ? spouses.map(s => this.renderFamilyMemberCard(s, 'Spouse')).join('') : this.renderAddFamilyMember('spouse', person.id)}
                </div>
            </div>
        `;

        // Siblings row (only show if there are siblings or could be)
        if (siblings.length > 0 || father || mother) {
            familySectionHtml += `
                <div class="family-category">
                    <div class="family-category-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span>Siblings</span>
                    </div>
                    <div class="family-members">
                        ${siblings.length > 0 ? siblings.map(s => this.renderFamilyMemberCard(s, 'Sibling')).join('') : '<span class="no-family-members">No siblings recorded</span>'}
                    </div>
                </div>
            `;
        }

        // Children row
        familySectionHtml += `
            <div class="family-category">
                <div class="family-category-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="4" r="2"/>
                        <path d="M12 6v6"/>
                        <circle cx="12" cy="14" r="2"/>
                        <path d="M8 18h8"/>
                        <path d="M8 18v3"/>
                        <path d="M16 18v3"/>
                    </svg>
                    <span>Children</span>
                </div>
                <div class="family-members">
                    ${children.length > 0 ? children.map(c => this.renderFamilyMemberCard(c, 'Child')).join('') : '<span class="no-family-members">No children recorded</span>'}
                </div>
            </div>
        `;

        familySectionHtml += '</div>';

        // Build documents section if person has general documents
        let documentsHtml = '';
        if (person.documents && person.documents.length > 0) {
            documentsHtml = `
                <div class="person-documents-section">
                    <div class="documents-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span>Documents & Photos</span>
                    </div>
                    <div class="person-documents-grid">
                        ${person.documents.map(doc => {
                            const isImage = this.isImageUrl(doc.url);
                            if (isImage) {
                                return `
                                    <div class="person-doc-item" onclick="app.openDocument('${encodeURIComponent(doc.url)}', '${encodeURIComponent(doc.label || 'Document')}')">
                                        <img src="${doc.url}" alt="${doc.label || 'Photo'}" onerror="this.parentElement.style.display='none'">
                                        ${doc.label ? `<span class="doc-label">${doc.label}</span>` : ''}
                                    </div>
                                `;
                            } else {
                                return `
                                    <a class="person-doc-link" href="${doc.url}" target="_blank">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                            <polyline points="14 2 14 8 20 8"/>
                                        </svg>
                                        <span>${doc.label || 'Document'}</span>
                                    </a>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="person-header-content">
                <div class="avatar">${photoHtml}</div>
                <div class="person-header-info">
                    <h1 class="name">${person.name}</h1>
                    <p class="life-dates">${dates}${person.birthPlace ? ` · ${person.birthPlace}` : ''}</p>
                    ${person.biography ? `<p class="biography">${person.biography}</p>` : ''}
                    <div class="person-header-actions">
                        <button class="btn btn-secondary" onclick="app.openPersonModal('${person.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                        </button>
                        <button class="btn btn-danger" onclick="app.confirmDeletePerson('${person.id}', '${person.name.replace(/'/g, "\\'")}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
            ${documentsHtml}
            ${familySectionHtml}
        `;
    }

    renderFamilyMemberCard(person, relationship) {
        const initials = this.getInitials(person.name);
        const dates = this.formatLifeDates(person);
        const photoHtml = person.photoUrl
            ? `<img src="${person.photoUrl}" alt="${person.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><span style="display:none">${initials}</span>`
            : initials;

        return `
            <div class="family-member-card" onclick="app.showTimeline('${person.id}')">
                <div class="family-member-avatar">${photoHtml}</div>
                <div class="family-member-info">
                    <span class="family-member-name">${person.name}</span>
                    <span class="family-member-dates">${dates}</span>
                </div>
            </div>
        `;
    }

    renderAddFamilyMember(type, personId) {
        return `
            <div class="add-family-member" onclick="app.openAddFamilyMemberModal('${type}', '${personId}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>Add ${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </div>
        `;
    }

    openAddFamilyMemberModal(type, personId) {
        const person = this.getPerson(personId);
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        // Get list of potential people to link (exclude self and already-linked people)
        let availablePeople = this.people.filter(p => p.id !== personId);

        // For parents, exclude people who are already set as that parent type
        if (type === 'father' && person.fatherId) {
            availablePeople = availablePeople.filter(p => p.id !== person.fatherId);
        }
        if (type === 'mother' && person.motherId) {
            availablePeople = availablePeople.filter(p => p.id !== person.motherId);
        }
        if (type === 'spouse') {
            availablePeople = availablePeople.filter(p => !person.spouseIds.includes(p.id));
        }

        if (availablePeople.length === 0) {
            // No existing people to link, just open create new
            this.openPersonModal(null);
            setTimeout(() => {
                if (type === 'father' || type === 'mother') {
                    document.getElementById('personForm').dataset.addAsParentTo = personId;
                    document.getElementById('personForm').dataset.parentType = type;
                } else if (type === 'spouse') {
                    document.getElementById('personForm').dataset.addAsSpouseTo = personId;
                }
            }, 100);
            return;
        }

        // Show a choice modal: link existing or create new
        const choiceHtml = `
            <div class="link-choice-modal">
                <h3>Add ${typeLabel} for ${person.name.split(' ')[0]}</h3>
                <div class="link-choice-options">
                    <div class="link-choice-section">
                        <h4>Link Existing Person</h4>
                        <select id="linkExistingPerson" class="link-person-select">
                            <option value="">-- Select a person --</option>
                            ${availablePeople.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="app.linkExistingPerson('${type}', '${personId}')">Link Selected Person</button>
                    </div>
                    <div class="link-choice-divider">
                        <span>OR</span>
                    </div>
                    <div class="link-choice-section">
                        <h4>Create New Person</h4>
                        <button class="btn btn-secondary" onclick="app.createNewFamilyMember('${type}', '${personId}')">Create New ${typeLabel}</button>
                    </div>
                </div>
                <button class="btn btn-text link-choice-cancel" onclick="app.closeLinkChoiceModal()">Cancel</button>
            </div>
        `;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'linkChoiceOverlay';
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `<div class="modal">${choiceHtml}</div>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeLinkChoiceModal();
            }
        });
    }

    closeLinkChoiceModal() {
        const overlay = document.getElementById('linkChoiceOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    linkExistingPerson(type, personId) {
        const select = document.getElementById('linkExistingPerson');
        const selectedId = select.value;

        if (!selectedId) {
            alert('Please select a person to link');
            return;
        }

        const person = this.getPerson(personId);
        const linkedPerson = this.getPerson(selectedId);

        if (type === 'father') {
            person.fatherId = selectedId;
            this.savePersonToFirebase(person);
        } else if (type === 'mother') {
            person.motherId = selectedId;
            this.savePersonToFirebase(person);
        } else if (type === 'spouse') {
            // Add to both people's spouse lists
            if (!person.spouseIds.includes(selectedId)) {
                person.spouseIds.push(selectedId);
                this.savePersonToFirebase(person);
            }
            if (!linkedPerson.spouseIds.includes(personId)) {
                linkedPerson.spouseIds.push(personId);
                this.savePersonToFirebase(linkedPerson);
            }
        }

        this.saveData();
        this.closeLinkChoiceModal();

        // Refresh the current view
        if (this.currentPersonId === personId) {
            this.showTimeline(personId);
        }
        this.render();
    }

    createNewFamilyMember(type, personId) {
        this.closeLinkChoiceModal();
        this.openPersonModal(null);

        setTimeout(() => {
            if (type === 'father' || type === 'mother') {
                document.getElementById('personForm').dataset.addAsParentTo = personId;
                document.getElementById('personForm').dataset.parentType = type;
            } else if (type === 'spouse') {
                document.getElementById('personForm').dataset.addAsSpouseTo = personId;
            }
        }, 100);
    }

    renderTimelineEvents(person) {
        const container = document.getElementById('timelineContent');

        // Sort events by date
        const sortedEvents = [...person.events].sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(a.date) - new Date(b.date);
        });

        if (sortedEvents.length === 0) {
            container.innerHTML = `
                <div class="timeline-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <h3>No life events recorded yet</h3>
                    <p>Start by adding birth and death dates, then fill in the story of ${person.name.split(' ')[0]}'s life in between.</p>
                    <div class="timeline-empty-actions">
                        <button class="btn btn-primary" onclick="app.openEventModal('${person.id}', null, 'birth')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            Add Birth
                        </button>
                        <button class="btn btn-secondary" onclick="app.openEventModal('${person.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Add Other Event
                        </button>
                    </div>
                    <p class="timeline-empty-hint">
                        <strong>Tip:</strong> Important events to consider adding: education, marriage, career milestones, residences, and family stories.
                    </p>
                </div>
            `;
            return;
        }

        // Calculate year range for markers
        const years = sortedEvents
            .filter(e => e.date)
            .map(e => new Date(e.date).getFullYear());
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const lifespan = person.birthDate && person.deathDate
            ? `${new Date(person.birthDate).getFullYear()} - ${new Date(person.deathDate).getFullYear()}`
            : person.birthDate
                ? `Born ${new Date(person.birthDate).getFullYear()}`
                : '';

        // Generate year markers (every 10 years, or fewer if lifespan is short)
        const yearRange = maxYear - minYear;
        const yearStep = yearRange > 50 ? 20 : yearRange > 20 ? 10 : 5;
        const startDecade = Math.floor(minYear / yearStep) * yearStep;
        const endDecade = Math.ceil(maxYear / yearStep) * yearStep;

        let yearMarkersHtml = '<div class="timeline-year-markers">';
        for (let y = startDecade; y <= endDecade; y += yearStep) {
            yearMarkersHtml += `<div class="timeline-year-marker"><span>${y}</span></div>`;
        }
        yearMarkersHtml += '</div>';

        // Build horizontal timeline
        let html = `
            <div class="horizontal-timeline">
                ${lifespan ? `<div class="timeline-lifespan-label">${lifespan}</div>` : ''}
                <div class="timeline-track"></div>
                <div class="timeline-markers">
        `;

        sortedEvents.forEach((event, index) => {
            html += this.renderTimelineMarker(event, person.id, index, sortedEvents.length);
        });

        html += `
                </div>
                ${years.length > 0 ? yearMarkersHtml : ''}
                <button class="add-event-floating" onclick="app.openEventModal('${person.id}')" title="Add Event">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
            </div>
        `;

        container.innerHTML = html;
    }

    renderTimelineMarker(event, personId, index, total) {
        const eventType = this.eventTypes[event.type] || this.eventTypes.custom;
        const title = event.customTitle || eventType.label;
        const dateStr = this.formatEventDate(event);
        const year = event.date ? new Date(event.date).getFullYear() : '';

        // Build media HTML for popup
        let mediaHtml = '';
        if (event.documents && event.documents.length > 0) {
            mediaHtml = '<div class="popup-media">';
            event.documents.slice(0, 3).forEach(doc => {
                const isImage = this.isImageUrl(doc.url);
                if (isImage) {
                    mediaHtml += `<img src="${doc.url}" alt="${doc.label || 'Photo'}" onclick="event.stopPropagation(); app.openDocument('${encodeURIComponent(doc.url)}', '${encodeURIComponent(doc.label || 'Document')}')" onerror="this.style.display='none'">`;
                }
            });
            if (event.documents.length > 3) {
                mediaHtml += `<span class="popup-media-more">+${event.documents.length - 3} more</span>`;
            }
            mediaHtml += '</div>';
        }

        return `
            <div class="timeline-marker ${event.type}" data-event-id="${event.id}" data-person-id="${personId}" onclick="app.openEventDetail('${personId}', '${event.id}')">
                <div class="marker-dot"></div>
                <div class="marker-label">
                    <span class="marker-title">${title}</span>
                    <span class="marker-year">${year}</span>
                </div>
                <div class="timeline-popup" onclick="event.stopPropagation()">
                    <div class="popup-header">
                        <span class="popup-type ${event.type}">${eventType.label}</span>
                        <span class="popup-date">${dateStr}</span>
                    </div>
                    ${event.customTitle ? `<h4 class="popup-title">${event.customTitle}</h4>` : ''}
                    ${event.location ? `
                        <div class="popup-location">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            ${event.location}
                        </div>
                    ` : ''}
                    ${event.description ? `<p class="popup-description">${this.truncateText(event.description, 100)}</p>` : ''}
                    ${mediaHtml}
                    <div class="popup-actions">
                        <button class="popup-action view" onclick="event.stopPropagation(); app.openEventDetail('${personId}', '${event.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            View
                        </button>
                        <button class="popup-action" onclick="event.stopPropagation(); app.openEventModal('${personId}', '${event.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                        </button>
                        <button class="popup-action delete" onclick="event.stopPropagation(); app.confirmDeleteEvent('${personId}', '${event.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    openEventDetail(personId, eventId) {
        const person = this.getPerson(personId);
        const event = person?.events.find(e => e.id === eventId);
        if (!event) return;

        const eventType = this.eventTypes[event.type] || this.eventTypes.custom;
        const title = event.customTitle || eventType.label;
        const dateStr = this.formatEventDate(event);

        // Build linked person HTML
        let linkedPersonHtml = '';
        if (event.linkedPersonId) {
            const linkedPerson = this.getPerson(event.linkedPersonId);
            if (linkedPerson) {
                const initials = this.getInitials(linkedPerson.name);
                linkedPersonHtml = `
                    <div class="event-detail-linked-person" onclick="app.closeEventDetailModal(); app.showTimeline('${linkedPerson.id}')">
                        <div class="linked-person-avatar">${linkedPerson.photoUrl ? `<img src="${linkedPerson.photoUrl}" alt="">` : initials}</div>
                        <div class="linked-person-info">
                            <span class="linked-person-label">${event.type === 'marriage' ? 'Married to' : 'With'}</span>
                            <span class="linked-person-name">${linkedPerson.name}</span>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </div>
                `;
            }
        }

        // Build media HTML
        let mediaHtml = '';
        if (event.documents && event.documents.length > 0) {
            mediaHtml = '<div class="event-detail-media">';
            event.documents.forEach(doc => {
                const isImage = this.isImageUrl(doc.url);
                if (isImage) {
                    mediaHtml += `
                        <div class="event-detail-media-item" onclick="app.openDocument('${encodeURIComponent(doc.url)}', '${encodeURIComponent(doc.label || 'Document')}')">
                            <img src="${doc.url}" alt="${doc.label || 'Photo'}" onerror="this.parentElement.style.display='none'">
                            ${doc.label ? `<span class="media-label">${doc.label}</span>` : ''}
                        </div>
                    `;
                } else {
                    mediaHtml += `
                        <div class="event-detail-doc-item">
                            <a href="${doc.url}" target="_blank">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                ${doc.label || 'Document'}
                            </a>
                        </div>
                    `;
                }
            });
            mediaHtml += '</div>';
        }

        // Build source HTML
        let sourceHtml = '';
        if (event.source && event.source.title) {
            sourceHtml = `
                <div class="event-detail-source">
                    <div class="source-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        <span>Source</span>
                    </div>
                    <div class="source-content">
                        <strong>${event.source.title}</strong>
                        ${event.source.url ? `<br><a href="${event.source.url}" target="_blank">View Source</a>` : ''}
                        ${event.source.dateAccessed ? `<br><small>Accessed: ${new Date(event.source.dateAccessed).toLocaleDateString()}</small>` : ''}
                        ${event.source.notes ? `<p class="source-notes">${event.source.notes}</p>` : ''}
                    </div>
                </div>
            `;
        }

        const modal = document.getElementById('eventDetailModal');
        document.getElementById('eventDetailTitle').textContent = title;

        document.getElementById('eventDetailContent').innerHTML = `
            <div class="event-detail-header">
                <span class="event-detail-type ${event.type}">${eventType.label}</span>
                <span class="event-detail-date">${dateStr}</span>
            </div>

            ${linkedPersonHtml}

            ${event.location ? `
                <div class="event-detail-location">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>${event.location}</span>
                </div>
            ` : ''}

            ${event.description ? `
                <div class="event-detail-description">
                    <p>${event.description}</p>
                </div>
            ` : ''}

            ${mediaHtml}

            ${sourceHtml}

            <div class="event-detail-actions">
                <button class="btn btn-secondary" onclick="app.closeEventDetailModal(); app.openEventModal('${personId}', '${eventId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Event
                </button>
                <button class="btn btn-danger" onclick="app.closeEventDetailModal(); app.confirmDeleteEvent('${personId}', '${eventId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete
                </button>
            </div>
        `;

        modal.classList.add('active');
    }

    closeEventDetailModal() {
        document.getElementById('eventDetailModal').classList.remove('active');
    }

    // ==================== Search ====================

    search(query) {
        if (!query.trim()) return [];

        const lowerQuery = query.toLowerCase();
        return this.people.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            (p.birthPlace && p.birthPlace.toLowerCase().includes(lowerQuery))
        );
    }

    renderSearchResults(results) {
        const container = document.getElementById('searchResults');

        if (results.length === 0) {
            container.innerHTML = '<div class="search-no-results">No results found</div>';
        } else {
            container.innerHTML = results.map(person => {
                const initials = this.getInitials(person.name);
                const dates = this.formatLifeDates(person);
                const photoHtml = person.photoUrl
                    ? `<img src="${person.photoUrl}" alt="">`
                    : initials;

                return `
                    <div class="search-result-item" onclick="app.selectSearchResult('${person.id}')">
                        <div class="avatar">${photoHtml}</div>
                        <div class="search-result-info">
                            <div class="search-result-name">${person.name}</div>
                            <div class="search-result-dates">${dates}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.classList.add('active');
    }

    selectSearchResult(personId) {
        document.getElementById('searchResults').classList.remove('active');
        document.getElementById('searchInput').value = '';
        this.setFocusedPerson(personId);

        // If in timeline view, switch to that person
        if (!document.getElementById('timelineView').classList.contains('hidden')) {
            this.showTimeline(personId);
        }
    }

    setFocusedPerson(personId) {
        this.focusedPersonId = personId;
        this.render();
    }

    // ==================== Modals ====================

    openPersonModal(personId = null, forGeneration = null) {
        const modal = document.getElementById('personModal');
        const form = document.getElementById('personForm');
        const title = document.getElementById('modalTitle');

        form.reset();
        document.getElementById('personId').value = '';
        document.getElementById('photoFile').value = '';
        document.getElementById('personDocuments').innerHTML = '';
        this.clearPhotoPreview();

        // Populate parent/spouse dropdowns
        this.populatePersonDropdowns(personId);

        // Quick events group - only show for new people
        const quickEventsGroup = document.getElementById('quickEventsGroup');

        if (personId) {
            const person = this.getPerson(personId);
            if (person) {
                title.textContent = 'Edit Person';
                document.getElementById('personId').value = person.id;
                document.getElementById('personName').value = person.name;
                document.getElementById('birthDate').value = person.birthDate || '';
                document.getElementById('deathDate').value = person.deathDate || '';
                document.getElementById('birthPlace').value = person.birthPlace || '';
                document.getElementById('photoUrl').value = person.photoUrl || '';
                document.getElementById('biography').value = person.biography || '';
                document.getElementById('fatherId').value = person.fatherId || '';
                document.getElementById('motherId').value = person.motherId || '';

                // Set photo preview if exists
                if (person.photoUrl) {
                    this.updatePhotoPreview(person.photoUrl);
                }

                // Set spouse selections
                const spouseSelect = document.getElementById('spouseIds');
                Array.from(spouseSelect.options).forEach(opt => {
                    opt.selected = person.spouseIds.includes(opt.value);
                });

                // Populate documents
                if (person.documents) {
                    person.documents.forEach(doc => {
                        this.addPersonDocumentChip(doc.url, doc.label);
                    });
                }

                // Hide quick events for existing people
                quickEventsGroup.style.display = 'none';
            }
        } else {
            title.textContent = 'Add Person';
            // Show quick events for new people
            quickEventsGroup.style.display = 'block';
            document.getElementById('createBirthEvent').checked = true;
            document.getElementById('createDeathEvent').checked = false;
        }

        modal.classList.add('active');
    }

    addPersonDocumentChip(url, label) {
        const container = document.getElementById('personDocuments');
        const chip = document.createElement('div');
        chip.className = 'document-chip';
        chip.dataset.url = url;
        chip.dataset.label = label;
        chip.innerHTML = `
            <span>${label || 'Document'}</span>
            <button type="button" class="remove-doc" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(chip);
    }

    closePersonModal() {
        document.getElementById('personModal').classList.remove('active');
    }

    populatePersonDropdowns(excludeId = null) {
        const fatherSelect = document.getElementById('fatherId');
        const motherSelect = document.getElementById('motherId');
        const spouseSelect = document.getElementById('spouseIds');

        const people = this.people.filter(p => p.id !== excludeId);

        fatherSelect.innerHTML = '<option value="">-- Select Father --</option>' +
            people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        motherSelect.innerHTML = '<option value="">-- Select Mother --</option>' +
            people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        spouseSelect.innerHTML = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    handlePersonFormSubmit(e) {
        e.preventDefault();

        const form = document.getElementById('personForm');
        const id = document.getElementById('personId').value;
        const spouseSelect = document.getElementById('spouseIds');
        const selectedSpouses = Array.from(spouseSelect.selectedOptions).map(opt => opt.value);

        // Gather person documents
        const personDocuments = [];
        document.querySelectorAll('#personDocuments .document-chip').forEach(chip => {
            personDocuments.push({
                url: chip.dataset.url,
                label: chip.dataset.label
            });
        });

        const personData = {
            name: document.getElementById('personName').value.trim(),
            birthDate: document.getElementById('birthDate').value || null,
            deathDate: document.getElementById('deathDate').value || null,
            birthPlace: document.getElementById('birthPlace').value.trim(),
            photoUrl: document.getElementById('photoUrl').value.trim(),
            biography: document.getElementById('biography').value.trim(),
            fatherId: document.getElementById('fatherId').value || null,
            motherId: document.getElementById('motherId').value || null,
            spouseIds: selectedSpouses,
            documents: personDocuments
        };

        // Track if this is a new person or if parents changed (for auto-creating birth events)
        const existingPerson = id ? this.getPerson(id) : null;
        const oldFatherId = existingPerson?.fatherId;
        const oldMotherId = existingPerson?.motherId;

        let newPersonId = id;

        if (id) {
            this.updatePerson(id, personData);
        } else {
            const newPerson = this.addPerson(personData);
            newPersonId = newPerson.id;
            if (!this.focusedPersonId) {
                this.focusedPersonId = newPerson.id;
            }
        }

        // Auto-create "child's birth" event on parent timelines
        const person = this.getPerson(newPersonId);
        if (person && person.birthDate) {
            // Check father - create birth event if newly assigned
            if (personData.fatherId && personData.fatherId !== oldFatherId) {
                this.createChildBirthEvent(personData.fatherId, person);
            }
            // Check mother - create birth event if newly assigned
            if (personData.motherId && personData.motherId !== oldMotherId) {
                this.createChildBirthEvent(personData.motherId, person);
            }
        }

        // Quick-add birth event if checkbox is checked (for new people)
        // OR if editing and a birthDate was added where there wasn't one before
        const oldBirthDate = existingPerson?.birthDate;
        const birthEventExists = person.events.some(e => e.type === 'birth');

        if (personData.birthDate && !birthEventExists) {
            // For new people, check the checkbox; for existing people, auto-create if they just added a date
            const shouldCreateBirth = !id
                ? document.getElementById('createBirthEvent').checked
                : (!oldBirthDate && personData.birthDate); // Added birth date to existing person

            if (shouldCreateBirth) {
                this.addEvent(newPersonId, {
                    type: 'birth',
                    date: personData.birthDate,
                    location: personData.birthPlace || '',
                    description: ''
                });
            }
        }

        // Quick-add death event if checkbox is checked (for new people)
        // OR if editing and a deathDate was added where there wasn't one before
        const oldDeathDate = existingPerson?.deathDate;
        const deathEventExists = person.events.some(e => e.type === 'death');

        if (personData.deathDate && !deathEventExists) {
            const shouldCreateDeath = !id
                ? document.getElementById('createDeathEvent').checked
                : (!oldDeathDate && personData.deathDate); // Added death date to existing person

            if (shouldCreateDeath) {
                this.addEvent(newPersonId, {
                    type: 'death',
                    date: personData.deathDate,
                    description: ''
                });
            }
        }

        // Update spouse references (bidirectional)
        selectedSpouses.forEach(spouseId => {
            const spouse = this.getPerson(spouseId);
            if (spouse && !spouse.spouseIds.includes(newPersonId)) {
                spouse.spouseIds.push(newPersonId);
            }
        });

        // Handle adding as parent to another person
        if (form.dataset.addAsParentTo && !id) {
            const childId = form.dataset.addAsParentTo;
            const parentType = form.dataset.parentType;
            const child = this.getPerson(childId);
            if (child) {
                if (parentType === 'father') {
                    child.fatherId = newPersonId;
                } else if (parentType === 'mother') {
                    child.motherId = newPersonId;
                }
            }
            delete form.dataset.addAsParentTo;
            delete form.dataset.parentType;
        }

        // Handle adding as spouse to another person
        if (form.dataset.addAsSpouseTo && !id) {
            const spouseOfId = form.dataset.addAsSpouseTo;
            const spouseOf = this.getPerson(spouseOfId);
            const newPerson = this.getPerson(newPersonId);
            if (spouseOf && newPerson) {
                if (!spouseOf.spouseIds.includes(newPersonId)) {
                    spouseOf.spouseIds.push(newPersonId);
                }
                if (!newPerson.spouseIds.includes(spouseOfId)) {
                    newPerson.spouseIds.push(spouseOfId);
                }
            }
            delete form.dataset.addAsSpouseTo;
        }

        this.saveData();
        this.closePersonModal();
        this.render();

        // Refresh timeline if open
        if (this.currentPersonId) {
            this.showTimeline(this.currentPersonId);
        }
    }

    openEventModal(personId, eventId = null, presetType = null) {
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        const title = document.getElementById('eventModalTitle');

        form.reset();
        document.getElementById('eventId').value = '';
        document.getElementById('eventPersonId').value = personId;
        document.getElementById('eventDocuments').innerHTML = '';
        document.getElementById('customTitleGroup').style.display = 'none';
        document.getElementById('linkedPersonGroup').style.display = 'none';

        // Populate linked person dropdown (exclude current person)
        const linkedPersonSelect = document.getElementById('eventLinkedPerson');
        linkedPersonSelect.innerHTML = '<option value="">-- Select Person --</option>' +
            this.people
                .filter(p => p.id !== personId)
                .map(p => `<option value="${p.id}">${p.name}</option>`)
                .join('');

        // Pre-set event type if provided
        if (presetType) {
            document.getElementById('eventType').value = presetType;
            if (presetType === 'custom' || presetType === 'story') {
                document.getElementById('customTitleGroup').style.display = 'block';
            }
            if (presetType === 'marriage' || presetType === 'divorce') {
                document.getElementById('linkedPersonGroup').style.display = 'block';
            }
        }

        if (eventId) {
            const person = this.getPerson(personId);
            const event = person?.events.find(e => e.id === eventId);
            if (event) {
                title.textContent = 'Edit Event';
                document.getElementById('eventId').value = event.id;
                document.getElementById('eventType').value = event.type;
                document.getElementById('eventCustomTitle').value = event.customTitle || '';
                document.getElementById('eventDate').value = event.date || '';
                document.getElementById('eventEndDate').value = event.endDate || '';
                document.getElementById('eventLocation').value = event.location || '';
                document.getElementById('eventDescription').value = event.description || '';
                document.getElementById('eventLinkedPerson').value = event.linkedPersonId || '';

                // Source fields
                document.getElementById('eventSourceTitle').value = event.source?.title || '';
                document.getElementById('eventSourceUrl').value = event.source?.url || '';
                document.getElementById('eventSourceDate').value = event.source?.dateAccessed || '';
                document.getElementById('eventSourceNotes').value = event.source?.notes || '';

                if (event.type === 'custom' || event.type === 'story') {
                    document.getElementById('customTitleGroup').style.display = 'block';
                }
                if (event.type === 'marriage' || event.type === 'divorce') {
                    document.getElementById('linkedPersonGroup').style.display = 'block';
                }

                // Populate documents
                if (event.documents) {
                    event.documents.forEach(doc => {
                        this.addDocumentChip(doc.url, doc.label);
                    });
                }
            }
        } else {
            title.textContent = 'Add Life Event';
        }

        modal.classList.add('active');
    }

    closeEventModal() {
        document.getElementById('eventModal').classList.remove('active');
    }

    handleEventFormSubmit(e) {
        e.preventDefault();

        const eventId = document.getElementById('eventId').value;
        const personId = document.getElementById('eventPersonId').value;

        // Gather documents
        const documents = [];
        document.querySelectorAll('#eventDocuments .document-chip').forEach(chip => {
            documents.push({
                url: chip.dataset.url,
                label: chip.dataset.label
            });
        });

        // Gather source info
        const sourceTitle = document.getElementById('eventSourceTitle').value.trim();
        const source = sourceTitle ? {
            title: sourceTitle,
            url: document.getElementById('eventSourceUrl').value.trim() || null,
            dateAccessed: document.getElementById('eventSourceDate').value || null,
            notes: document.getElementById('eventSourceNotes').value.trim() || null
        } : null;

        const eventData = {
            type: document.getElementById('eventType').value,
            customTitle: document.getElementById('eventCustomTitle').value.trim() || null,
            date: document.getElementById('eventDate').value || null,
            endDate: document.getElementById('eventEndDate').value || null,
            location: document.getElementById('eventLocation').value.trim(),
            description: document.getElementById('eventDescription').value.trim(),
            linkedPersonId: document.getElementById('eventLinkedPerson').value || null,
            documents: documents,
            source: source
        };

        if (eventId) {
            this.updateEvent(personId, eventId, eventData);
        } else {
            this.addEvent(personId, eventData);
        }

        this.closeEventModal();
        this.showTimeline(personId);
    }

    addDocumentChip(url, label) {
        const container = document.getElementById('eventDocuments');
        const chip = document.createElement('div');
        chip.className = 'document-chip';
        chip.dataset.url = url;
        chip.dataset.label = label;
        chip.innerHTML = `
            <span>${label || 'Document'}</span>
            <button type="button" class="remove-doc" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(chip);
    }

    confirmDeleteEvent(personId, eventId) {
        if (confirm('Are you sure you want to delete this event?')) {
            this.deleteEvent(personId, eventId);
            this.showTimeline(personId);
        }
    }

    openDocument(encodedUrl, encodedLabel) {
        const url = decodeURIComponent(encodedUrl);
        const label = decodeURIComponent(encodedLabel);

        const modal = document.getElementById('documentModal');
        const title = document.getElementById('documentTitle');
        const viewer = document.getElementById('documentViewer');

        title.textContent = label;

        const isImage = this.isImageUrl(url);
        if (isImage) {
            viewer.innerHTML = `<img src="${url}" alt="${label}" onerror="this.outerHTML='<div class=\\'error\\'>Failed to load image. <a href=\\'${url}\\' target=\\'_blank\\'>Open in new tab</a></div>'">`;
        } else {
            viewer.innerHTML = `<iframe src="${url}" title="${label}"></iframe>`;
        }

        modal.classList.add('active');
    }

    closeDocumentModal() {
        document.getElementById('documentModal').classList.remove('active');
    }

    openSettingsModal() {
        // Set dark mode toggle to current state
        const currentTheme = document.documentElement.getAttribute('data-theme');
        document.getElementById('darkModeToggle').checked = currentTheme === 'dark';
        document.getElementById('settingsModal').classList.add('active');
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    // ==================== Photo Upload ====================

    handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        // Convert to base64 for local storage
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            this.updatePhotoPreview(dataUrl);
            document.getElementById('photoUrl').value = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    handlePhotoUrlChange(e) {
        const url = e.target.value.trim();
        if (url) {
            this.updatePhotoPreview(url);
        } else {
            this.clearPhotoPreview();
        }
    }

    updatePhotoPreview(url) {
        const preview = document.getElementById('photoPreview');
        preview.innerHTML = `<img src="${url}" alt="Preview" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' ry=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg>'">`;
        preview.classList.add('has-photo');
    }

    clearPhotoPreview() {
        const preview = document.getElementById('photoPreview');
        preview.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>
        `;
        preview.classList.remove('has-photo');
    }

    // ==================== Utilities ====================

    formatLifeDates(person) {
        const birth = person.birthDate ? new Date(person.birthDate).getFullYear() : '?';
        const death = person.deathDate ? new Date(person.deathDate).getFullYear() : (person.birthDate ? 'Present' : '');
        return death ? `${birth} – ${death}` : `b. ${birth}`;
    }

    formatEventDate(event) {
        if (!event.date) return '';

        const date = new Date(event.date);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        let str = date.toLocaleDateString('en-US', options);

        if (event.endDate) {
            const endDate = new Date(event.endDate);
            str += ` – ${endDate.toLocaleDateString('en-US', options)}`;
        }

        return str;
    }

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    isImageUrl(url) {
        const ext = url.split('.').pop().toLowerCase().split('?')[0];
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    }

    // ==================== Event Binding ====================

    bindEvents() {
        // Search
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.length >= 2) {
                const results = this.search(query);
                this.renderSearchResults(results);
            } else {
                searchResults.classList.remove('active');
            }
        });

        searchInput.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                const results = this.search(e.target.value);
                this.renderSearchResults(results);
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchResults.classList.remove('active');
            }
        });

        // Header buttons
        document.getElementById('addPersonBtn').addEventListener('click', () => this.openPersonModal());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());

        // Back to tree
        document.getElementById('backToTree').addEventListener('click', () => this.hideTimeline());

        // Person modal
        document.getElementById('closeModal').addEventListener('click', () => this.closePersonModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closePersonModal());
        document.getElementById('personForm').addEventListener('submit', (e) => this.handlePersonFormSubmit(e));

        // Photo upload handling
        document.getElementById('photoFile').addEventListener('change', (e) => this.handlePhotoUpload(e));
        document.getElementById('photoUrl').addEventListener('input', (e) => this.handlePhotoUrlChange(e));

        // Event modal
        document.getElementById('closeEventModal').addEventListener('click', () => this.closeEventModal());
        document.getElementById('cancelEventBtn').addEventListener('click', () => this.closeEventModal());
        document.getElementById('eventForm').addEventListener('submit', (e) => this.handleEventFormSubmit(e));

        document.getElementById('eventType').addEventListener('change', (e) => {
            const type = e.target.value;
            const showCustomTitle = type === 'custom' || type === 'story';
            document.getElementById('customTitleGroup').style.display = showCustomTitle ? 'block' : 'none';

            // Show linked person for marriage/divorce events
            const showLinkedPerson = type === 'marriage' || type === 'divorce';
            document.getElementById('linkedPersonGroup').style.display = showLinkedPerson ? 'block' : 'none';
            if (showLinkedPerson) {
                const hint = document.getElementById('linkedPersonHint');
                hint.textContent = type === 'marriage' ? 'Select the spouse for this marriage' : 'Select the former spouse';
            }
        });

        document.getElementById('addDocBtn').addEventListener('click', () => {
            const urlInput = document.getElementById('docUrl');
            const labelInput = document.getElementById('docLabel');
            if (urlInput.value.trim()) {
                this.addDocumentChip(urlInput.value.trim(), labelInput.value.trim() || 'Document');
                urlInput.value = '';
                labelInput.value = '';
            }
        });

        // Person documents
        document.getElementById('addPersonDocBtn').addEventListener('click', () => {
            const urlInput = document.getElementById('personDocUrl');
            const labelInput = document.getElementById('personDocLabel');
            if (urlInput.value.trim()) {
                this.addPersonDocumentChip(urlInput.value.trim(), labelInput.value.trim() || 'Document');
                urlInput.value = '';
                labelInput.value = '';
            }
        });

        // Event detail modal
        document.getElementById('closeEventDetailModal').addEventListener('click', () => this.closeEventDetailModal());

        // Document modal
        document.getElementById('closeDocumentModal').addEventListener('click', () => this.closeDocumentModal());

        // Settings modal
        document.getElementById('closeSettingsModal').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                e.target.value = '';
            }
        });
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());

        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('change', () => this.toggleDarkMode());

        // Modal backdrop clicks
        ['personModal', 'eventModal', 'eventDetailModal', 'documentModal', 'settingsModal'].forEach(modalId => {
            document.getElementById(modalId).addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    e.target.classList.remove('active');
                }
            });
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            }
        });

        // Pedigree card clicks (delegation)
        document.getElementById('pedigreeContainer').addEventListener('click', (e) => {
            const card = e.target.closest('.person-card');
            if (card && !e.target.closest('.card-action-btn')) {
                const personId = card.dataset.personId;
                this.showTimeline(personId);
            }
        });

    }
}

// Initialize the application
const app = new FamilyTree();
