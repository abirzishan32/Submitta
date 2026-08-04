/** Mirrors the API's NotificationType. Serialised as names, like every enum. */
export type NotificationType =
  | "AssignmentPublished"
  | "DeadlineApproaching"
  | "SubmissionReceived"
  | "SubmissionGraded"
  | "SubmissionReturned"
  | "AccountAwaitingApproval";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: Notification[];
  unreadCount: number;
  totalCount: number;
}

/** What arrives on the live stream. */
export interface NotificationEvent {
  notification: Notification;
  unreadCount: number;
}
