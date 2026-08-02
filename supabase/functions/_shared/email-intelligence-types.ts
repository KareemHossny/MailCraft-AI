export type EmailMode = "compose" | "reply";
export type EmailLanguage = "en" | "ar";
export type CommunicationWorkflow =
  | "client_proposal"
  | "proposal_follow_up"
  | "project_update"
  | "payment_reminder"
  | "revision_request"
  | "client_complaint"
  | "custom";
export type EmailRefinement =
  | "shorter"
  | "longer"
  | "formal"
  | "casual"
  | "executive"
  | "persuasive"
  | "concise"
  | "recruiter"
  | "investor"
  | "sales"
  | "british"
  | "american"
  | "friendlier"
  | "warmer"
  | "confident"
  | "simpler_english"
  | "more_natural"
  | "follow_up"
  | "direct"
  | "polite"
  | "ats_friendly"
  | "ceo"
  | "sales_pitch"
  | "customer_support"
  | "networking";

export type UserProfileContext = {
  fullName?: string;
  jobTitle?: string;
  company?: string;
  companyWebsite?: string;
  industry?: string;
  country?: string;
  preferredSignature?: string;
  defaultTone?: string;
  defaultLanguage?: EmailLanguage;
  linkedInUrl?: string;
  phoneNumber?: string;
  preferredPronouns?: string;
  timeZone?: string;
  preferredGreeting?: string;
  defaultCta?: string;
  defaultSignOff?: string;
  mainService?: string;
  professionalBio?: string;
  portfolioUrl?: string;
  defaultCurrency?: string;
  commonServices?: string;
  defaultPaymentTerms?: string;
};

export type ClientContext = {
  clientName?: string;
  company?: string;
  project?: string;
  service?: string;
  projectStatus?: string;
  paymentStatus?: string;
  deadline?: string;
  amount?: string;
  importantFacts?: string;
  nextAction?: string;
};

export type EmailGenerationRequest = {
  mode: EmailMode;
  senderRole?: string;
  recipientRole?: string;
  purpose?: string;
  keyPoints?: string;
  incomingEmail?: string;
  tone?: string;
  length?: string;
  language: EmailLanguage;
  urgency?: string;
  cta?: string;
  context?: string;
  avoid?: string;
  signature?: string;
  profile?: UserProfileContext;
  template?: string;
  englishVariant?: "american" | "british";
  refine?: EmailRefinement;
  previousSubject?: string;
  previousBody?: string;
  previousHistoryId?: string;
  workflow?: CommunicationWorkflow;
  clientContext?: ClientContext;
};

export type EmailIntelligenceOutput = {
  analysis: {
    intent: string;
    tone: string;
    hooks: string[];
    pain_points: string[];
  };
  strategy: {
    summary: string;
    personalization_used: string[];
    why_it_should_work: string[];
    next_best_action: string;
    tone?: string;
    goal?: string;
    audience?: string;
    primary_cta?: string;
    writing_style?: string;
    facts_used?: number;
    estimated_reading_time_seconds?: number;
  };
  subject_lines: string[];
  email: string;
  score: {
    personalization: number;
    clarity: number;
    persuasion: number;
    overall: number;
  };
  analytics: {
    readability: number;
    cta_strength: number;
    spam_risk: number;
    response_likelihood: number;
    indicators: string[];
  };
  grounding: {
    confidence: number;
    status: "grounded" | "review";
    sources: Array<{
      label: string;
      detail: string;
    }>;
    ignored_categories: string[];
    potential_claims: Array<{
      text: string;
      reason: string;
      recommendation: string;
    }>;
  };
  quality: {
    overall: number;
    dimensions: Array<{
      key: "grammar" | "structure" | "tone" | "length" | "grounding" | "cta" | "signature" | "readability";
      label: string;
      score: number;
      reasons: string[];
      suggestion?: string;
    }>;
  };
  readability: {
    word_count: number;
    reading_time_seconds: number;
    reading_level: "Simple" | "Business" | "Advanced";
    paragraphs: number;
    average_sentence_length: number;
  };
  revision?: {
    changes: string[];
  };
  validation?: {
    attempts: number;
    regenerated: boolean;
    status: "passed" | "fallback_used";
    unsupported_claims_removed: string[];
  };
};
