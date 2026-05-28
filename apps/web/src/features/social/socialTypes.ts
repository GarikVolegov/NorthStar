export type SocialTab = "feed" | "friends" | "chat" | "profile";
export type Visibility = "public" | "friends";
export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface SocialAuthor {
  id: number;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  city?: string | null;
}

export interface SocialPost {
  id: number;
  userId: number;
  content: string;
  visibility: Visibility;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  mediaDescription?: string | null;
  hashtags?: string[];
  createdAt: string;
  author: SocialAuthor;
}

export interface SocialStory {
  id: number;
  userId: number;
  content?: string | null;
  mediaUrl?: string | null;
  visibility: Visibility;
  expiresAt: string;
  createdAt: string;
  author: SocialAuthor;
}

export interface FriendEntry {
  friendshipId: number;
  id: number;
  name: string;
  email: string;
  isPublic: boolean;
  createdAt?: string;
}

export interface SearchResult {
  id: number;
  name: string;
  email: string;
  isPublic: boolean;
  avatarUrl?: string | null;
  city?: string | null;
  friendshipId: number | null;
  friendshipStatus: FriendshipStatus | null;
  iAmRequester: boolean | null;
}

export type ChatFriend = {
  friendshipId: number;
  id: number;
  name: string;
};

export interface Community {
  id: number;
  name: string;
  description?: string | null;
  icon: string;
  isPublic: boolean;
  creatorId: number;
  memberCount: number;
  createdAt: string;
  role?: "owner" | "admin" | "member" | null;
  isMember: boolean;
}

export interface CommunityChannel {
  id: number;
  communityId: number;
  name: string;
  description?: string | null;
  type: "text" | "announcement";
  sortOrder: number;
}

export interface CommunityMessage {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
  author: SocialAuthor;
}
