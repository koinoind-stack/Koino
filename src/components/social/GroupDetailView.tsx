"use client";

/**
 * Group detail — a complete Christian community page.
 *
 * Header: cover photo (gradient fallback), group picture, name, category,
 * member count, city, church affiliation (with the admin-verified official
 * badge — group managers can never self-badge).
 *
 * Tabs (spec ⑤): Posts / Members / Events / About.
 *   Posts   — pinned announcement on top, media composer for members,
 *             manager moderation (delete any group post, pin/unpin).
 *   Members — full directory with Owner/Admin/Moderator/Member roles,
 *             owner can grant or revoke roles, managers approve join
 *             requests and remove members.
 *   Events  — group events built on the EXISTING Events system (no
 *             duplicate store), create form for members, shareable via
 *             link and WhatsApp.
 *   About   — description, rules, details, church link, share group.
 *
 * Managers (owner + admin) get a prominent "Edit Group" button; every
 * privileged action is enforced server-side too.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BadgeCheck, CalendarDays, Check, Copy, ImagePlus, Landmark,
  Loader2, MapPin, Megaphone, PinOff, Send, Share2, UserMinus,
  Users, X,
} from "lucide-react";
import { toast } from "sonner";
import type { Post } from "./types";
import { api } from "./types";
import PostCard from "./PostCard";
import PostDetail from "./PostDetail";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";
import GroupForm, { type GroupFormValue } from "./GroupForm";
import GroupEventForm from "./GroupEventForm";

type MemberUser = { id: string; name: string | null; username: string | null; image: string | null };

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  visibility: string;
  coverGradient: number;
  coverImage: string | null;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  language: string | null;
  joinMode: string;
  memberPostPermission: string;
  rules: string | null;
  pinnedPostId: string | null;
  churchId: string | null;
  churchName: string | null;
  churchVerified: boolean;
  memberCount: number;
  createdAt: string;
  createdBy: MemberUser | null;
};

type PinnedPost = {
  id: string;
  content: string | null;
  mediaType: string;
  mediaUrls: string[];
  createdAt: string;
  author: MemberUser;
};

type GroupEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string;
  venueName: string | null;
  eventType: string;
  isOnline: boolean;
  onlineUrl: string | null;
  registrationType: string;
  ticketUrl: string | null;
  isFree: boolean;
  organizerName: string | null;
  organizerPhone: string | null;
  coverImage: string | null;
  coverGradient: number;
  status: string;
  groupVisibility: string;
  createdById: string | null;
};

type Props = {
  groupId: string;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
};

const GRADIENTS = [
  "from-purple-600 to-pink-500",
  "from-indigo-600 to-purple-500",
  "from-fuchsia-600 to-pink-500",
  "from-violet-600 to-indigo-500",
  "from-rose-500 to-orange-400",
  "from-blue-600 to-violet-500",
  "from-pink-500 to-rose-400",
  "from-purple-500 to-cyan-400",
];

const EVENT_GRADIENTS = GRADIENTS;

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  member: "Member",
};

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

type MediaItem = { file: File; preview: string; isVideo: boolean };

export default function GroupDetailView({ groupId, onBack, onOpenProfile, onHashtag }: Props) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<Array<{ role: string; user: MemberUser }>>([]);
  const [pending, setPending] = useState<Array<{ id: string; user: MemberUser }>>([]);
  const [pinnedPost, setPinnedPost] = useState<PinnedPost | null>(null);
  const [perms, setPerms] = useState({ canManage: false, canModerate: false, canPost: false });
  const [viewerStatus, setViewerStatus] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"posts" | "members" | "events" | "about">("posts");
  const [acting, setActing] = useState(false);

  // posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [posting, setPosting] = useState(false);
  const groupTextRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // events
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // edit group
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const groupLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/?view=group-detail&group=${groupId}`
      : "";

  function copyGroupLink() {
    navigator.clipboard?.writeText(groupLink).then(
      () => toast.success("Group link copied — share it anywhere"),
      () => toast.error("Could not copy the link"),
    );
  }

  function shareGroupWhatsApp() {
    const text = group
      ? `Join "${group.name}" on Koino — a Christian community app. ${groupLink}`
      : groupLink;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // ─── loaders ──────────────────────────────────────────────────────────────
  const loadGroup = useCallback(async () => {
    try {
      const d = await api<{
        group: GroupDetail;
        viewer: { status: string | null; role: string | null };
        permissions: { canManage: boolean; canModerate: boolean; canPost: boolean };
        members: Array<{ role: string; user: MemberUser }>;
        pending: Array<{ id: string; user: MemberUser }>;
        pinnedPost: PinnedPost | null;
        restricted: boolean;
      }>(`/api/social/groups/${groupId}`);
      setGroup(d.group);
      setMembers(d.members || []);
      setPending(d.pending || []);
      setPinnedPost(d.pinnedPost || null);
      setPerms(d.permissions || { canManage: false, canModerate: false, canPost: false });
      setViewerStatus(d.viewer?.status ?? null);
      setViewerRole(d.viewer?.role ?? null);
      setRestricted(!!d.restricted);
    } catch (err) {
      toast.error((err as Error).message || "Could not load this group");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadPosts = useCallback(async () => {
    setPostsError(null);
    try {
      const d = await api<{ posts: Post[] }>(`/api/social/posts?groupId=${encodeURIComponent(groupId)}&limit=20`);
      setPosts(d.posts || []);
    } catch (err) {
      setPostsError((err as Error).message);
      setPosts([]);
    }
  }, [groupId]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const d = await api<{ events: GroupEvent[] }>(`/api/social/groups/${groupId}/events`);
      setEvents(d.events || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
    loadPosts();
  }, [loadGroup, loadPosts]);

  useEffect(() => {
    if (tab === "events" && restricted === false) loadEvents();
  }, [tab, restricted, loadEvents]);

  const isMember = viewerStatus === "active";

  // ─── membership actions ───────────────────────────────────────────────────
  async function join() {
    if (acting) return;
    setActing(true);
    try {
      const d = await api<{ status: string }>(`/api/social/groups/${groupId}/members`, { method: "POST" });
      setViewerStatus(d.status);
      toast.success(d.status === "active" ? "Welcome to the group!" : "Request sent — the managers will review it");
      loadGroup();
    } catch (err) {
      toast.error((err as Error).message || "Could not join");
    } finally {
      setActing(false);
    }
  }

  async function leave() {
    if (acting) return;
    setActing(true);
    try {
      await api(`/api/social/groups/${groupId}/members`, { method: "DELETE" });
      setViewerStatus(null);
      setViewerRole(null);
      toast.success("You left the group");
      loadGroup();
      loadPosts();
    } catch (err) {
      toast.error((err as Error).message || "Could not leave");
    } finally {
      setActing(false);
    }
  }

  async function moderateMember(action: "approve" | "remove", userId: string) {
    try {
      await api(`/api/social/groups/${groupId}/members`, {
        method: "PATCH",
        body: JSON.stringify({ action, userId }),
      });
      toast.success(action === "approve" ? "Member approved" : "Removed");
      loadGroup();
    } catch (err) {
      toast.error((err as Error).message || "Action failed");
    }
  }

  async function setRole(userId: string, role: "admin" | "moderator" | "member") {
    try {
      await api(`/api/social/groups/${groupId}/members`, {
        method: "PATCH",
        body: JSON.stringify({ action: "setRole", userId, role }),
      });
      toast.success(`Role updated — now ${ROLE_LABEL[role]}`);
      loadGroup();
    } catch (err) {
      toast.error((err as Error).message || "Could not change the role");
    }
  }

  // ─── posting ──────────────────────────────────────────────────────────────
  function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setMedia((prev) => {
      const hasVideo = prev.some((m) => m.isVideo);
      const next = [...prev];
      for (const f of files) {
        const isVideo = f.type.startsWith("video/");
        if (isVideo) {
          if (next.some((m) => m.isVideo)) {
            toast.error("A post can include only one video");
            continue;
          }
          if (f.size > MAX_VIDEO_SIZE) {
            toast.error("Video must be under 100 MB");
            continue;
          }
          next.push({ file: f, preview: URL.createObjectURL(f), isVideo: true });
        } else if (/^image\/(jpeg|png|webp)$/.test(f.type)) {
          const imageCount = next.filter((m) => !m.isVideo).length;
          if (hasVideo) {
            toast.error("Remove the video first to add photos");
            continue;
          }
          if (imageCount >= MAX_IMAGES) {
            toast.error(`Up to ${MAX_IMAGES} photos per post`);
            continue;
          }
          if (f.size > MAX_IMAGE_SIZE) {
            toast.error("Each photo must be under 10 MB");
            continue;
          }
          next.push({ file: f, preview: URL.createObjectURL(f), isVideo: false });
        } else {
          toast.error("Use JPG, PNG or WEBP photos, or MP4/MOV/WebM video");
        }
      }
      return next;
    });
  }

  function removeMedia(item: MediaItem) {
    URL.revokeObjectURL(item.preview);
    setMedia((prev) => prev.filter((m) => m.preview !== item.preview));
  }

  async function uploadBlob(blob: Blob, kind: "image" | "video"): Promise<string> {
    const res = await api<{ uploadUrl: string; publicUrl: string }>("/api/social/upload-url", {
      method: "POST",
      body: JSON.stringify({ contentType: blob.type, size: blob.size, kind }),
    });
    const put = await fetch(res.uploadUrl, { method: "PUT", body: blob });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return res.publicUrl;
  }

  async function postToGroup() {
    const content = text.trim();
    if ((!content && media.length === 0) || posting) return;
    setPosting(true);
    try {
      const urls: string[] = [];
      for (const m of media) {
        urls.push(await uploadBlob(m.file, m.isVideo ? "video" : "image"));
      }
      const mediaType = media.some((m) => m.isVideo) ? "video" : media.length > 0 ? "image" : "text";
      const d = await api<{ post: Post }>("/api/social/posts", {
        method: "POST",
        body: JSON.stringify({ content, mediaType, mediaUrls: urls, groupId }),
      });
      setPosts((prev) => [d.post, ...prev]);
      setText("");
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      toast.success("Shared with the group");
    } catch (err) {
      toast.error((err as Error).message || "Could not post");
    } finally {
      setPosting(false);
    }
  }

  // ─── pin / moderation ────────────────────────────────────────────────────
  async function pinPost(postId: string) {
    try {
      await api(`/api/social/groups/${groupId}/pin`, { method: "POST", body: JSON.stringify({ postId }) });
      toast.success("Pinned to the top of the group");
      loadGroup();
    } catch (err) {
      toast.error((err as Error).message || "Could not pin");
    }
  }

  async function unpin() {
    try {
      await api(`/api/social/groups/${groupId}/pin`, { method: "DELETE" });
      setPinnedPost(null);
      toast.success("Announcement unpinned");
      setGroup((g) => (g ? { ...g, pinnedPostId: null } : g));
    } catch (err) {
      toast.error((err as Error).message || "Could not unpin");
    }
  }

  // ─── edit group ───────────────────────────────────────────────────────────
  async function saveGroup(v: GroupFormValue) {
    setSaving(true);
    try {
      await api(`/api/social/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify(v),
      });
      toast.success("Group updated");
      setShowEdit(false);
      loadGroup();
    } catch (err) {
      toast.error((err as Error).message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24">
        <div className="h-28 rounded-2xl bg-white/5 animate-pulse mb-4" />
        <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse mb-2" />
        <div className="h-3 w-1/3 bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-16 pb-24 text-center">
        <p className="text-sm text-[#94A3B8] mb-4">This group doesn&apos;t exist or is unavailable.</p>
        <button onClick={onBack} className="text-xs font-bold text-[#7C3AED]">Back to Groups</button>
      </div>
    );
  }

  const grad = GRADIENTS[Math.abs(group.coverGradient ?? 0) % GRADIENTS.length];

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#94A3B8] hover:text-white mb-3">
        <ArrowLeft size={14} /> Groups
      </button>

      {/* ─── edit panel ─── */}
      {showEdit && (
        <div className="mb-4">
          <GroupForm
            mode="edit"
            initial={{
              name: group.name,
              description: group.description || "",
              category: group.category,
              visibility: group.visibility,
              joinMode: group.joinMode,
              coverImage: group.coverImage || "",
              logoUrl: group.logoUrl || "",
              city: group.city || "",
              state: group.state || "",
              language: group.language || "",
              rules: group.rules || "",
              churchId: group.churchId || "",
              churchName: group.churchName || "",
            }}
            submitting={saving}
            onSubmit={saveGroup}
            onCancel={() => setShowEdit(false)}
          />
        </div>
      )}

      {/* ─── header ─── */}
      <div className={`relative h-28 rounded-2xl bg-gradient-to-br ${grad} flex items-end p-3 overflow-hidden`}>
        {group.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        {group.visibility === "private" && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white/90">
            <Users size={10} /> Private
          </span>
        )}
        {group.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.logoUrl}
            alt=""
            className="relative w-12 h-12 rounded-xl object-cover border-2 border-white/30 shadow-lg"
          />
        ) : (
          <span className="relative w-12 h-12 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-extrabold text-lg border-2 border-white/20">
            {group.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between mt-3 gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-white leading-tight">{group.name}</h1>
          <p className="text-[11px] text-[#94A3B8] capitalize inline-flex flex-wrap items-center gap-x-1.5 mt-0.5">
            <Users size={11} /> {group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.category.replace("-", " ")}
            {(group.city || group.state) && (
              <>
                {" · "}
                <MapPin size={10} className="inline" />
                {[group.city, group.state].filter(Boolean).join(", ")}
              </>
            )}
          </p>
          {group.churchName && (
            <p className="text-[11px] text-[#94A3B8] inline-flex items-center gap-1 mt-0.5">
              <Landmark size={10} className="text-[#C4B5FD]" />
              {group.churchName}
              {group.churchVerified && (
                <span className="inline-flex items-center gap-0.5 text-[#60A5FA] font-bold">
                  <BadgeCheck size={11} /> Official
                </span>
              )}
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isMember ? (
            viewerRole === "owner" ? (
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300">Owner</span>
            ) : (
              <button onClick={leave} disabled={acting} className="text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#94A3B8] hover:text-white disabled:opacity-40">
                Leave
              </button>
            )
          ) : viewerStatus === "pending" ? (
            <span className="text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-white/[0.06] text-[#94A3B8]">Requested</span>
          ) : (
            <button onClick={join} disabled={acting} className="text-[11px] font-bold px-4 py-1.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-40">
              {group.visibility === "private" || group.joinMode === "approval" ? "Request to join" : "Join"}
            </button>
          )}
          {perms.canManage && (
            <button
              onClick={() => setShowEdit((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-[#7C3AED]/15 border border-[#7C3AED]/40 text-[#C4B5FD] hover:bg-[#7C3AED]/25"
            >
              Edit Group
            </button>
          )}
        </div>
      </div>

      {group.description && !showEdit && <p className="text-[13px] text-[#CBD5E1] mt-2">{group.description}</p>}

      {/* ─── tabs ─── */}
      {restricted ? (
        <div className="text-center py-12 mt-6">
          <Users size={22} className="text-[#64748B] mx-auto mb-3" />
          <p className="text-sm text-[#94A3B8]">This group is private. Join to see posts, members and events.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mt-4 border-b border-white/[0.06]">
            {(["posts", "members", "events", "about"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-2.5 text-xs font-extrabold capitalize border-b-2 -mb-px transition-colors ${
                  tab === t ? "border-[#7C3AED] text-white" : "border-transparent text-[#64748B] hover:text-[#94A3B8]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ═══ POSTS TAB ═══ */}
          {tab === "posts" && (
            <div className="mt-4 space-y-4">
              {pinnedPost && (
                <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Megaphone size={12} className="text-amber-300" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">Announcement</span>
                    {perms.canModerate && (
                      <button onClick={unpin} className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-[#94A3B8] hover:text-white">
                        <PinOff size={11} /> Unpin
                      </button>
                    )}
                  </div>
                  <button onClick={() => setDetailId(pinnedPost.id)} className="text-left w-full">
                    <p className="text-xs text-[#CBD5E1] line-clamp-3">{pinnedPost.content || "(media post)"}</p>
                    <p className="text-[10px] text-[#64748B] mt-1">
                      {pinnedPost.author.name || pinnedPost.author.username || "Manager"}
                    </p>
                  </button>
                </div>
              )}

              {perms.canPost ? (
                <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-3">
                  <textarea
                    ref={groupTextRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    maxLength={2200}
                    placeholder={`Share something with ${group.name}…`}
                    className="w-full bg-transparent border-none outline-none resize-none text-sm text-white placeholder:text-[#64748B]"
                  />
                  {media.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {media.map((m) => (
                        <div key={m.preview} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/[0.08]">
                          {m.isVideo ? (
                            <video src={m.preview} className="w-full h-full object-cover" muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.preview} alt="" className="w-full h-full object-cover" />
                          )}
                          <button onClick={() => removeMedia(m)} className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-white" aria-label="Remove">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <EmojiPickerButton
                        align="left"
                        onPick={(e) => insertAtCursor(groupTextRef.current, e, setText, 2200)}
                      />
                      <button
                        onClick={() => mediaInputRef.current?.click()}
                        className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-white/[0.05]"
                        title="Add photo or video"
                      >
                        <ImagePlus size={15} />
                      </button>
                      <input
                        ref={mediaInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                        multiple
                        className="hidden"
                        onChange={pickMedia}
                      />
                      {group.memberPostPermission === "admins" && !perms.canManage && (
                        <span className="text-[10px] text-[#64748B]">Admins-only posting is on</span>
                      )}
                    </div>
                    <button
                      onClick={postToGroup}
                      disabled={(!text.trim() && media.length === 0) || posting}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
                    >
                      {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {posting ? "Posting…" : "Post"}
                    </button>
                  </div>
                </div>
              ) : isMember ? (
                <p className="text-[11px] text-[#64748B] text-center py-2">
                  Only the group owner and admins can publish posts in this group.
                </p>
              ) : null}

              {postsError ? (
                <div className="text-center py-8">
                  <p className="text-xs text-[#94A3B8] mb-2">{postsError}</p>
                  <button onClick={loadPosts} className="text-xs font-bold text-[#7C3AED]">Try again</button>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-10">
                  <Send size={20} className="text-[#475569] mx-auto mb-2.5" />
                  <p className="text-sm text-[#94A3B8]">
                    {isMember ? "No posts yet — start the conversation!" : "Join the group to see and share posts."}
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    canModerate={perms.canModerate}
                    onOpenDetail={(p) => setDetailId(p.id)}
                    onOpenProfile={onOpenProfile}
                    onHashtag={onHashtag}
                    onOpenReel={() => {}}
                    onChanged={loadPosts}
                  />
                ))
              )}
            </div>
          )}

          {/* ═══ MEMBERS TAB ═══ */}
          {tab === "members" && (
            <div className="mt-4 space-y-4">
              {perms.canModerate && pending.length > 0 && (
                <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-3">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 mb-2">
                    Join requests ({pending.length})
                  </h3>
                  <div className="space-y-2">
                    {pending.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <button onClick={() => p.user.username && onOpenProfile(p.user.username)} className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] inline-flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shrink-0">
                          {p.user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.user.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (p.user.name || p.user.username || "?").charAt(0).toUpperCase()
                          )}
                        </button>
                        <span className="text-xs font-bold text-white truncate flex-1">
                          {p.user.name || p.user.username || "Someone"}
                        </span>
                        <button onClick={() => moderateMember("approve", p.user.id)} className="p-1.5 rounded-lg bg-[#7C3AED] text-white" title="Approve">
                          <Check size={13} />
                        </button>
                        <button onClick={() => moderateMember("remove", p.user.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-[#94A3B8]" title="Decline">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-3">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">
                  Members ({group.memberCount})
                </h3>
                <div className="space-y-1">
                  {members.map((m) => (
                    <div key={m.user.id} className="flex items-center gap-2 py-1">
                      <button onClick={() => m.user.username && onOpenProfile(m.user.username)} className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] overflow-hidden inline-flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {m.user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.user.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (m.user.name || m.user.username || "?").charAt(0).toUpperCase()
                        )}
                      </button>
                      <button
                        onClick={() => m.user.username && onOpenProfile(m.user.username)}
                        className="text-xs font-bold text-white hover:text-[#C4B5FD] truncate flex-1 text-left"
                      >
                        {m.user.name || m.user.username || "Member"}
                      </button>
                      <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        m.role === "owner"
                          ? "bg-amber-500/15 text-amber-300"
                          : m.role === "admin"
                            ? "bg-[#7C3AED]/20 text-[#C4B5FD]"
                            : m.role === "moderator"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-white/[0.05] text-[#64748B]"
                      }`}>
                        {ROLE_LABEL[m.role] || m.role}
                      </span>
                      {viewerRole === "owner" && m.role !== "owner" && m.role !== "admin" && (
                        <select
                          value={m.role}
                          onChange={(e) => setRole(m.user.id, e.target.value as "admin" | "moderator" | "member")}
                          className="shrink-0 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[10px] font-bold text-[#94A3B8] px-1.5 py-1 outline-none"
                          title="Change role"
                        >
                          <option value="member" className="bg-[#111827]">Member</option>
                          <option value="moderator" className="bg-[#111827]">Moderator</option>
                          <option value="admin" className="bg-[#111827]">Admin</option>
                        </select>
                      )}
                      {viewerRole === "owner" && m.role === "admin" && (
                        <button onClick={() => setRole(m.user.id, "member")} className="shrink-0 text-[10px] font-bold text-[#94A3B8] hover:text-white px-1.5" title="Remove admin role">
                          Demote
                        </button>
                      )}
                      {perms.canModerate && m.role !== "owner" && (m.role !== "admin" && m.role !== "moderator" || perms.canManage) && (
                        <button
                          onClick={() => moderateMember("remove", m.user.id)}
                          className="shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-[#94A3B8] hover:text-[#F87171]"
                          title="Remove from group"
                        >
                          <UserMinus size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ EVENTS TAB ═══ */}
          {tab === "events" && (
            <div className="mt-4 space-y-4">
              {isMember && !showEventForm && (
                <button
                  onClick={() => setShowEventForm(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#7C3AED]/40 bg-[#7C3AED]/[0.06] text-xs font-extrabold text-[#C4B5FD] hover:bg-[#7C3AED]/[0.12] inline-flex items-center justify-center gap-1.5"
                >
                  <CalendarDays size={13} /> Create a group event
                </button>
              )}
              {showEventForm && isMember && (
                <GroupEventForm
                  groupId={groupId}
                  isPrivateGroup={group.visibility === "private"}
                  onCreated={() => {
                    setShowEventForm(false);
                    loadEvents();
                  }}
                  onCancel={() => setShowEventForm(false)}
                />
              )}

              {eventsLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-10">
                  <CalendarDays size={20} className="text-[#475569] mx-auto mb-2.5" />
                  <p className="text-sm text-[#94A3B8]">
                    {isMember ? "No events yet — plan the first one!" : "No public events in this group yet."}
                  </p>
                </div>
              ) : (
                events.map((ev) => <GroupEventCard key={ev.id} ev={ev} />)
              )}
            </div>
          )}

          {/* ═══ ABOUT TAB ═══ */}
          {tab === "about" && (
            <div className="mt-4 space-y-4">
              <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-2">About</h3>
                <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
                  {group.description || "This group hasn't written a description yet."}
                </p>
                {group.rules && (
                  <>
                    <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mt-4 mb-2">Group rules</h3>
                    <p className="text-[12px] text-[#94A3B8] leading-relaxed whitespace-pre-line">{group.rules}</p>
                  </>
                )}
              </div>

              <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">Details</h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#64748B]">Category</dt>
                    <dd className="text-white font-bold capitalize">{group.category.replace("-", " ")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#64748B]">Visibility</dt>
                    <dd className="text-white font-bold capitalize">{group.visibility}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#64748B]">Joining</dt>
                    <dd className="text-white font-bold">
                      {group.visibility === "private" ? "Manager approval" : group.joinMode === "approval" ? "Manager approval" : "Open to everyone"}
                    </dd>
                  </div>
                  {(group.city || group.state) && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#64748B]">Location</dt>
                      <dd className="text-white font-bold">{[group.city, group.state].filter(Boolean).join(", ")}</dd>
                    </div>
                  )}
                  {group.language && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#64748B]">Language</dt>
                      <dd className="text-white font-bold">{group.language}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#64748B]">Created</dt>
                    <dd className="text-white font-bold">{new Date(group.createdAt).toLocaleDateString()}</dd>
                  </div>
                  {group.createdBy && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#64748B]">Started by</dt>
                      <dd className="text-white font-bold truncate">{group.createdBy.name || group.createdBy.username}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {group.churchName && (
                <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Church</h3>
                  <p className="text-xs text-white font-bold inline-flex items-center gap-1.5">
                    <Landmark size={13} className="text-[#C4B5FD]" /> {group.churchName}
                    {group.churchVerified && (
                      <span className="inline-flex items-center gap-1 text-[#60A5FA]">
                        <BadgeCheck size={13} /> Verified official affiliation
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-1.5 leading-relaxed">
                    {group.churchVerified
                      ? "This affiliation has been verified by the Koino team."
                      : "Community-listed affiliation — pending official verification. Linking alone never grants church permissions."}
                  </p>
                </div>
              )}

              <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">Share this group</h3>
                <div className="flex gap-2">
                  <button onClick={copyGroupLink} className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold inline-flex items-center justify-center gap-1.5">
                    <Copy size={12} /> Copy invite link
                  </button>
                  <button onClick={shareGroupWhatsApp} className="flex-1 py-2 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#4ADE80] text-xs font-bold inline-flex items-center justify-center gap-1.5">
                    <Share2 size={12} /> WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {detailId && (
        <PostDetail
          postId={detailId}
          onClose={() => setDetailId(null)}
          onOpenProfile={onOpenProfile}
          onHashtag={onHashtag}
          onChanged={loadPosts}
        />
      )}
    </div>
  );
}

/** Compact event card for the group Events tab — shareable via link/WhatsApp. */
function GroupEventCard({ ev }: { ev: GroupEvent }) {
  const [showDetail, setShowDetail] = useState(false);
  const grad = EVENT_GRADIENTS[Math.abs(ev.coverGradient ?? 0) % EVENT_GRADIENTS.length];
  const date = new Date(ev.startDate);
  const dateStr = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?view=events`
      : "";
  const shareText = `${ev.title} — ${dateStr}${ev.startTime ? ` at ${ev.startTime}` : ""} · ${ev.isOnline ? "Online" : ev.location}`;

  function copyEvent() {
    navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`).then(() => toast.success("Event copied — paste it anywhere"), () => {});
  }
  function whatsappEvent() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank");
  }

  return (
    <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl overflow-hidden">
      <button onClick={() => setShowDetail((v) => !v)} className="w-full text-left flex items-center gap-3 p-3">
        {ev.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.coverImage} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} shrink-0 inline-flex items-center justify-center text-white`}>
            <CalendarDays size={18} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="text-sm font-bold text-white block truncate">{ev.title}</span>
          <span className="text-[11px] text-[#94A3B8] block truncate">
            {dateStr}{ev.startTime && !ev.allDay ? ` · ${ev.startTime}` : ""} · {ev.isOnline && ev.eventType !== "hybrid" ? "Online" : ev.location}
          </span>
          <span className="flex gap-1.5 mt-1">
            {ev.status === "PENDING" && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">In review</span>
            )}
            {ev.groupVisibility === "members" && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#94A3B8]">Members only</span>
            )}
            {ev.registrationType === "registration_required" && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#7C3AED]/20 text-[#C4B5FD]">Register</span>
            )}
          </span>
        </span>
      </button>
      {showDetail && (
        <div className="px-3 pb-3 border-t border-white/[0.05] pt-2.5">
          <p className="text-xs text-[#CBD5E1] line-clamp-4 mb-2">{ev.description}</p>
          {ev.organizerName && <p className="text-[10px] text-[#64748B]">Host: {ev.organizerName}{ev.organizerPhone ? ` · ${ev.organizerPhone}` : ""}</p>}
          <div className="flex gap-2 mt-2">
            <button onClick={copyEvent} className="flex-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold text-[#94A3B8] hover:text-white inline-flex items-center justify-center gap-1">
              <Copy size={10} /> Copy
            </button>
            <button onClick={whatsappEvent} className="flex-1 py-1.5 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 text-[10px] font-bold text-[#4ADE80] inline-flex items-center justify-center gap-1">
              <Share2 size={10} /> WhatsApp
            </button>
            {ev.ticketUrl && (
              <a href={ev.ticketUrl} target="_blank" rel="noreferrer" className="flex-1 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[10px] font-bold inline-flex items-center justify-center gap-1">
                Register
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
