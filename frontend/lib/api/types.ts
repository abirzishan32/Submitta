/**
 * TypeScript mirrors of the API's DTOs.
 *
 * Hand-written rather than generated, so the shapes stay readable and carry the
 * same intent as the C# records. Nullable fields are `| null` rather than
 * optional, because the API writes its nulls explicitly.
 */

export type UserRole = "Admin" | "Teacher" | "Student";

export type AssignmentStatus = "Draft" | "Published" | "Archived";

export type SubmissionStatus =
  | "Submitted"
  | "UnderReview"
  | "Graded"
  | "ReturnedForRevision";

/** The envelope every endpoint responds with. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

// --- Auth -------------------------------------------------------------------

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: UserProfile;
}

// --- Admin: users -----------------------------------------------------------

export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserClassLink {
  classId: string;
  className: string;
  classCode: string;
  classSubjectId: string | null;
  subjectName: string | null;
}

export interface UserDetail extends UserDto {
  classes: UserClassLink[];
}

// --- Admin: academics -------------------------------------------------------

export interface ClassDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  academicYear: string | null;
  isActive: boolean;
  enrolledStudentCount: number;
  subjectCount: number;
  createdAt: string;
}

export interface SubjectDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  offeringCount: number;
  createdAt: string;
}

export interface AssignedTeacher {
  teacherAssignmentId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  assignedAt: string;
}

export interface OfferingDto {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teachers: AssignedTeacher[];
  assignmentCount: number;
}

export interface EnrollmentDto {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId: string;
  className: string;
  classCode: string;
  enrolledAt: string;
}

// --- Lookups ----------------------------------------------------------------

export interface OfferingOption {
  classSubjectId: string;
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  enrolledStudentCount: number;
  label: string;
}

export interface ClassOption {
  classId: string;
  className: string;
  classCode: string;
  academicYear: string | null;
}

export interface SubjectOption {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
}

// --- Teacher: assignments ---------------------------------------------------

export interface AssignmentDto {
  gradingType: GradingType;
  hasAttachments: boolean;
  id: string;
  title: string;
  classSubjectId: string;
  className: string;
  classCode: string;
  subjectName: string;
  subjectCode: string;
  deadline: string;
  maxMarks: number;
  status: AssignmentStatus;
  publishedAt: string | null;
  allowResubmission: boolean;
  allowLateSubmission: boolean;
  createdByTeacherName: string;
  submissionCount: number;
  gradedCount: number;
  enrolledStudentCount: number;
  createdAt: string;
}

export type GradingType = "Points" | "Percentage" | "PassFail" | "Rubric";

/** One line of a rubric, with what a submission scored on it when marked. */
export interface RubricCriterion {
  id: string;
  order: number;
  title: string;
  description: string | null;
  maxPoints: number;
  points?: number | null;
  comment?: string | null;
}

export interface AssignmentAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface AssignmentDetail extends Omit<AssignmentDto, "createdAt"> {
  description: string;
  descriptionJson: string | null;
  gradingType: GradingType;
  rubric: RubricCriterion[];
  attachments: AssignmentAttachment[];
  createdByTeacherId: string;
  isPastDeadline: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// --- Teacher: grading -------------------------------------------------------

export interface SubmissionSummary {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedAt: string;
  lastUpdatedAt: string | null;
  isLate: boolean;
  status: SubmissionStatus;
  marks: number | null;
  maxMarks: number;
  gradedByTeacherName: string | null;
  gradedAt: string | null;
  feedbackCount: number;
}

export interface FeedbackDto {
  id: string;
  teacherId: string;
  teacherName: string;
  comment: string;
  marksAtTime: number | null;
  createdAt: string;
}

export interface SubmissionDetail {
  gradingType: GradingType;
  rubric: RubricCriterion[];
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  maxMarks: number;
  deadline: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  content: string;
  attachmentUrl: string | null;
  submittedAt: string;
  lastUpdatedAt: string | null;
  isLate: boolean;
  status: SubmissionStatus;
  marks: number | null;
  gradedByTeacherId: string | null;
  gradedByTeacherName: string | null;
  gradedAt: string | null;
  feedback: FeedbackDto[];
}

export interface MissingSubmission {
  studentId: string;
  studentName: string;
  studentEmail: string;
}

export interface AssignmentSubmissions {
  assignmentId: string;
  assignmentTitle: string;
  maxMarks: number;
  deadline: string;
  enrolledStudentCount: number;
  submittedCount: number;
  gradedCount: number;
  submissions: SubmissionSummary[];
  notSubmitted: MissingSubmission[];
}

// --- Student ----------------------------------------------------------------

export interface StudentAssignment {
  id: string;
  title: string;
  className: string;
  classCode: string;
  subjectName: string;
  subjectCode: string;
  deadline: string;
  maxMarks: number;
  teacherName: string;
  isPastDeadline: boolean;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  hasSubmitted: boolean;
  submissionStatus: SubmissionStatus | null;
  marks: number | null;
  isLate: boolean;
  submittedAt: string | null;
}

export interface StudentFeedback {
  teacherName: string;
  comment: string;
  marksAtTime: number | null;
  createdAt: string;
}

export interface StudentSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  content: string;
  attachmentUrl: string | null;
  submittedAt: string;
  lastUpdatedAt: string | null;
  isLate: boolean;
  status: SubmissionStatus;
  marks: number | null;
  maxMarks: number;
  gradedByTeacherName: string | null;
  gradedAt: string | null;
  feedback: StudentFeedback[];
}

export interface StudentAssignmentDetail {
  descriptionJson: string | null;
  gradingType: GradingType;
  rubric: RubricCriterion[];
  attachments: Array<{ id: string; fileName: string; sizeBytes: number }>;
  id: string;
  title: string;
  description: string;
  className: string;
  classCode: string;
  subjectName: string;
  subjectCode: string;
  deadline: string;
  maxMarks: number;
  teacherName: string;
  isPastDeadline: boolean;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  publishedAt: string | null;
  mySubmission: StudentSubmission | null;
  /** Decided server-side; the UI must not re-derive these. */
  canSubmit: boolean;
  canEdit: boolean;
  blockedReason: string | null;
}

export interface StudentDashboard {
  totalAssignments: number;
  submittedCount: number;
  pendingCount: number;
  gradedCount: number;
  overdueCount: number;
  averageMarkPercentage: number | null;
  dueSoon: StudentAssignment[];
}

// --- Settings ---------------------------------------------------------------

export interface SettingDto {
  id: string;
  key: string;
  value: string;
  dataType: "boolean" | "integer" | "decimal" | "string";
  description: string | null;
  isPublic: boolean;
  updatedAt: string | null;
}
