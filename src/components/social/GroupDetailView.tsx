"use client";

/**
 * Group detail — header (cover, name, category, members), join/leave,
 * owner tools (approve pending requests, remove members), a lightweight
 * group composer, and the group's post stream (reuses PostCard + PostDetail).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Lock, Send, UserMinus, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { Post } from "./types";
import { api } from "./types";
import PostCard from "./PostCard";
import PostDetail from "./PostDetail";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";

type MemberUser = { id: string; name: string | null; username: string | null; image: string | null };

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  visibility: string;
  coverGradient: number;
  memberCount: number;
  createdBy: MemberUser | null;
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

export default function GroupDetailView({ groupId, onBack, onOpenProfile, onHashtag }: Props) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<Array<{ role: string; user: MemberUser }>>([]);
  const [pending, setPending] = useState<Array<{ id: string; user: MemberUser }>>([]);
  const [viewerStatus, setViewerStatus] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [text, setText] = useState("");
  const groupTextRef = useRef<HTMLTextAreaElement>(null);
  const [posting, setPosting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadGroup = useCallback(async () => {
    try {
      const d = await api<{
        group: GroupDetail;
        viewer: { status: string | null; role: string | null };
        members: Array<{ role: string; user: MemberUser }>;
        pending: Array<{ id: string; user: MemberUser }>;
        restricted: boolean;
      }>(`/api/social/groups/${groupId}`);
      setGroup(d.group);
      setMembers(d.members || []);
      setPending(d.pending || []);
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

  useEffect(() => {
    loadGroup();
    loadPosts();
  }, [loadGroup, loadPosts]);

  const isMember = viewerStatus === "active";
  const isOwner = viewerRole === "owner" && isMember;

  async function join() {
    if (acting) return;
    setActing(true);
    try {
      const d = await api<{ status: string }>(`/api/social/groups/${groupId}/members`, { method: "POST" });
      setViewerStatus(d.status);
      toast.success(d.status === "active" ? "Welcome to the group!" : "Request sent — the owner will review it");
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

  async function moderate(action: "approve" | "remove", userId: string) {
    try {
      await api(`/api/social/groups/${groupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });
      toast.success(action === "approve" ? "Member approved" : "Member removed");
      loadGroup();
    } catch (err) {
      toast.error((err as Error).message || "Action failed");
    }
  }

  async function postToGroup() {
    const content = text.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const d = await api<{ post: Post }>("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mediaType: "text", groupId }),
      });
      setPosts((prev) => [d.post, ...prev]);
      setText("");
      toast.success("Shared with the group");
    } catch (err) {
      toast.error((err as Error).message || "Could not post");
    } finally {
      setPosting(false);
    }
  }

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

      {/* header */}
      <div className={`relative h-24 rounded-2xl bg-gradient-to-br ${grad} flex items-end p-3 overflow-hidden`}>
        {group.visibility === "private" && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white/90">
            <Lock size={10} /> Private
          </span>
        )}
        <span className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-extrabold text-lg mr-auto">
          {group.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex items-start justify-between mt-3 gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-white leading-tight">{group.name}</h1>
          <p className="text-[11px] text-[#94A3B8] capitalize inline-flex items-center gap-1.5 mt-0.5">
            <Users size={11} /> {group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.category.replace("-", " ")}
          </p>
        </div>
        {isMember ? (
          viewerRole === "owner" ? (
            <span className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300">Owner</span>
          ) : (
            <button onClick={leave} disabled={acting} className="shrink-0 text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#94A3B8] hover:text-white disabled:opacity-40">
              Leave
            </button>
          )
        ) : viewerStatus === "pending" ? (
          <span className="shrink-0 text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-white/[0.06] text-[#94A3B8]">Requested</span>
        ) : (
          <button onClick={join} disabled={acting} className="shrink-0 text-[11px] font-bold px-4 py-1.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-40">
            {group.visibility === "private" ? "Request to join" : "Join"}
          </button>
        )}
      </div>
      {group.description && <p className="text-[13px] text-[#CBD5E1] mt-2">{group.description}</p>}

      {/* owner tools */}
      {isOwner && pending.length > 0 && (
        <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-3 mt-3">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 mb-2">
            Join requests ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate flex-1">
                  {p.user.name || p.user.username || "Someone"}
                </span>
                <button onClick={() => moderate("approve", p.user.id)} className="p-1.5 rounded-lg bg-[#7C3AED] text-white" title="Approve">
                  <Check size={13} />
                </button>
                <button onClick={() => moderate("remove", p.user.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-[#94A3B8]" title="Decline">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {restricted ? (
        <div className="text-center py-12 mt-6">
          <Lock size={22} className="text-[#64748B] mx-auto mb-3" />
          <p className="text-sm text-[#94A3B8]">This group is private. Join to see posts and members.</p>
        </div>
      ) : (
        <>
          {/* members strip */}
          <button
            onClick={() => setShowMembers((v) => !v)}
            className="flex items-center gap-2 mt-4 text-xs font-bold text-[#94A3B8] hover:text-white"
          >
            <span className="flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <span key={m.user.id} className="w-6 h-6 rounded-full border-2 border-[#0B0F19] overflow-hidden bg-gradient-to-br from-[#7C3AED] to-[#EC4899] inline-flex items-center justify-center text-[9px] font-bold text-white">
                  {m.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (m.user.name || m.user.username || "?").charAt(0).toUpperCase()
                  )}
                </span>
              ))}
            </span>
            {members.length} member{members.length === 1 ? "" : "s"}
          </button>
          {showMembers && (
            <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-3 mt-2 space-y-1.5 max-h-56 overflow-y-auto">
              {members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] overflow-hidden inline-flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {m.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (m.user.name || m.user.username || "?").charAt(0).toUpperCase()
                    )}
                  </span>
                  <button
                    onClick={() => m.user.username && onOpenProfile(m.user.username)}
                    className="text-xs font-bold text-white hover:text-[#C4B5FD] truncate flex-1 text-left"
                  >
                    {m.user.name || m.user.username || "Member"}
                    {m.role === "owner" && <span className="ml-1.5 text-[9px] text-amber-300 font-extrabold">OWNER</span>}
                  </button>
                  {isOwner && m.role !== "owner" && (
                    <button onClick={() => moderate("remove", m.user.id)} className="p-1.5 rounded-lg bg-white/[0.04] text-[#94A3B8] hover:text-[#F87171]" title="Remove from group">
                      <UserMinus size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* composer (members only) */}
          {isMember && (
            <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-3 mt-4">
              <textarea
                ref={groupTextRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={2200}
                placeholder={`Share something with ${group.name}…`}
                className="w-full bg-transparent border-none outline-none resize-none text-sm text-white placeholder:text-[#64748B]"
              />
              <div className="flex items-center justify-between mt-1">
                <EmojiPickerButton
                  align="left"
                  onPick={(e) => insertAtCursor(groupTextRef.current, e, setText, 2200)}
                />
                <button
                  onClick={postToGroup}
                  disabled={!text.trim() || posting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
                >
                  <Send size={12} /> {posting ? "Posting…" : "Post to group"}
                </button>
              </div>
            </div>
          )}

          {/* group posts */}
          <div className="space-y-4 mt-4">
            {postsError ? (
              <div className="text-center py-8">
                <p className="text-xs text-[#94A3B8] mb-2">{postsError}</p>
                <button onClick={loadPosts} className="text-xs font-bold text-[#7C3AED]">Try again</button>
              </div>
            ) : posts.length === 0 ? (
              <p className="text-center text-sm text-[#94A3B8] py-8">
                {isMember ? "No posts in this group yet — start the conversation!" : "Join the group to see and share posts."}
              </p>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onOpenDetail={(p) => setDetailId(p.id)}
                  onOpenProfile={onOpenProfile}
                  onHashtag={onHashtag}
                  onOpenReel={() => {}}
                  onChanged={loadPosts}
                />
              ))
            )}
          </div>
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
