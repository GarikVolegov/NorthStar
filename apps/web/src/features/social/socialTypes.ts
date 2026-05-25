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
