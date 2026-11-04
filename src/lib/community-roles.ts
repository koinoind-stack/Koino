/**
 * Koino community role — single source of truth.
 *
 * The role is SELF-REPORTED and optional. It is collected at onboarding
 * (step "profile") and editable later from Edit Profile. It never implies
 * any verification status — if Koino adds ministry verification later it
 * will be a separate, admin-controlled flag (like User.verified).
 *
 * Values are stable snake_case codes stored in User.communityRole.
 * "other" carries the free-text description in User.communityRoleOther.
 */

export const COMMUNITY_ROLES = [
  { value: "pastor", label: "Pastor / Senior Pastor" },
  { value: "associate_pastor", label: "Associate / Assistant Pastor" },
  { value: "youth_pastor", label: "Youth Pastor / Youth Leader" },
  { value: "worship_leader", label: "Worship Leader" },
  { value: "worship_team_member", label: "Worship Team Member / Singer" },
  { value: "church_leader_elder", label: "Church Leader / Elder" },
  { value: "church_deacon", label: "Church Deacon" },
  { value: "evangelist", label: "Evangelist" },
  { value: "missionary", label: "Missionary" },
  { value: "bible_teacher", label: "Bible Teacher / Bible Study Leader" },
  { value: "sunday_school_teacher", label: "Sunday School Teacher" },
  { value: "choir_member", label: "Choir Leader / Choir Member" },
  { value: "prayer_ministry_leader", label: "Prayer Ministry Leader" },
  { value: "church_admin_staff", label: "Church Administrator / Staff" },
  { value: "content_creator", label: "Christian Content Creator" },
  { value: "theology_student", label: "Theology Student / Bible College Student" },
  { value: "seminary_student", label: "Seminary Student" },
  { value: "church_volunteer", label: "Church Volunteer" },
  { value: "business_owner", label: "Christian Business Owner" },
  { value: "regular_member", label: "Regular Church Member" },
  { value: "not_attending", label: "Not currently attending a church" },
  { value: "other", label: "Other" },
] as const;

export type CommunityRoleValue = (typeof COMMUNITY_ROLES)[number]["value"];

export const COMMUNITY_ROLE_OTHER = "other";

/** Max length of the free-text description when role = "other". */
export const COMMUNITY_ROLE_OTHER_MAX = 60;

const COMMUNITY_ROLE_SET: ReadonlySet<string> = new Set(
  COMMUNITY_ROLES.map((r) => r.value),
);

/** Server-side validation: is this a known role value? */
export function isValidCommunityRole(v: unknown): v is CommunityRoleValue {
  return typeof v === "string" && COMMUNITY_ROLE_SET.has(v);
}

/** Label for a stored role value (falls back to the raw value). */
export function communityRoleLabel(value: string | null | undefined): string {
  if (!value) return "";
  return COMMUNITY_ROLES.find((r) => r.value === value)?.label ?? value;
}

/**
 * Resolved PUBLIC label for a user: the role's label, or (for "other") the
 * free-text description. Returns null when nothing should be displayed —
 * e.g. no role set, or "other" chosen with an empty description.
 */
export function resolvedCommunityRoleLabel(
  role: string | null | undefined,
  other: string | null | undefined,
): string | null {
  if (!role) return null;
  if (role === COMMUNITY_ROLE_OTHER) {
    const text = (other || "").trim();
    return text ? text : null;
  }
  return communityRoleLabel(role);
}
