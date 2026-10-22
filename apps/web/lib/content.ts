export const content: Record<
  string,
  { eyebrow: string; title: string; intro: string; sections: { title: string; text: string }[] }
> = {
  features: {
    eyebrow: 'YOUR CREATIVE BUSINESS, CONNECTED',
    title: 'One place for what comes next.',
    intro: 'Bring conversations, leads, resources, and products into a focused creator workspace.',
    sections: [
      {
        title: 'Conversations with a purpose',
        text: 'Build keyword-based comment automations. Use a visibly labeled simulation to test matching, then connect an approved professional Instagram account for eligible private replies.',
      },
      {
        title: 'An audience you understand',
        text: 'Create public lead forms, record consent, organize leads by status and tags, add notes, and export your CRM as CSV.',
      },
      {
        title: 'A home for your expertise',
        text: 'Create products and courses, prepare a storefront, and protect downloads behind verified payment entitlements. Live payments require an approved merchant account.',
      },
      {
        title: 'Less repetitive work',
        text: 'Build versioned workflows for lead and form events. Add tags, update statuses, branch on consent, and create internal notifications.',
      },
    ],
  },
  'instagram-autodm': {
    eyebrow: 'THOUGHTFUL CONVERSATIONS',
    title: 'Be there when interest sparks.',
    intro: 'A helpful private reply can be the start of a meaningful connection.',
    sections: [
      {
        title: 'Start with an eligible comment',
        text: 'Use a specific Instagram post or reel and define exact or contains keyword rules. Activation requires a healthy connection and configured Meta approval.',
      },
      {
        title: 'Keep expectations clear',
        text: 'The engine checks eligibility, deduplicates events, applies quotas, and records API outcomes. API acceptance is not proof of delivery or reading.',
      },
      {
        title: 'Respect the conversation',
        text: 'No scraping, password collection, unlimited-DM promises, or follower verification. Instagram Live and unsolicited follow-up campaigns are not supported.',
      },
    ],
  },
  'lead-generation': {
    eyebrow: 'FROM INTEREST TO CONNECTION',
    title: 'Make your audience feel known.',
    intro: 'A practical CRM built around the people behind the numbers.',
    sections: [
      {
        title: 'Capture what matters',
        text: 'Public forms capture a name, email, configured fields, and separate marketing preferences. A resource request does not automatically grant marketing consent.',
      },
      {
        title: 'Keep useful context',
        text: 'Search, filter by lead status, organize tags, and add notes. Duplicate emails are detected within each workspace.',
      },
      {
        title: 'Take your data with you',
        text: 'Export leads in CSV and workspace data in JSON. Workspace owners control access and deletion.',
      },
    ],
  },
  'lead-magnets': {
    eyebrow: 'A LITTLE VALUE GOES A LONG WAY',
    title: 'Your expertise, generously shared.',
    intro: 'Turn a helpful guide, checklist, video, or resource into a reason to connect.',
    sections: [
      {
        title: 'Choose your resource',
        text: 'Upload a private file to configured S3 storage or add a secure HTTPS resource URL. Attach it to a published lead form.',
      },
      {
        title: 'Deliver with care',
        text: 'Form submissions create resource-delivery records and queue transactional emails. Download tokens expire; private files use short-lived signed URLs.',
      },
      {
        title: 'Know what happened',
        text: 'Track form submissions and CRM records independently. Sending an email or a reply does not establish that a link was opened.',
      },
    ],
  },
  'automation-workflows': {
    eyebrow: 'YOUR NEXT STEP, CONNECTED',
    title: 'Connect the dots. Keep creating.',
    intro: 'Build a clear, visual flow for everyday audience tasks.',
    sections: [
      {
        title: 'Start from a real event',
        text: 'Lead-created and form-submitted triggers create durable workflow executions. Published versions are immutable so work runs against a consistent graph.',
      },
      {
        title: 'Choose practical actions',
        text: 'Assign a tag, change lead status, create an internal notification, or branch on a tag or marketing consent. Unsupported external actions are not presented as available.',
      },
      {
        title: 'Publish with confidence',
        text: 'The server rejects cycles, invalid connections, missing configuration, and unreachable nodes. You can save drafts and pause published flows.',
      },
    ],
  },
  'digital-product-store': {
    eyebrow: 'FROM CREATOR TO BUSINESS',
    title: 'Make your best work available.',
    intro: 'A branded storefront for digital downloads and courses.',
    sections: [
      {
        title: 'Set up your space',
        text: 'Name your store, choose its accent color, and publish products at a unique store URL. Prices are stored in minor currency units.',
      },
      {
        title: 'A verified path to access',
        text: 'Checkout uses the creator’s approved Stripe connected account. Only a verified, matching payment webhook grants a digital entitlement.',
      },
      {
        title: 'Protect your product',
        text: 'Customers sign in with their verified email to access purchases. Full refunds revoke download and paid-course access.',
      },
    ],
  },
  courses: {
    eyebrow: 'KNOWLEDGE WORTH SHARING',
    title: 'Teach the thing only you can.',
    intro: 'Organize your expertise into a course your audience can follow.',
    sections: [
      {
        title: 'Build your curriculum',
        text: 'Create ordered modules and text lessons, with HTTPS video resource links. Keep a course in draft while you prepare.',
      },
      {
        title: 'Choose free or paid access',
        text: 'Free courses allow verified users to enroll. Paid courses require a valid purchase entitlement before enrollment and on each access.',
      },
      {
        title: 'See progress, one lesson at a time',
        text: 'Students can mark lessons complete in their learning dashboard. Completion is persisted per account.',
      },
    ],
  },
  analytics: {
    eyebrow: 'REAL SIGNALS, CLEARER DECISIONS',
    title: 'Understand your momentum.',
    intro: 'See your workspace activity without confusing it with outcomes you cannot verify.',
    sections: [
      {
        title: 'Know your definitions',
        text: 'Leads are saved CRM records. Replies are API-accepted requests. Revenue is verified paid order value, grouped by currency.',
      },
      {
        title: 'Choose a useful window',
        text: 'Explore 7, 30, or 90 days of activity. Lead growth is grouped in your workspace timezone.',
      },
      {
        title: 'Start with an honest empty state',
        text: 'A new workspace displays no fabricated metrics, customer names, or commercial proof. Your own activity builds the picture.',
      },
    ],
  },
  about: {
    eyebrow: 'BUILT AROUND CREATIVITY',
    title: 'More room for the work that matters.',
    intro:
      'CreatorFlow is a new creator-business platform built to bring useful tools into one focused workspace.',
    sections: [
      {
        title: 'A clear purpose',
        text: 'Creators should be able to nurture their audience without spending every day switching between disconnected tools.',
      },
      {
        title: 'Original by design',
        text: 'CreatorFlow has its own visual identity and implementation. It does not reproduce another platform’s branding, designs, or source code.',
      },
      {
        title: 'An honest starting point',
        text: 'This deployment is a scaffold undergoing validation. Customer testimonials, operating-company details, final pricing, and commercial terms must be supplied before a public commercial launch.',
      },
    ],
  },
  contact: {
    eyebrow: 'LET’S KEEP IT HUMAN',
    title: 'How can we help?',
    intro: 'Existing users can open a support ticket inside their workspace.',
    sections: [
      {
        title: 'Workspace support',
        text: 'Sign in, open Help & support, and create a ticket. Replies from platform administrators remain attached to your request.',
      },
      {
        title: 'Before you join',
        text: 'A public support email and the operating business’s contact details have not been configured for this deployment. Please contact the person who shared this instance with you.',
      },
    ],
  },
  faq: {
    eyebrow: 'A LITTLE CLARITY',
    title: 'Answers before your next step.',
    intro: 'A few things to know about your creator workspace.',
    sections: [
      {
        title: 'Which Instagram accounts are supported?',
        text: 'The official Instagram Login integration is intended for eligible professional accounts. Actual access depends on current Meta permissions, app review, and business verification requirements.',
      },
      {
        title: 'Will CreatorFlow send unlimited DMs?',
        text: 'No. Eligible replies are constrained by Meta rules and workspace quotas. No scraping or follower-verification promises are made.',
      },
      {
        title: 'What happens without credentials?',
        text: 'External integrations remain not configured or disconnected. Simulations are labeled explicitly and never reported as external success.',
      },
      {
        title: 'Can my teammates access other workspaces?',
        text: 'Only membership-authorized workspaces are accessible. Viewer roles are read-only, and tenant-owned records are scoped on the server.',
      },
    ],
  },
  blog: {
    eyebrow: 'THE CREATORFLOW JOURNAL',
    title: 'Good ideas deserve room to grow.',
    intro: 'Product notes and practical thinking for a more connected creative business.',
    sections: [
      {
        title: 'Start with the next useful step',
        text: 'A good lead magnet solves one clear problem. Create a focused resource, pair it with a simple form, and decide how you will measure submissions before you share it.',
      },
      {
        title: 'Consent is part of the conversation',
        text: 'Separate delivery of a requested resource from marketing permission. Clear language and recorded preferences help you respect your audience.',
      },
      {
        title: 'Measure what you actually know',
        text: 'An API response, a form submission, and a purchase are different events. Keep those definitions separate when reviewing your performance.',
      },
    ],
  },
  terms: {
    eyebrow: 'DRAFT · REVIEW BEFORE COMMERCIAL LAUNCH',
    title: 'Terms of service.',
    intro:
      'This is an implementation notice, not finalized commercial legal terms. The operating entity, jurisdiction, refund policy, and contractual terms must be reviewed and supplied by the operator.',
    sections: [
      {
        title: 'Use of this development deployment',
        text: 'Use only accounts, content, and data you are authorized to manage. Do not use the service for unsolicited messaging, unlawful content, or circumvention of provider restrictions.',
      },
      {
        title: 'External services',
        text: 'Instagram, storage, email, and payment services require separate configuration and approvals. Their availability and applicable policies are controlled by those providers.',
      },
      {
        title: 'Data and access',
        text: 'Workspace owners control membership and content. Keep account credentials secure and use export and deletion tools responsibly.',
      },
    ],
  },
  privacy: {
    eyebrow: 'DRAFT · OPERATOR DETAILS REQUIRED',
    title: 'Privacy notice.',
    intro:
      'This draft describes the scaffold’s data handling. The operator must add its identity, contact details, lawful bases, retention schedule, subprocessors, and applicable rights before collecting production data.',
    sections: [
      {
        title: 'Data stored',
        text: 'Account credentials are hashed; sessions and one-time links are stored as hashes. Workspace content includes leads, consent records, products, activity, and support tickets. OAuth tokens are encrypted server-side.',
      },
      {
        title: 'Purpose and providers',
        text: 'The application uses data to authenticate users, provide authorized workspace features, and deliver requested resources. Configured external providers may process email, files, social events, and payments.',
      },
      {
        title: 'Your controls',
        text: 'You can export your profile or workspace data, request password changes, and remove authorized workspace records. Workspace owners can delete a workspace after resolving billing and stored files.',
      },
      {
        title: 'Cookies',
        text: 'The application uses an HTTP-only session cookie and a CSRF token cookie. These support authentication and request protection. No advertising cookies are implemented.',
      },
    ],
  },
};
