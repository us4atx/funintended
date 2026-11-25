// Default data used the first time the platform starts, and when a new
// client is provisioned. Everything here is editable from the admin panel.

export const MODULES = [
  { id: 'rewards', name: 'Fun Rewards', tagline: 'Celebrate. Motivate. Retain.', icon: '🏆', description: 'Recognition feed, points, rewards shop, birthdays and anniversaries.' },
  { id: 'games', name: 'Fun & Games', tagline: 'Play. Compete. Connect.', icon: '🎮', description: 'Games, challenges, tournaments and leaderboards.' },
  { id: 'train', name: 'The Fun Train', tagline: 'Learn. Grow. Advance. Engage.', icon: '🚂', description: 'Learning management: assigned trainings, library, quizzes.' },
  { id: 'fluence', name: 'FunFluence', tagline: 'Connect. Learn. Grow. Improve.', icon: '🤝', description: 'Mentorship matching, sessions, prompts and group sessions.' },
];

export const SUB_FEATURES = [
  { id: 'rewardsShop', module: 'rewards', name: 'Rewards shop' },
  { id: 'gifPosts', module: 'rewards', name: 'GIFs in posts' },
  { id: 'celebrations', module: 'rewards', name: 'Birthdays & anniversaries' },
  { id: 'leaderboards', module: 'rewards', name: 'Leaderboards' },
  { id: 'tournaments', module: 'games', name: 'Weekly tournaments' },
  { id: 'quizzes', module: 'train', name: 'Skill quizzes' },
  { id: 'createTraining', module: 'train', name: 'Client-created trainings' },
  { id: 'groupSessions', module: 'fluence', name: 'Group mentorship sessions' },
  { id: 'surveyBuilder', module: 'fluence', name: 'Survey builder' },
];

export function defaultFeatures() {
  const f = {};
  for (const m of MODULES) f[m.id] = true;
  for (const s of SUB_FEATURES) f[s.id] = true;
  return f;
}

export const DEFAULT_PAGES = {
  home: { title: 'Welcome back, {firstName}!', subtitle: 'Your hub for recognition, games, learning and mentorship.', cta: 'Give Recognition' },
  rewards: { title: 'Fun Rewards', subtitle: 'Celebrate. Motivate. Retain.', body: 'Recognize great work and reward performance in real time.', cta: 'Give Recognition' },
  games: { title: 'Welcome to Fun & Games!', subtitle: 'Play exciting games, challenge coworkers, and boost team morale!', cta: 'Launch Game' },
  train: { title: 'Welcome Aboard!', subtitle: 'Fuel your professional growth with engaging and interactive training.', cta: 'Give Recognition', promo: "Don't forget to check the Training Library for new skills to learn and upskill your career!" },
  fluence: { title: 'Welcome Back, {firstName}!', subtitle: 'Connect. Learn. Grow. Improve.', cta: 'Give Recognition' },
};

export const DEFAULT_GAMES = [
  { id: 'g-trivia', name: 'Trivia Challenge', description: 'Test your knowledge across various categories!', emoji: '💡', color: '#f59e0b', type: 'trivia', points: 145 },
  { id: 'g-scramble', name: 'Word Scramble', description: 'Unscramble the letters to form words.', emoji: '🔤', color: '#3b82f6', type: 'scramble', points: 100 },
  { id: 'g-race', name: 'Leaderboard Race', description: 'Score points each week to climb the ranks!', emoji: '🏁', color: '#8b5cf6', type: 'race', points: 120 },
  { id: 'g-memory', name: 'Memory Match', description: 'Test your memory and match the cards!', emoji: '🃏', color: '#10b981', type: 'memory', points: 110 },
  { id: 'g-quiz', name: 'Quiz Quest', description: 'Level up by answering a new quiz each day.', emoji: '🧭', color: '#ef4444', type: 'trivia', points: 210 },
];

export const DEFAULT_COURSES = [
  { id: 'c-pm', name: 'Project Management Essentials', description: 'Plan, run and close projects with confidence.', emoji: '📋', minutes: 45, category: 'Management' },
  { id: 'c-lead', name: 'Leadership Basics', description: 'Core habits of effective team leaders.', emoji: '♟️', minutes: 30, category: 'Leadership' },
  { id: 'c-cyber', name: 'Cybersecurity Awareness', description: 'Spot phishing and protect company data.', emoji: '🛡️', minutes: 20, category: 'Compliance' },
  { id: 'c-time', name: 'Time Management Tips', description: 'Prioritize work and protect your focus.', emoji: '⏳', minutes: 15, category: 'Productivity' },
  { id: 'c-comm', name: 'Effective Communication', description: 'Clear, kind and concise communication.', emoji: '💬', minutes: 25, category: 'Soft skills' },
  { id: 'c-cs', name: 'Customer Service Excellence', description: 'Turn every interaction into a great experience.', emoji: '⭐', minutes: 35, category: 'Customer' },
  { id: 'c-team', name: 'Team Building Techniques', description: 'Build trust and momentum in your team.', emoji: '🤝', minutes: 20, category: 'Leadership' },
  { id: 'c-privacy', name: 'Data Privacy Essentials', description: 'Handle personal data the right way.', emoji: '🔒', minutes: 20, category: 'Compliance' },
];

export const DEFAULT_REWARDS = [
  { id: 'r-amazon', name: 'Amazon Gift Card', description: '$25 digital gift card', emoji: '🎁', cost: 2500, category: 'Gift cards' },
  { id: 'r-mug', name: 'Coffee Mug', description: 'Branded company mug', emoji: '☕', cost: 800, category: 'Swag' },
  { id: 'r-movie', name: 'Movie Tickets', description: 'Two tickets to any showing', emoji: '🎬', cost: 1500, category: 'Experiences' },
  { id: 'r-headphones', name: 'Wireless Headphones', description: 'Noise-cancelling headphones', emoji: '🎧', cost: 9000, category: 'Tech' },
  { id: 'r-pto', name: 'Half Day Off', description: 'Four hours of extra PTO', emoji: '🌴', cost: 5000, category: 'Time off' },
  { id: 'r-lunch', name: 'Team Lunch', description: 'Lunch for you and two coworkers', emoji: '🍕', cost: 3000, category: 'Experiences' },
];

export const DEFAULT_VALUES = ['Ownership', 'Teamwork', 'Customer First', 'Innovation', 'Integrity'];

export function platformSeed() {
  return {
    version: 1,
    admins: [], // filled by core on first run
    features: { modules: MODULES, subFeatures: SUB_FEATURES },
    pages: DEFAULT_PAGES,
    catalogs: { games: DEFAULT_GAMES, courses: DEFAULT_COURSES, rewards: DEFAULT_REWARDS },
    clients: [], // index: [{ id, name, status, plan, createdAt }]
    audit: [],
  };
}

export function newClientDoc({ id, name, plan = 'standard', features, branding = {}, sites = {} }) {
  return {
    client: {
      id, name, plan, status: 'active',
      createdAt: new Date().toISOString(),
      features: { ...defaultFeatures(), ...(features || {}) },
      branding: { companyName: name, primaryColor: '#f97316', accentColor: '#2b3f8f', logoUrl: '', ...branding },
      sites: { adminUrl: '', employeeUrl: '', ...sites },
      pageOverrides: {},
      hidden: { games: [], courses: [], rewards: [] },
      recognition: { values: DEFAULT_VALUES, monthlyAllowance: 500, maxPerRecognition: 250 },
    },
    users: [], posts: [], orders: [], assignments: [], mentorships: [], sessions: [], results: [], events: [],
    games: [], courses: [], rewards: [], // client-specific additions to the platform catalogs
  };
}

const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// A fully populated client that mirrors the screen concepts.
export function demoData(doc, passwordHash) {
  const people = [
    ['u-sarah', 'Sarah Kim', 'sarah@acme.demo', 'employee', 'Marketing Specialist', 'Marketing', 3950],
    ['u-david', 'David Smith', 'david@acme.demo', 'manager', 'Senior Developer', 'IT', 2400],
    ['u-emma', 'Emma Parker', 'emma@acme.demo', 'employee', 'Account Manager', 'Sales', 4200],
    ['u-luke', 'Luke Adams', 'luke@acme.demo', 'employee', 'Support Lead', 'Support', 1800],
    ['u-swong', 'Sarah Wong', 'swong@acme.demo', 'employee', 'Designer', 'Product', 1650],
    ['u-jason', 'Jason Lee', 'jason@acme.demo', 'employee', 'Analyst', 'Finance', 1200],
    ['u-ben', 'Ben Cutler', 'ben@acme.demo', 'employee', 'Engineer', 'IT', 950],
    ['u-alicia', 'Alicia Gomez', 'alicia@acme.demo', 'employee', 'HR Partner', 'People', 3100],
    ['u-mary', 'Mary Wong', 'mary@acme.demo', 'employee', 'Recruiter', 'People', 700],
    ['u-john', 'John Smith', 'john@acme.demo', 'employee', 'Sales Rep', 'Sales', 600],
    ['u-adam', 'Adam Green', 'adam@acme.demo', 'manager', 'Operations Manager', 'Operations', 2000],
  ];
  const birthdays = { 'u-mary': day(6), 'u-luke': day(20) };
  const hires = { 'u-john': day(-365 * 3 + 12), 'u-emma': day(-365 * 2 + 30) };
  for (const [id, name, email, role, title, department, points] of people) {
    doc.users.push({ id, name, email, role, title, department, points, passwordHash, active: true,
      birthday: birthdays[id] || '', hireDate: hires[id] || day(-400), createdAt: new Date().toISOString() });
  }
  const t = (h) => new Date(Date.now() - h * 36e5).toISOString();
  doc.posts.push(
    { id: 'p1', type: 'post', authorId: 'u-luke', text: 'Guess the office costume party! 🍌🌽🍕', gif: 'party', likes: ['u-emma', 'u-david'], comments: [], createdAt: t(2) },
    { id: 'p2', type: 'recognition', authorId: 'u-david', toUserId: 'u-emma', value: 'Ownership', points: 250, text: 'Took charge of a tricky client situation and turned it into a big win. Great work Emma!', likes: ['u-sarah', 'u-alicia'], comments: [{ userId: 'u-alicia', text: 'So deserved!', createdAt: t(4) }], createdAt: t(5) },
    { id: 'p3', type: 'recognition', authorId: 'u-david', toUserId: 'u-ben', value: 'Teamwork', points: 100, text: 'Helped train the new team member with patience and a positive attitude.', likes: ['u-sarah'], comments: [], createdAt: t(26) },
  );
  doc.orders.push(
    { id: 'o1', userId: 'u-sarah', rewardId: 'r-amazon', name: 'Amazon Gift Card', cost: 2500, status: 'Delivered', createdAt: t(24 * 10) },
    { id: 'o2', userId: 'u-sarah', rewardId: 'r-mug', name: 'Coffee Mug', cost: 800, status: 'Completed', createdAt: t(24 * 30) },
    { id: 'o3', userId: 'u-sarah', rewardId: 'r-movie', name: 'Movie Tickets', cost: 1500, status: 'Processing', createdAt: t(24 * 2) },
  );
  doc.assignments.push(
    { id: 'a1', userId: 'u-sarah', courseId: 'c-pm', due: day(0), progress: 67, status: 'in_progress' },
    { id: 'a2', userId: 'u-sarah', courseId: 'c-lead', due: day(-5), progress: 0, status: 'not_started' },
    { id: 'a3', userId: 'u-sarah', courseId: 'c-cyber', due: day(7), progress: 0, status: 'pending' },
    { id: 'a4', userId: 'u-sarah', courseId: 'c-time', due: day(20), progress: 0, status: 'not_started' },
    { id: 'a5', userId: 'u-sarah', courseId: 'c-comm', due: day(-30), progress: 100, status: 'completed', completedAt: day(-28) },
    { id: 'a6', userId: 'u-sarah', courseId: 'c-cs', due: day(-35), progress: 100, status: 'completed', completedAt: day(-33) },
    { id: 'a7', userId: 'u-sarah', courseId: 'c-team', due: day(-40), progress: 100, status: 'completed', completedAt: day(-38) },
    { id: 'a8', userId: 'u-sarah', courseId: 'c-privacy', due: day(-48), progress: 100, status: 'completed', completedAt: day(-46) },
  );
  doc.mentorships.push({ id: 'm1', mentorId: 'u-david', menteeId: 'u-sarah', startedAt: day(-60), goal: 'Grow into a team lead role', totalSessions: 6, notes: [] });
  doc.sessions.push(
    { id: 's1', mentorshipId: 'm1', title: 'Introductory Meeting', date: day(-58), time: '14:00', status: 'completed' },
    { id: 's2', mentorshipId: 'm1', title: 'Goal Setting Workshop', date: day(-44), time: '14:00', status: 'completed' },
    { id: 's3', mentorshipId: 'm1', title: 'Team Feedback Strategies', date: day(-30), time: '14:00', status: 'completed' },
    { id: 's4', mentorshipId: 'm1', title: 'Handling Conflict', date: day(-14), time: '14:00', status: 'completed' },
    { id: 's5', mentorshipId: 'm1', title: 'Next session', date: day(1), time: '14:00', status: 'scheduled', prompt: "What's one challenge you've faced in the past month and how did you overcome it?" },
    { id: 's6', group: true, title: 'Leadership Tips!', date: day(8), time: '10:00', status: 'scheduled', hostIds: ['u-david', 'u-emma'], attendeeIds: ['u-adam'] },
  );
  doc.results.push(
    { id: 'r1', userId: 'u-luke', gameId: 'g-trivia', score: 520, points: 145, label: 'Weekly Tournament', createdAt: t(3) },
    { id: 'r2', userId: 'u-emma', gameId: 'g-quiz', score: 440, points: 210, label: 'Reached Rank 4', createdAt: t(6) },
    { id: 'r3', userId: 'u-swong', gameId: 'g-scramble', score: 455, points: 100, label: '', createdAt: t(30) },
    { id: 'r4', userId: 'u-jason', gameId: 'g-memory', score: 400, points: 110, label: '', createdAt: t(40) },
    { id: 'r5', userId: 'u-ben', gameId: 'g-trivia', score: 385, points: 90, label: '', createdAt: t(50) },
    { id: 'r6', userId: 'u-sarah', gameId: 'g-memory', score: 870, points: 110, label: '', createdAt: t(70) },
  );
  return doc;
}
